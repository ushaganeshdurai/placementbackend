import { eq, inArray } from "drizzle-orm"; // Add inArray
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import { applications, drive, superAdmin } from "drizzle/schema";
import type { CreateJobsRoute, CreateStaffsRoute, GetOneRoute, LoginSuperAdmin, RegisteredStudentsRoute, RemoveDriveRoute, RemoveStaffRoute } from "./superadmin.routes";
import { staff } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

// Login the admin
export const loginAdmin: AppRouteHandler<LoginSuperAdmin> = async (c) => {
  const { email, password } = c.req.valid("json");

  const queryAdmin = await db
    .select()
    .from(superAdmin)
    .where(eq(superAdmin.email, email))
    .limit(1)
    .execute();

  if (queryAdmin.length === 0) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const admin = queryAdmin[0];
  const isPasswordValid = await bcrypt.compare(password, admin.password!);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: admin.id, role: "super_admin" }, SECRET_KEY);

  setCookie(c, "admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });
  return c.redirect("/superadmin", 302);
};

// Get Super Admin Dashboard Data
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    console.log('JWT Token:', jwtToken);
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const staffList = await db.select({
      staffId: staff.staffId,
      userId: staff.userId,
      email: staff.email,
      name: staff.name,
    }).from(staff).execute();

    console.log('Fetched staff list:', staffList);

    return c.json({
      success: true,
      userId,
      role: userRole,
      staff: staffList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

// Add Staff
export const createStaffs: AppRouteHandler<CreateStaffsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole = null;
    let userId = null;

    try {
      const SECRET_KEY = process.env.SECRET_KEY!;
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      userId = decoded.id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const newStaffs = c.req.valid('json');
    if (!Array.isArray(newStaffs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      // Hash passwords
      const validStaffs = await Promise.all(newStaffs.map(async (staff) => ({
        email: staff.email,
        password: await bcrypt.hash(staff.password, 10),
      })));

      // Check for existing emails
      const emailsToCheck = validStaffs.map(s => s.email);
      const existingEmails = await db.select({ email: staff.email })
        .from(staff)
        .where(inArray(staff.email, emailsToCheck.length > 0 ? emailsToCheck : [''])) // Avoid empty IN clause
        .execute()
        .then(rows => rows.map(row => row.email));

      // Filter out duplicates
      const uniqueStaffs = validStaffs.filter(s => !existingEmails.includes(s.email));
      const duplicateEmails = validStaffs.filter(s => existingEmails.includes(s.email)).map(s => s.email);

      let insertedStaffs = [];
      if (uniqueStaffs.length > 0) {
        insertedStaffs = await db.insert(staff).values(uniqueStaffs).returning();
      }

      // Return response with both inserted and skipped info
      return c.json({
        inserted: insertedStaffs,
        skipped: duplicateEmails.length > 0 ? `Skipped duplicate emails: ${duplicateEmails.join(', ')}` : null,
      }, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error('Staff creation error:', error);
    return c.json({ error: "Failed to process staff creation" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// Remove Staff
export const removeStaff: AppRouteHandler<RemoveStaffRoute> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    const staffResult = await db.delete(staff)
      .where(eq(staff.staffId, id))
      .returning();

    console.log('Staff deletion result:', staffResult);

    if (staffResult.length === 0) {
      return c.json({
        errors: [{
          code: 'NOT_FOUND',
          message: 'Staff not found or already deleted'
        }]
      }, HttpStatusCodes.NOT_FOUND);
    }

    const userId = staffResult[0].userId;
    if (userId) {
      const profileResult = await db.delete(profiles)
        .where(eq(profiles.id, userId))
        .returning();
      console.log('Profile deletion result:', profileResult);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error('Staff deletion error:', error);
    return c.json({
      errors: [{
        path: [ 'staffId', ],
        message: 'Invalid staff ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};



export const createjobs: AppRouteHandler<CreateJobsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let userId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      userId = decoded.id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!userId) {
      return c.json({ error: "Super admin ID missing from token" }, 400);
    }

    const newJobs = c.req.valid("json");
    if (!Array.isArray(newJobs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      const validJobs = await Promise.all(
        newJobs.map(async (job) => ({
          batch: job.batch!,
          jobDescription: job.jobDescription!,
          department: job.department,
          expiration: job.expiration!, //format: mm/dd/yyyy, --:--:-- --
          companyName: job.companyName!,
          driveDate: job.driveDate!, //format: mm/dd/yyyy
        }))
      );

      console.log("Super admin ID being used:", userId);

      const insertedJobs = await db.insert(drive).values(validJobs).returning();
      return c.json(insertedJobs, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};



//Remove job

export const removedrive: AppRouteHandler<RemoveDriveRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let userId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      userId = decoded.id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!userId) {
      return c.json({ error: "Super admin ID missing from token" }, 400);
    }

    const { id } = c.req.valid("param");
    const result = await db.delete(drive)
      .where(eq(drive.id, id));
    return c.body("Job deleted successfully", HttpStatusCodes.OK);

  } catch (error) {
    console.error('Job deletion error:', error);
    return c.json({
      errors: [{
        path: ['param', 'id'],
        message: 'Invalid Job ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};

//get the registered students

export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    console.log(jwtToken)
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired", success: false }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const registeredStudentsList = await db.select().from(applications).execute();
    return c.json({
      success: "Fetched applications successfully",
      userId,
      role: userRole,
      registered_students: registeredStudentsList,
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};
