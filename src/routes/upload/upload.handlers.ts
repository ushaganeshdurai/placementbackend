import { verify } from "hono/jwt";
import * as HttpStatusCodes from "stoker/http-status-codes";

export const upload: AppRouteHandler<CreateJobsRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
  if (!jwtToken) return c.json({ error: "Unauthorized: No session found" }, 401);

  let decoded;
  try {
    decoded = await verify(jwtToken, process.env.SECRET_KEY!);
    if (!decoded) throw new Error("Invalid session");
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (decoded.role !== "super_admin") return c.json({ error: "Unauthorized" }, 403);
  if (!decoded.id) return c.json({ error: "Super admin ID missing from token" }, 400);

  const newJobs = c.req.valid("json");
  if (!Array.isArray(newJobs)) return c.json([], HttpStatusCodes.OK);

  try {
    const validJobs = newJobs.map(job => ({
      batch: job.batch!,
      jobDescription: job.jobDescription!,
      department: job.department,
      expiration: job.expiration!,
      companyName: job.companyName!,
      driveDate: job.driveDate!,
      driveLink: job.driveLink!,
      // Remove notificationEmail from here since it’s not in the DB table
    }));

    const insertedJobs = await db.insert(drive).values(validJobs).returning();

    // Send email notifications to all emails for each job
    await Promise.all(
      newJobs.map(job => // Use newJobs to access notificationEmail
        Promise.all(
          job.notificationEmail.map(email => sendJobNotificationEmail(job, email))
        )
      )
    );

    return c.json(insertedJobs, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Job creation error:", error);
    return c.json({ error: "Failed to create jobs", details: error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};