

import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from "bcryptjs";
import { applications, drive, students, superAdmin, staff, profiles, groupMails, events } from "drizzle/schema";
import type {
  BulkUploadStudentsRoute,
  CreateJobsRoute,
  GetJobsWithStudentsRoute,
  CreateStaffsRoute,
  CreateCoordinatorsRoute,
  GetOneRoute,
  LoginSuperAdmin,
  RegisteredStudentsRoute,
  RemoveDriveRoute,
  RemoveStaffRoute,
  LogoutAdminRoute,
  FeedGroupMailRoute,
  GetFeedMailRoute,
  CreateEventsRoute,
  PlacedStudentsRoute

} from "./superadmin.routes";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import nodemailer from 'nodemailer';
import { createClient } from "@supabase/supabase-js";
import { coordinators } from "@/db/schemas/coordinatorsSchema";

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any email service
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});


/**
 * Sends a notification email about a new job posting.
 * @param jobData - The job details including company name and description.
 * @param recipientEmail - The email address of the recipient.
 * @throws Will throw an error if the email fails to send.
 */
const sendJobNotificationEmail = async (jobData: any, recipientEmail: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `New Job Posting: ${jobData.companyName}`,
    html: `
      <h2>New Job Opportunity</h2>
      <p>${jobData.jobDescription}</p>
      <p>Please review and take necessary action.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully to:', recipientEmail);
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw new Error('Failed to send notification email');
  }
};



// Login the admin
/**
 * Logs in the super admin by validating credentials and setting a session token.
 * @param c - The context object containing the request and response.
 * @returns Redirects to the super admin dashboard if successful.
 */
export const loginAdmin: AppRouteHandler<LoginSuperAdmin> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "staff_session");
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
  const sessionToken = await sign({ id: admin.id, email: admin.email, role: "super_admin" }, SECRET_KEY);
  console.log(sessionToken)

  setCookie(c, "admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });
  return c.redirect("/superadmin", 302);
};
//@ts-ignore

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;
  let email = null;
  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    // @ts-ignore
    userId = decoded.id;
    // @ts-ignore
    userRole = decoded.role;
    // @ts-ignore
    email = decoded.email;
    console.log("JWT Token:", jwtToken);
  } catch (error) {
    // @ts-ignore
    if (error.name === "TokenExpiredError") { // Correct error check
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    // Fetch staff data
    const staffList = await db
      .select({
        staffId: staff.staffId,
        userId: staff.userId,
        email: staff.email,
        name: staff.name,
        department: staff.department,
      })
      .from(staff)
      .execute();

    // Fetch students data (adjust fields based on your students table schema)
    const studentList = await db
      .select({
        studentId: students.studentId, // Adjust to match your schema
        email: students.email,
        name: students.name,
        batch: students.batch,
        department: students.department,
        placedStatus: students.placedStatus
      })
      .from(students)
      .execute();

    console.log("Fetched staff list:", staffList);
    console.log("Fetched student list:", studentList);

    return c.json(
      {
        success: true,
        userId,
        role: userRole,
        email,
        staff: staffList,
        students: studentList, // Add students to the response
      },
      200
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};



/**
 * Creates new staff members by validating input and inserting into the database.
 * @param c - The context object containing the request and response.
 * @returns A JSON response with inserted and skipped staff details.
 */
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
      // @ts-ignore
      userId = decoded.id;
      // @ts-ignore
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const newStaffs = c.req.valid("json");
    if (!Array.isArray(newStaffs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      // Hash passwords and include department
      const validStaffs = await Promise.all(
        newStaffs.map(async (staff) => ({
          email: staff.email,
          password: await bcrypt.hash(staff.password!, 10),
          department: staff.department || null,
        }))
      );

      // Check for existing emails
      const emailsToCheck = validStaffs.map((s) => s.email);
      const existingEmails = await db
        .select({ email: staff.email })
        .from(staff)
        .where(inArray(staff.email, emailsToCheck.length > 0 ? emailsToCheck : [""])) // Avoid empty IN clause
        .execute()
        .then((rows) => rows.map((row) => row.email));

      // Filter out duplicates
      const uniqueStaffs = validStaffs.filter((s) => !existingEmails.includes(s.email));
      const duplicateEmails = validStaffs.filter((s) => existingEmails.includes(s.email)).map((s) => s.email);

      let insertedStaffs = [];
      if (uniqueStaffs.length > 0) {
        // @ts-ignore
        insertedStaffs = await db.insert(staff).values(uniqueStaffs).returning();
      }

      // Return response with both inserted and skipped info
      return c.json(
        {
          inserted: insertedStaffs,
          skipped: duplicateEmails.length > 0 ? `Skipped duplicate emails: ${duplicateEmails.join(", ")}` : null,
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Staff creation error:", error);
    return c.json({ error: "Failed to process staff creation" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};



/**
 * Creates new coordinator members by validating input and inserting into the database.
 * @param c - The context object containing the request and response.
 * @returns A JSON response with inserted and skipped staff details.
 */
export const createCoordinators: AppRouteHandler<CreateCoordinatorsRoute> = async (c) => {
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
      // @ts-ignore
      userId = decoded.id;
      // @ts-ignore
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const newCoordinators = c.req.valid("json");
    if (!Array.isArray(newCoordinators)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      const validCoordinators = await Promise.all(
        newCoordinators.map(async (coord) => ({
          phoneNumber: coord.phoneNumber,
          name: coord.name,
          dept: coord.dept || null,
        }))
      );

      let insertedCoordinators = await db.insert(coordinators).values(validCoordinators).returning();

      // Return response with both inserted
      return c.json(
        {
          inserted: insertedCoordinators,
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Staff creation error:", error);
    return c.json({ error: "Failed to process staff creation" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};


/**
 * Removes a staff member by ID.
 * @param c - The context object containing the request and response.
 * @returns A response indicating success or failure of the deletion.
 */
export const removeStaff: AppRouteHandler<RemoveStaffRoute> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    const staffResult = await db
      .delete(staff)
      .where(eq(staff.staffId, id))
      .returning();

    console.log("Staff deletion result:", staffResult);

    if (staffResult.length === 0) {
      return c.json(
        {
          errors: [
            {
              code: "NOT_FOUND",
              message: "Staff not found or already deleted",
            },
          ],
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const userId = staffResult[0].userId;
    if (userId) {
      const profileResult = await db
        .delete(profiles)
        .where(eq(profiles.id, userId))
        .returning();
      console.log("Profile deletion result:", profileResult);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error("Staff deletion error:", error);
    return c.json(
      {
        errors: [
          {
            path: ["staffId"],
            message: "Invalid staff ID format",
          },
        ],
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

/**
 * Handles the creation of job postings by a super admin.
 *
 * @param c - The context object containing the request and response.
 * 
 * @returns A JSON response with the created jobs or an error message.
 *
 * @remarks
 * - This function requires a valid JWT token from either the "admin_session" or "oauth_session" cookie.
 * - The token must decode to a user with the role of "super_admin".
 * - The function validates the incoming job data and inserts it into the database.
 * - Notifications are sent to the specified email addresses for each job.
 *
 * @throws
 * - Returns a 401 status code if the session is invalid or missing.
 * - Returns a 403 status code if the user is not authorized.
 * - Returns a 400 status code if the super admin ID is missing from the token.
 * - Returns a 500 status code if there is an error during job creation.
 *
 * @example
 * // Example request payload:
 * [
 *   {
 *     "batch": "2023",
 *     "jobDescription": "Software Engineer",
 *     "department": "Engineering",
 *     "expiration": "2023-12-31",
 *     "companyName": "TechCorp",
 *     "driveDate": "2023-11-01",
 *     "driveLink": "https://example.com/drive",
 *     "notificationEmail": ["user1@example.com", "user2@example.com"]
 *   }
 * ]
 *
 * @see {@link verify} for JWT verification.
 * @see {@link db.insert} for database insertion.
 * @see {@link sendJobNotificationEmail} for sending email notifications.
 */
//@ts-ignore
export const createjobs: AppRouteHandler<CreateJobsRoute> = async (c) => {
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
      role: job.role,
      lpa: job.lpa,
      expiration: job.expiration!,
      companyName: job.companyName!,
      driveDate: job.driveDate!,
      driveLink: job.driveLink!,
    }));
    // @ts-ignore
    const insertedJobs = await db.insert(drive).values(validJobs).returning();

    await Promise.all(
      newJobs.map(job =>
        Promise.all(
          job.notificationEmail.map(email => sendJobNotificationEmail(job, email))
        )
      )
    );

    return c.json(insertedJobs, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Job creation error:", error);
    // @ts-ignore
    return c.json({ error: "Failed to create jobs", details: error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};


/**
 * Handles the removal of a drive by its ID.
 *
 * This route handler verifies the user's session using a JWT token, checks the user's role and ID,
 * and deletes the specified drive from the database if the user is authorized.
 *
 * @param c - The context object containing the request and response.
 * 
 * @returns A JSON response indicating the success or failure of the operation.
 *
 * @throws Returns a 401 Unauthorized response if no session is found or the session is invalid.
 * @throws Returns a 400 Bad Request response if the super admin ID is missing from the token.
 * @throws Returns a 422 Unprocessable Entity response if the job ID format is invalid.
 *
 * @example
 * // Expected request:
 * // DELETE /superadmin/drive/:id
 * // Headers: { Cookie: "admin_session=<token>" }
 * 
 * // Successful response:
 * // Status: 200 OK
 * // Body: "Job deleted successfully"
 * 
 * // Error response (unauthorized):
 * // Status: 401 Unauthorized
 * // Body: { error: "Unauthorized: No session found" }
 * 
 * // Error response (invalid session):
 * // Status: 401 Unauthorized
 * // Body: { error: "Invalid session" }
 * 
 * // Error response (missing super admin ID):
 * // Status: 400 Bad Request
 * // Body: { error: "Super admin ID missing from token" }
 * 
 * // Error response (invalid job ID format):
 * // Status: 422 Unprocessable Entity
 * // Body: {
 * //   errors: [
 * //     {
 * //       path: ["param", "id"],
 * //       message: "Invalid Job ID format"
 * //     }
 * //   ]
 * // }
 */
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
    const result = await db.delete(drive).where(eq(drive.id, id));
    return c.body("Job deleted successfully", HttpStatusCodes.OK);
  } catch (error) {
    console.error("Job deletion error:", error);
    return c.json(
      {
        errors: [
          {
            path: ["param", "id"],
            message: "Invalid Job ID format",
          },
        ],
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

/**
 * Handles the retrieval of registered students for the super admin.
 *
 * This function verifies the session token from cookies, checks the user's role,
 * and fetches the list of registered students from the database if the user is authorized.
 *
 * @param c - The context object containing the request and response.
 * @returns A JSON response containing the list of registered students or an error message.
 *
 * - Returns 401 if the session token is missing, invalid, or expired.
 * - Returns 403 if the user does not have the "super_admin" role.
 * - Returns 500 if there is an error during the database query.
 */
//@ts-ignore
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
    // @ts-ignore
    userId = decoded.id;
    // @ts-ignore
    userRole = decoded.role;
    console.log(jwtToken);
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
    const registeredStudentsList = await db
      .select({
        applicationId: applications.id,
        studentName: students.name,
        email: students.email,
        arrears: students.noOfArrears,
        cgpa: students.cgpa,
        batch: students.batch,
        department: students.department,
        placedStatus: students.placedStatus,
        regNo: students.regNo,
        rollNo: students.rollNo,
        companyName: drive.companyName,
        appliedAt: applications.appliedAt,
      })
      .from(applications)
      .innerJoin(students, eq(applications.studentId, students.studentId))
      .innerJoin(drive, eq(applications.driveId, drive.id))
      .execute();
    return c.json(
      {
        success: "Fetched applications successfully",
        userId,
        role: userRole,
        registered_students: registeredStudentsList,
      },
      200
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};

/**
 * Handles the bulk upload of student data by the super admin.
 *
 * @async
 * @function bulkUploadStudents
 * @template BulkUploadStudentsRoute
 * @param {AppRouteHandler<BulkUploadStudentsRoute>} c - The route context containing the request and response objects.
 * @returns {Promise<Response>} A JSON response indicating success or failure.
 *
 * @description
 * This function allows a super admin to upload multiple student records in bulk. 
 * It performs the following steps:
 * 1. Verifies the admin session using a JWT token.
 * 2. Ensures the user has the "super_admin" role.
 * 3. Validates the input student data for required fields (`staffEmail`, `email`, `password`).
 * 4. Checks if the provided `staffEmail` values correspond to valid staff records.
 * 5. Hashes student passwords and associates them with the corresponding staff IDs.
 * 6. Inserts the valid student records into the database.
 *
 * @throws {Error} Returns appropriate HTTP status codes and error messages for:
 * - Missing or invalid session.
 * - Unauthorized access.
 * - Invalid or incomplete student data.
 * - Internal server errors.
 */
//@ts-ignore
export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
  type StudentData = {
    staffEmail: string;
    email: string;
    password: string;
  };

  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole = null;
    try {
      const SECRET_KEY = process.env.SECRET_KEY!;
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      // @ts-ignore
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (userRole !== "super_admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const studentData: StudentData[] = c.req.valid("json").map((student: any) => ({
      ...student,
      password: student.password || "",
    }));
    if (!Array.isArray(studentData) || studentData.length === 0) {
      return c.json({ error: "No valid students found" }, 400);
    }

    if (studentData.some((s) => !s.staffEmail || !s.email || !s.password)) {
      return c.json({ error: "Missing required fields: staffEmail, email, or password" }, 400);
    }

    const staffEmails = [...new Set(studentData.map((s) => s.staffEmail))];

    const staffRecords = await db
      .select({ email: staff.email, id: staff.staffId })
      .from(staff)
      .where(inArray(staff.email, staffEmails));

    const staffEmailToId = Object.fromEntries(staffRecords.map((s) => [s.email, s.id]));

    const invalidEmails = staffEmails.filter((email) => !staffEmailToId[email]);
    if (invalidEmails.length > 0) {
      return c.json({ error: "Invalid staff emails", emails: invalidEmails }, 400);
    }

    const validStudents = studentData.map(({ staffEmail, email, password }) => ({
      email,
      password: bcrypt.hashSync(password, 10),
      staffId: staffEmailToId[staffEmail],
    }));

    const insertedStudents = await db.insert(students).values(validStudents).returning();

    return c.json(insertedStudents, 200);
  } catch (error) {
    console.error("Bulk student upload error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};

/**
 * Handles the retrieval of job postings along with associated student applications.
 * 
 * This route handler performs the following steps:
 * 1. Extracts the JWT token from the Authorization header or cookies.
 * 2. Verifies the JWT token to authenticate the user and extract their role.
 * 3. Ensures the user has the "super_admin" role to access this resource.
 * 4. Queries the database to fetch job postings and their associated student applications.
 * 5. Groups the results by job postings and formats the response.
 * 
 * @param c - The route context containing the request and response objects.
 * @returns A JSON response containing the list of jobs with associated student applications
 *          or an error message with the appropriate HTTP status code.
 */
//@ts-ignore
export const getJobsWithStudents: AppRouteHandler<GetJobsWithStudentsRoute> = async (c) => {
  const authHeader = c.req.header("Authorization");
  let jwtToken: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    const sessionToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    jwtToken = sessionToken || null;
  }

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId: string | null = null;
  let userRole: string | null = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    // @ts-ignore
    userId = decoded.id;
    // @ts-ignore
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const jobsWithStudents = await db
      .select({
        jobId: drive.id,
        companyName: drive.companyName,
        jobDescription: drive.jobDescription,
        driveDate: drive.driveDate,
        expiration: drive.expiration,
        batch: drive.batch,
        department: drive.department,
        createdAt: drive.createdAt,
        driveLink: drive.driveLink,
        studentApplications: {
          applicationId: applications.id,
          studentName: students.name,
          email: students.email,
          cgpa: students.cgpa,
          batch: students.batch,
          department: students.department,
          appliedAt: applications.appliedAt,
          phoneNumber: students.phoneNumber,
          noOfArrears: students.noOfArrears,
        },
      })
      .from(drive)
      .leftJoin(applications, eq(drive.id, applications.driveId))
      .leftJoin(students, eq(applications.studentId, students.studentId))
      .execute();

    const groupedJobs = jobsWithStudents.reduce((acc, curr) => {
      const jobId = curr.jobId as number;
      if (!acc[jobId]) {
        acc[jobId] = {
          jobId: curr.jobId as number,
          companyName: curr.companyName,
          jobDescription: curr.jobDescription,
          driveDate: curr.driveDate,
          expiration: curr.expiration,
          batch: curr.batch,
          department: curr.department,
          createdAt: curr.createdAt,
          driveLink: curr.driveLink,
          students: [],
        };
      }
      if (curr.studentApplications.applicationId) {
        acc[jobId].students.push(curr.studentApplications);
      }
      return acc;
    }, {});

    const jobsArray = Object.values(groupedJobs);

    return c.json(
      {
        success: true,
        jobs: jobsArray,
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch jobs", success: false }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};


/**
 * Handles the logout process for an admin user.
 *
 * This function checks for active sessions by looking for cookies named
 * `admin_session` and `oauth_session`. If neither cookie is found, it
 * responds with an unauthorized status. If one of the cookies is found,
 * it clears the corresponding cookie and responds with a success message.
 *
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating the result of the logout operation.
 *
 * - If no active session is found:
 *   - Returns a JSON response with a message "No active session" and
 *     HTTP status code 401 (UNAUTHORIZED).
 * - If a session is found:
 *   - Clears the corresponding session cookie (`admin_session` or `oauth_session`).
 *   - Returns a JSON response with a message "Logged out successfully" and
 *     HTTP status code 200 (OK).
 */
export const logoutAdmin: AppRouteHandler<LogoutAdminRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session");
  const oauthToken = getCookie(c, "oauth_session");
  if (!jwtToken && !oauthToken) {
    return c.json({ message: "No active session" }, HttpStatusCodes.UNAUTHORIZED);
  }
  if (jwtToken) {
    // Clear the admin_session cookie
    deleteCookie(c, "admin_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
    });
  }
  else if (oauthToken) {
    deleteCookie(c, "oauth_session", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
  }

  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};


/**
 * Handles the creation of group mail entries for super admins.
 * 
 * This handler performs the following steps:
 * 1. Deletes existing session cookies for students and staff.
 * 2. Verifies the admin or OAuth session token.
 * 3. Validates the request body to ensure it contains an array of email addresses.
 * 4. Checks if the user has the "super_admin" role.
 * 5. Filters and validates email addresses to ensure they belong to the "@saec.ac.in" domain.
 * 6. Inserts the valid email addresses into the database.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response with the number of emails inserted or an error message.
 * 
 * @throws 401 Unauthorized - If no session is found or the session is invalid.
 * @throws 403 Forbidden - If the user does not have the "super_admin" role.
 * @throws 400 Bad Request - If the request body is not an array or contains no valid emails.
 * @throws 500 Server Error - If an unexpected error occurs during processing.
 */
export const FeedGroupMail: AppRouteHandler<FeedGroupMailRoute> = async (c) => {
  try {
    deleteCookie(c, "student_session");
    deleteCookie(c, "staff_session");

    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) return c.json({ error: "Unauthorized: No session found" }, 401);

    let userRole: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;

    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      userRole = decoded.role as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const requestBody = await c.req.json();
    if (!Array.isArray(requestBody)) {
      return c.json({ error: "Invalid request format, expected an array of emails" }, 400);
    }

    if (userRole !== "super_admin") return c.json({ error: "Unauthorized" }, 403);

    // Validate and clean emails
    const validEmails = [...new Set(
      requestBody
        .filter((email: any) => typeof email === "string")
        .map((email: string) => email.trim().toLowerCase())
        .filter((email: string) => email.endsWith("@saec.ac.in"))
    )];

    if (validEmails.length === 0) {
      return c.json({ error: "No valid emails with @saec.ac.in domain" }, 400);
    }

    // Insert emails into DB
    const insertedEmails = await db.insert(groupMails).values(
      validEmails.map((email) => ({ email }))
    ).returning();

    return c.json({ inserted: insertedEmails.length, emails: insertedEmails }, 200);
  } catch (error) {
    console.error("Mail IDs creation error:", error);
    return c.json({ error: "Server error" }, 500);
  }
};

/**
 * Handles the retrieval of group mail list for the super admin.
 *
 * @param c - The route handler context.
 * @returns A JSON response containing the group mail list or an error message.
 *
 * - Validates the presence of a session token from cookies (`admin_session` or `oauth_session`).
 * - Decodes and verifies the session token using the secret key.
 * - Ensures the user has the "super_admin" role.
 * - Fetches the group mail list from the database if the user is authorized.
 *
 * Possible Responses:
 * - 200: Successfully returns the group mail list.
 * - 401: Unauthorized due to missing, invalid, or expired session token.
 * - 403: Unauthorized due to insufficient role.
 * - 500: Internal server error during database query.
 */
export const getFeedGroupMail: AppRouteHandler<GetFeedMailRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId: string | undefined;
  let userRole: string | undefined;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);

    if (!decoded) throw new Error("Invalid session");
    // @ts-ignore
    userId = decoded.id;
    // @ts-ignore
    userRole = decoded.role;

    console.log(jwtToken);
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
    const groupMailList = await db.select({ email: groupMails.email }).from(groupMails).execute();
    return c.json({
      groupMailList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};


/**
 * Handles the creation of events by validating the session, processing the request body,
 * uploading an optional file to Supabase storage, and inserting the event data into the database.
 *
 * @param c - The context object containing the request and response.
 * 
 * @returns A JSON response with the created event data or an error message.
 *
 * - Validates the session token from cookies (`admin_session` or `oauth_session`).
 * - Initializes the Supabase client if not already available in the context.
 * - Verifies the session token and extracts the user role.
 * - Validates and parses the request body for event data.
 * - Handles optional file upload to Supabase storage and retrieves the public URL.
 * - Inserts the event data into the database and returns the created event.
 * - Handles errors and returns appropriate HTTP status codes and error messages.
 */
export const createevents: AppRouteHandler<CreateEventsRoute> = async (c) => {
  try {
    // Session validation
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
    }

    // Initialize Supabase
    let supabase = c.get("supabase");
    if (!supabase) {
      console.warn("Supabase client not found in context. Initializing manually.");
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.");
      }
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Verify session token
    const SECRET_KEY = process.env.SECRET_KEY!;


    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.role) {
        return c.json({ error: "Invalid session: Staff ID missing" }, HttpStatusCodes.UNAUTHORIZED);
      }
      let userRole: string;
      userRole = decoded.role as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
    }

    // Validate and parse the request body
    const eventData = c.req.valid("json");
    if (!eventData || typeof eventData !== "object") {
      return c.json({ error: "Invalid event data" }, HttpStatusCodes.BAD_REQUEST);
    }

    let posterUrl: string | null = typeof eventData.url === "string" ? eventData.url : null;

    // Handle file upload
    if (eventData.file) {
      if (typeof eventData.file !== "string") {
        return c.json({ error: "Invalid file: Must be a base64-encoded string" }, HttpStatusCodes.BAD_REQUEST);
      }

      const fileBuffer = Buffer.from(eventData.file, "base64");
      const fileName = eventData.fileName
        ? `events/${Date.now()}_${eventData.fileName}`
        : `events/${Date.now()}_poster`;

      const { data, error } = await supabase.storage
        .from("bucky")
        .upload(fileName, fileBuffer, {
          contentType: eventData.fileType || "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (error) {
        console.error("Supabase Upload Error:", error);
        return c.json({ error: `File upload failed: ${error.message}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
      posterUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
    }

    const newEvent = {
      event_name: eventData.event_name,
      event_link: eventData.event_link,
      date: eventData.date,
      url: posterUrl,
    };

    const insertedEvent = await db
      .insert(events)
      // @ts-ignore
      .values(newEvent)
      .returning();

    if (insertedEvent.length === 0) {
      return c.json({ error: "Failed to create event" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    return c.json(insertedEvent[0], HttpStatusCodes.OK);
  } catch (error) {
    console.error("Event creation error:", error);
    return c.json({ error: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};



export const placedstudents: AppRouteHandler<PlacedStudentsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }
    let userRole: string | null = null;
    let userId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      userId = decoded.id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session", success: false }, 401);
    }

    if (!userId) {
      return c.json({ error: "Admin ID missing from token", success: false }, 400);
    }

    const { emails, companyName } = c.req.valid("json");
    if (!Array.isArray(emails) || emails.length === 0) {
      return c.json({ error: "Invalid request body: Expected a non-empty array of emails", success: false }, 400);
    }
    if (!companyName) {
      return c.json({ error: "Invalid request body: Company name is required", success: false }, 400);
    }

    if (userRole === "super_admin") {
      console.log("Updating placed status for students:", emails);

      const updatedStudents = [];
      const errors = [];

      for (const email of emails) {
        try {
          const existingStudent = await db
            .select()
            .from(students)
            .where(eq(students.email, email))
            .limit(1)
            .execute();

          if (existingStudent.length === 0) {
            //@ts-ignore
            errors.push({ email, error: "Student not found" });
            continue;
          }

          const updatedStudent = await db
            .update(students)
            .set({ placedStatus: "yes", companyPlacedIn: companyName })
            .where(eq(students.email, email))
            .returning();
          //@ts-ignore
          updatedStudents.push(updatedStudent[0]);
          console.log(`Updated student ${email}:`, updatedStudent);
        } catch (error: any) {
          console.error(`Error updating student ${email}:`, error);
          //@ts-ignore
          errors.push({ email, error: error.message });
        }
      }

      return c.json(
        {
          success: true,
          message: "Placed students updated successfully",
          updated: updatedStudents,
          errors,
        },
        200
      );
    }

    return c.json({ error: "Unauthorized", success: false }, 403);
  } catch (error: any) {
    console.error("Students update error:", error);
    return c.json({ error: "An error occurred", success: false }, 500);
  }

};
