import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { BulkUploadStudentsRoute, CreateEventsRoute, CreateJobAlertRoute, CreateStudentsRoute, DisplayDrivesRoute, FeedGroupMailRoute, ForgotPassword, GetFeedGroupMailRoute, GetOneRoute, LoginStaffRoute, LogoutStaffRoute, PlacedStudentsRoute, RegisteredStudentsRoute, RemoveJobRoute, RemoveStudentRoute, ResetPassword, UpdatePasswordRoute } from "./staff.routes";
import { applications, drive, events, groupMails, staff, students } from "drizzle/schema";
import { insertStudentSchema } from "@/db/schemas/studentSchema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { decode, sign, verify } from "hono/jwt";
import { z } from "zod";
import nodemailer from 'nodemailer';
import { createClient } from "@supabase/supabase-js";

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any email service
  auth: {
    user: process.env.EMAIL_USER!, // Your email
    pass: process.env.EMAIL_PASS!, // Your email password or app-specific password
  },
});


// Function to send notification email
const sendJobNotificationEmail = async (jobData: any, recipientEmail: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `New Job Posting: ${jobData.companyName}`,
    html: `
      <h2>Check out about this new job listing in the placement portal</h2>
      </ul>
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


/**
 * Handles the login process for staff members.
 * 
 * - Clears any existing "student_session" and "admin_session" cookies.
 * - Validates the provided email and password against the database.
 * - If credentials are valid, generates a session token and sets it as a cookie.
 * - Redirects the staff member to the "/staff" page upon successful login.
 * 
 * @param c - The application route context containing the request and response objects.
 * @returns A JSON response with an error message and status 401 if credentials are invalid, 
 *          or a redirection to the "/staff" page upon successful login.
 */
export const loginStaff: AppRouteHandler<LoginStaffRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
  const { email, password } = c.req.valid("json");

  const queryStaff = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1)
    .execute();

  if (queryStaff.length === 0) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const queried_staff = queryStaff[0];

  const isPasswordValid = await bcrypt.compare(password, queried_staff.password!);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }


  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ staff_id: queried_staff.staffId, role: "staff", email: queried_staff.email }, SECRET_KEY);
  console.log("Context:", c);
  setCookie(c, "staff_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/staff", 302)
};


/**
 * Handles the removal of a student from the database.
 * 
 * This function deletes cookies related to the student session, admin session,
 * and OAuth session. It then attempts to delete the student record from the database
 * based on the provided student ID.
 * 
 * @param c - The route handler context containing the request and response objects.
 * 
 * @returns A JSON response indicating the result of the operation:
 * - `204 No Content` if the student is successfully deleted.
 * - `404 Not Found` if the student ID does not exist in the database.
 * - `422 Unprocessable Entity` if there is an invalid student ID format or a server error.
 */
export const removeStudent: AppRouteHandler<RemoveStudentRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
  deleteCookie(c, "oauth_session")
  try {
    const { id } = c.req.valid("param");
    const result = await db.delete(students)
      .where(eq(students.studentId, id))
      .execute();
    if (result.count === 0) {
      console.log(`Student with ID ${id} not found in database`);
      return c.json({
        errors: [{
          code: 'NOT_FOUND',
          message: 'Student not found'
        }]
      }, HttpStatusCodes.NOT_FOUND);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error('Student deletion error:', error);
    return c.json({
      errors: [{
        path: ['param', 'id'],
        message: 'Invalid student ID format or server error'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};

/**
 * Handles the creation of job alerts by staff members.
 *
 * This route handler performs the following steps:
 * 1. Deletes any existing cookies for "student_session", "admin_session", and "oauth_session".
 * 2. Retrieves and verifies the "staff_session" JWT token to authenticate the staff member.
 * 3. Validates the decoded token to ensure the user has the "staff" role and a valid `staff_id`.
 * 4. Processes the incoming job data, validates it, and inserts it into the database.
 * 5. Sends notification emails for each job to the specified recipients.
 *
 * @param c - The route context object containing the request and response.
 * @returns A JSON response indicating the result of the operation:
 * - On success: Returns the inserted job records with a 200 status code.
 * - On failure: Returns an error message with an appropriate HTTP status code.
 *
 * @throws {Error} If the JWT token is invalid or missing.
 * @throws {Error} If the job data is invalid or the database operation fails.
 */
export const createjobs: AppRouteHandler<CreateJobAlertRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
  deleteCookie(c, "oauth_session")
  const jwtToken = getCookie(c, "staff_session");
  if (!jwtToken) return c.json({ error: "Unauthorized: No session found" }, 401);

  let decoded;
  try {
    decoded = await verify(jwtToken, process.env.SECRET_KEY!);
    if (!decoded) throw new Error("Invalid session");
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (decoded.role !== "staff") return c.json({ error: "Unauthorized" }, 403);
  if (!decoded.staff_id) return c.json({ error: "Staff ID missing from token" }, 400);

  const newJobs = c.req.valid("json");
  if (!Array.isArray(newJobs)) return c.json([], HttpStatusCodes.OK);

  try {
    const validJobs = newJobs.map(job => ({
      batch: job.batch!,
      jobDescription: job.jobDescription!,
      department: job.department,
      expiration: job.expiration!,
      companyName: job.companyName!,
      role:job.role!,
      lpa:job.lpa!,
      driveDate: job.driveDate!,
      driveLink: job.driveLink!,
    }));
//@ts-ignore
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
    //@ts-ignore
    return c.json({ error: "Failed to create jobs", details: error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Handles the removal of a job by its ID.
 *
 * @param c - The context object containing the request and response.
 * @returns A response indicating the success or failure of the job deletion.
 *
 * @throws Returns an error response if the job ID is invalid or if an error occurs during deletion.
 */
export const removejob: AppRouteHandler<RemoveJobRoute> = async (c) => {
  try {
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


/**
 * Handles the display of all drives for staff users.
 * 
 * This route handler verifies the staff session using a JWT token,
 * ensures the user has the "staff" role, and fetches the list of drives
 * from the database. It also clears any existing session cookies for
 * other roles (admin, oauth, student).
 * 
 * @param c - The route context containing request and response objects.
 * @returns A JSON response with the list of drives if successful, or an error message otherwise.
 */
//@ts-ignore
export const displayDrives: AppRouteHandler<DisplayDrivesRoute> = async (c) => {
  deleteCookie(c, "admin_session")
  deleteCookie(c, "oauth_session")
  deleteCookie(c, "student_session")
  const jwtToken = getCookie(c, "staff_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    //@ts-ignore
    staffId = decoded.staff_id;
    //@ts-ignore
    userRole = decoded.role;
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired", success: false }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const drivesList = await db.select().from(drive).execute();
    return c.json({
      success: "Fetched all drives successfully",
      staffId,
      role: userRole,
      drives_list: drivesList,
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};


/**
 * Handles the retrieval of registered students for a specific drive.
 * 
 * This handler verifies the staff session, checks the user's role, and fetches
 * the list of students registered for a particular drive. It enriches the student
 * data with the staff's email from the session before returning the response.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response with the list of registered students or an error message.
 * 
 * Possible HTTP Status Codes:
 * - 200: Successfully fetched the registered students.
 * - 401: Unauthorized access due to missing or invalid session.
 * - 403: Forbidden access due to insufficient role.
 * - 500: Internal server error during database query.
 */
// export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
//   deleteCookie(c, "admin_session")
//   deleteCookie(c, "oauth_session")
//   deleteCookie(c, "student_session")
//   const jwtToken = getCookie(c, "staff_session");

//   if (!jwtToken) {
//     return c.json({ error: "Unauthorized: No session found", success: false }, 401);
//   }

//   let userId = null;
//   let userRole = null;
//   let currentStaffEmail = null; // Rename for clarity

//   try {
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     const decoded = await verify(jwtToken, SECRET_KEY);
//     if (!decoded) throw new Error("Invalid session");
//     userId = decoded.id;
//     userRole = decoded.role;
//     currentStaffEmail = decoded.email; // Email of the logged-in staff
//     if (!currentStaffEmail) throw new Error("Staff email not found in session");
//   } catch (error) {
//     if (error === "TokenExpiredError") {
//       return c.json({ error: "Session expired", success: false }, 401);
//     }
//     console.error("Session Verification Error:", error);
//     return c.json({ error: "Invalid session", success: false }, 401);
//   }

//   if (userRole !== "staff") {
//     return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
//   }

//   try {
//     const { driveId } = c.req.valid("param");
//     const registeredStudentsList = await db
//       .select({
//         applicationId: applications.id,
//         studentName: students.name,
//         email: students.email,
//         cgpa: students.cgpa,
//         batch: students.batch,
//         department: students.department,
//         appliedAt: applications.appliedAt,
//         phoneNumber: students.phoneNumber,
//         noOfArrears: students.noOfArrears,
//         placedStatus: students.placedStatus,
//         staffEmail: staff.email, // Fetch the staff email associated with the student
//       })
//       .from(applications)
//       .innerJoin(students, eq(applications.studentId, students.studentId))
//       .innerJoin(drive, eq(applications.driveId, drive.id))
//       .leftJoin(staff, eq(students.staffId, staff.staffId)) // Join with staff table
//       .where(eq(applications.driveId, driveId))
//       .execute();

//     // Add staffEmail from session to each student
//     const enrichedStudents = registeredStudentsList.map(student => ({
//       ...student,
//       staffEmail, // Add the current staff's email from the session
//     }));

//     return c.json(
//       {
//         success: "Fetched applications successfully",
//         userId,
//         role: userRole,
//         registered_students: registeredStudentsList,
//         currentStaffEmail, // Optionally return the logged-in staff's email
//       },
//       200
//     );
//   } catch (error) {
//     console.error("Database query error:", error);
//     return c.json({ error: "Failed to fetch data", success: false }, 500);
//   }
// };



export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
  deleteCookie(c, "admin_session");
  deleteCookie(c, "oauth_session");
  deleteCookie(c, "student_session");
  const jwtToken = getCookie(c, "staff_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;
  let currentStaffEmail = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    staffId = decoded.staff_id; // Match token structure from loginStaff
    userRole = decoded.role;
    currentStaffEmail = decoded.email;
    if (!currentStaffEmail) throw new Error("Staff email not found in session");
    if (!staffId) throw new Error("Staff ID not found in session");
  } catch (error) {
    console.error("Session Verification Error:", error.message);
    return c.json({ error: "Invalid or expired session", success: false }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const { driveId } = c.req.valid("param");

    // Check if drive exists
    const driveExists = await db
      .select({ id: drive.id })
      .from(drive)
      .where(eq(drive.id, driveId))
      .limit(1)
      .execute();

    if (driveExists.length === 0) {
      return c.json(
        { error: `Drive with ID ${driveId} not found`, success: false },
        404
      );
    }

    const registeredStudentsList = await db
      .select({
        applicationId: applications.id,
        studentName: students.name,
        email: students.email,
        cgpa: students.cgpa,
        batch: students.batch,
        department: students.department,
        appliedAt: applications.appliedAt,
        phoneNumber: students.phoneNumber,
        noOfArrears: students.noOfArrears,
        placedStatus: students.placedStatus,
        staffEmail: staff.email, // Use assigned staff email from DB
      })
      .from(applications)
      .innerJoin(students, eq(applications.studentId, students.studentId))
      .innerJoin(drive, eq(applications.driveId, drive.id))
      .leftJoin(staff, eq(students.staffId, staff.staffId))
      .where(eq(applications.driveId, driveId))
      .execute();
      let staffEmail = null;
    // Add staffEmail from session to each student
    const enrichedStudents = registeredStudentsList.map(student => ({
      ...student,
      staffEmail, // Add the current staff's email from the session
    }));

    return c.json(
      {
        success: "Fetched applications successfully",
        staffId, // Use staffId instead of userId
        role: userRole,
        registered_students: registeredStudentsList, // No overwrite of staffEmail
        currentStaffEmail, // Include for frontend use if needed
      },
      200
    );
  } catch (error) {
    console.error(`Database query error for driveId ${c.req.param("driveId")}:`, error.message, error.stack);
    return c.json(
      { error: "Failed to fetch registered students", details: error.message, success: false },
      500
    );
  }
};
/**
 * Handles the creation of new students by staff members.
 *
 * This function performs the following steps:
 * 1. Deletes existing cookies for admin, OAuth, and student sessions.
 * 2. Verifies the staff session token and extracts staff details.
 * 3. Validates the staff's role and ensures the staff's department is retrieved.
 * 4. Processes the incoming student data, filtering for valid email domains and hashing passwords.
 * 5. Inserts the valid students into the database and returns the created student records.
 *
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response with the created student records or an error message.
 *
 * @throws UnauthorizedError - If the staff session token is missing or invalid.
 * @throws BadRequestError - If the staff ID or department is missing, or no valid students are found.
 */
export const createStudents: AppRouteHandler<CreateStudentsRoute> = async (c) => {
  deleteCookie(c, "admin_session")
  deleteCookie(c, "oauth_session")
  deleteCookie(c, "student_session")
  try {
    const jwtToken = getCookie(c, "staff_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let staffId: string | null = null;
    let staffDepartment: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      staffId = (decoded.staff_id || decoded.id) as string;
      userRole = decoded.role as string;
    } catch (error) {

      return c.json({ error: "Invalid session" }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token" }, 400);
    }

    // Fetch staff department
    const staffDetails = await db
      .select({ department: staff.department })
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .execute();
    staffDepartment = staffDetails[0]?.department;
    if (!staffDepartment) {
      return c.json({ error: "Staff department not found" }, 400);
    }

    const newStudents = c.req.valid("json");
    if (!Array.isArray(newStudents)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "staff") {
      const validStudents = await Promise.all(
        newStudents
          .filter((student) => student.email.endsWith("@saec.ac.in"))
          .map(async (student) => ({
            email: student.email,
            staffId: staffId,
            password: await bcrypt.hash(student.password!, 10),
            department: staffDepartment, // Set to staff's department
            batch: student.batch, // From request body
          }))
      );

      if (validStudents.length === 0) {
        return c.json({ error: "No valid students found with @saec.ac.in domain", success: false }, 400);
      }

      const insertedStudents = await db
        .insert(students)
        .values(validStudents)
        .returning({ studentId: students.studentId, email: students.email, staffId: students.staffId, department: students.department, batch: students.batch });

      const responseStudents = insertedStudents.map(student => ({
        ...student,
        //@ts-ignore
        staffEmail: staffDetails[0].email,
      }));

      return c.json(responseStudents, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};

/**
 * Handles the placement of students by updating their placement status and company information.
 * 
 * @param c - The route handler context containing the request and response objects.
 * 
 * @returns A JSON response indicating the success or failure of the operation.
 * 
 * - If no valid session is found, returns a 401 Unauthorized error.
 * - If the request body is invalid, returns a 400 Bad Request error.
 * - If the user role is not "staff", returns a 403 Forbidden error.
 * - If successful, updates the placement status of students and returns the updated records along with any errors.
 * 
 * @throws Returns a 500 Internal Server Error if an unexpected error occurs during processing.
 */
export const placedstudents: AppRouteHandler<PlacedStudentsRoute> = async (c) => {
  deleteCookie(c, "admin_session")
  deleteCookie(c, "oauth_session")
  deleteCookie(c, "student_session")
  try {
    const jwtToken = getCookie(c, "staff_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }

    let userRole: string | null = null;
    let staffId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      staffId = decoded.staff_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session", success: false }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token", success: false }, 400);
    }

    const { emails, companyName } = c.req.valid("json");
    if (!Array.isArray(emails) || emails.length === 0) {
      return c.json({ error: "Invalid request body: Expected a non-empty array of emails", success: false }, 400);
    }
    if (!companyName) {
      return c.json({ error: "Invalid request body: Company name is required", success: false }, 400);
    }

    if (userRole === "staff") {
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
        } catch (error) {
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
  } catch (error) {
    console.error("Students update error:", error);
    return c.json({ error: "An error occurred", success: false }, 500);
  }
};


/**
 * Handles the bulk upload of students by staff members.
 * 
 * This function performs the following steps:
 * 1. Validates the staff session using a JWT token.
 * 2. Ensures the user has the "staff" role.
 * 3. Parses and validates the request body containing student data.
 * 4. Associates students with the appropriate staff and department.
 * 5. Hashes student passwords before storing them in the database.
 * 6. Checks for duplicate student emails and skips them if they already exist.
 * 7. Inserts new student records into the database.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating success or failure, along with details of inserted and skipped students.
 */
export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
  deleteCookie(c, "admin_session")
  deleteCookie(c, "oauth_session")
  deleteCookie(c, "student_session")
  const jwtToken = getCookie(c, "staff_session");
  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;
  let defaultStaffDepartment = null;
  let defaultStaffEmail = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    //@ts-ignore
    staffId = decoded.staff_id;
    //@ts-ignore
    userRole = decoded.role;
  } catch (error) {
    console.error("5. Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  const staffDetails = await db
    .select({ email: staff.email, department: staff.department })
    .from(staff)
    //@ts-ignore
    .where(eq(staff.staffId, staffId))
    .execute();
    //@ts-ignore
  defaultStaffDepartment = staffDetails[0]?.department;
  //@ts-ignore
  defaultStaffEmail = staffDetails[0]?.email;
  if (!defaultStaffDepartment || !defaultStaffEmail) {
    return c.json({ error: "Staff department or email not found", success: false }, 400);
  }
  let body;
  try {
    body = await c.req.json();
  } catch (error) {
    console.error("11. Error parsing request body:", error);
    return c.json(
      //@ts-ignore
      { error: "Failed to parse request body", success: false, details: error.message },
      400
    );
  }

  if (!body || !Array.isArray(body)) {
    return c.json(
      { error: "Invalid request body: Expected an array", success: false },
      400
    );
  }

  // Extend schema to allow optional staffEmail and department
  const extendedSchema = insertStudentSchema.extend({
    staffEmail: z.string().email().optional(),
    department: z.string().optional(), // Add department as optional
  });

  let validatedData;
  try {
    validatedData = z.array(extendedSchema).parse(body);
  } catch (validationError) {
    console.error("15. Validation Error Raw:", validationError);
    const issues = validationError instanceof z.ZodError ? validationError.issues : [];
    console.error("16. Validation Issues:", issues);
    return c.json(
      {
        error: "Invalid data format",
        details: issues.map((e) => ({
          path: e.path,
          message: e.message,
        })),
        success: false,
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }


  const studentDataPromises = validatedData.map(async (student) => {
    let targetStaffId = staffId;
    let targetStaffEmail = defaultStaffEmail;
    let targetDepartment = student.department || defaultStaffDepartment; // Use provided department or fallback

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(student.password!, 10);

    if (student.staffEmail) {
      const staffRecord = await db
        .select({ staffId: staff.staffId, department: staff.department })
        .from(staff)
        .where(eq(staff.email, student.staffEmail))
        .execute();
      if (staffRecord.length > 0) {
        //@ts-ignore
        targetStaffId = staffRecord[0].staffId;
        //@ts-ignore
        targetStaffEmail = student.staffEmail;
        targetDepartment = student.department as string || staffRecord[0].department as string;
      }
    }

    return {
      email: student.email,
      password: hashedPassword, // Store the hashed password instead of plain text
      staffId: targetStaffId,
      department: targetDepartment,
      batch: student.batch || null,
      staffEmail: targetStaffEmail,
    };
  });

  const studentData = await Promise.all(studentDataPromises);
  try {
    const existingStudents = await db
      .select({ email: students.email })
      .from(students)
      .where(inArray(students.email, studentData.map((s) => s.email)))
      .execute();
    const existingEmails = new Set(existingStudents.map((s) => s.email));

    const newStudents = studentData.filter((student) => !existingEmails.has(student.email));

    if (newStudents.length === 0) {
      return c.json({
        success: true,
        message: "No new students to upload; all emails already exist",
        inserted: [],
        skipped: studentData,
      }, 200);
    }

    const insertedStudents = await db
      .insert(students)
      .values(newStudents.map(({ staffEmail, ...rest }) => rest))
      .returning({
        studentId: students.studentId,
        email: students.email,
        staffId: students.staffId,
        department: students.department,
        batch: students.batch,
      });
    const responseInserted = insertedStudents.map((student) => {
      const matchingStudent = newStudents.find((s) => s.email === student.email);
      return { ...student, staffEmail: matchingStudent?.staffEmail };
    });
    const responseSkipped = studentData
      .filter((student) => existingEmails.has(student.email))
      .map((student) => ({ ...student }));

    return c.json({
      success: true,
      message: `Inserted ${insertedStudents.length} students, skipped ${responseSkipped.length} duplicates`,
      inserted: responseInserted,
      skipped: responseSkipped,
    }, 200);
  } catch (error) {
    //@ts-ignore
    if (error.code === "23505") {
      return c.json(
        {
          error: "Some emails already exist in the database",
          success: false,
          //@ts-ignore
          details: error.detail,
        },
        409
      );
    }
    return c.json({ error: "Failed to upload students", success: false }, 500);
  }
};


/**
 * Handles the password update process for staff members.
 * 
 * This function performs the following steps:
 * 1. Deletes existing session cookies.
 * 2. Verifies the staff session token.
 * 3. Validates the provided old password.
 * 4. Updates the password with a new hashed password.
 * 
 * @param c - The route handler context containing the request and response.
 * @returns A JSON response indicating success or failure of the operation.
 */
//@ts-ignore
export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  try {
    deleteCookie(c, "student_session")
    deleteCookie(c, "admin_session")
    deleteCookie(c, "oauth_session")
    const jwtToken = getCookie(c, "staff_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }

    let staffId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      staffId = decoded.staff_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session", success: false }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token", success: false }, 400);
    }

    const { oldPassword, newPassword } = c.req.valid("json");

    const staffQuery = await db
      .select()
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .limit(1)
      .execute();

    const staffy = staffQuery[0];
    if (!staffy) {
      return c.json({ error: "Staff not found", success: false }, 404);
    }

    // Fixed: Compare plaintext oldPassword with stored hash
    const passwordMatches = await bcrypt.compare(oldPassword, staffy.password!);
    if (!passwordMatches) {
      return c.json({ error: "Incorrect old password", success: false }, 401);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(staff)
      .set({ password: hashedNewPassword })
      .where(eq(staff.staffId, staffId));

    return c.json({ message: "Password updated successfully", success: true }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Password update error:", error);
    return c.json({ error: "Something went wrong", success: false }, 500);
  }
};

/**
 * Handles the retrieval of a single staff member's details and associated data.
 * 
 * - Verifies the staff session using a JWT token.
 * - Ensures the user has the "staff" role.
 * - Fetches staff details from the database.
 * - Retrieves all students in the staff's department, grouped by department and batch.
 * - Filters and groups students added by the staff, grouped by batch.
 * - Fetches the list of job drives.
 * 
 * @param c - The route handler context.
 * @returns A JSON response containing staff details, students, and job drives, or an error message.
 */

//@ts-ignore
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  deleteCookie(c, "student_session")
  deleteCookie(c, "admin_session")
  deleteCookie(c, "oauth_session")
  const jwtToken = getCookie(c, "staff_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    //@ts-ignore
    staffId = (decoded.staff_id || decoded.id) as string;
    //@ts-ignore
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    //@ts-ignore
    return c.json({ error: `Invalid session: ${error.message}` }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const staff_details = await db
      .select({
        staffId: staff.staffId,
        email: staff.email,
        name: staff.name,
        department: staff.department,
      })
      .from(staff)
      //@ts-ignore
      .where(eq(staff.staffId, staffId))
      .execute();
    if (staff_details.length === 0) {
      return c.json({ error: `Staff not found for staffId: ${staffId}` }, 404);
    }

    const staffEmail = staff_details[0].email;
    const staffDepartment = staff_details[0].department;
    if (!staffDepartment) {
      return c.json({ error: `Staff department not set for staffId: ${staffId}` }, 400);
    }

    // Fetch all students in the staff's department
    const allStudents = await db
      .select({
        studentId: students.studentId,
        email: students.email,
        staffEmail: staff.email,
        department: students.department,
        batch: students.batch,
        staffId: students.staffId,
        regNo: students.regNo,
        placedStatus: students.placedStatus,
        name: students.name,
        phoneNumber: students.phoneNumber,
        cgpa: students.cgpa,
        tenthMark: students.tenthMark,
        twelfthMark: students.twelfthMark,
        arrears: students.noOfArrears,
        companyPlacedIn: students.companyPlacedIn,
        rollNo: students.rollNo,
        SkillSet: students.skillSet,
        languageKnown: students.languagesKnown,
        linkdinUrl: students.linkedinUrl,
        githubUrl: students.githubUrl,
      })
      .from(students)
      .leftJoin(staff, eq(students.staffId, staff.staffId))
      .where(eq(students.department, staffDepartment))
      .execute();

    // Group all students by department and batch
    const allStudentsByDeptAndBatch = allStudents.reduce((acc, student) => {
      const dept = student.department || "Unknown";
      const batch = student.batch || "Unknown";
      if (!acc[dept]) acc[dept] = {};
      acc[dept][batch] = [...(acc[dept][batch] || []), student];
      return acc;
    }, {});

    // Filter and group students added by this staff
    const yourStudents = allStudents.filter((student) => student.staffId === staffId);
    const yourStudentsByBatch = yourStudents.reduce((acc, student) => {
      const batch = student.batch || "Unknown";
      acc[batch] = [...(acc[batch] || []), student];
      return acc;
    }, {});

    const jobList = await db.select().from(drive).execute();

    return c.json({
      success: "Authorization successful",
      staffId,
      role: userRole,
      staffEmail, // Added
      staffDepartment, // Added
      staff: staff_details[0],
      allStudents: allStudentsByDeptAndBatch, // Grouped by department and batch
      yourStudents: yourStudentsByBatch, // Grouped by batch
      drives: jobList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

/**
 * Handles the creation of group mail entries for staff members.
 * 
 * @param c - The route handler context.
 * @returns A JSON response indicating the result of the operation.
 * 
 * - Deletes existing session cookies for students, admins, and OAuth.
 * - Verifies the staff session using a JWT token.
 * - Validates the request body to ensure it contains an array of email addresses.
 * - Filters and cleans the email list to include only valid `@saec.ac.in` domain emails.
 * - Inserts the valid emails into the database.
 * 
 * @throws 401 - If no session is found or the session is invalid.
 * @throws 403 - If the user is not authorized (not a staff member).
 * @throws 400 - If the request format is invalid or no valid emails are provided.
 * @throws 500 - If a server error occurs during processing.
 */
export const FeedGroupMail: AppRouteHandler<FeedGroupMailRoute> = async (c) => {
  try {
    deleteCookie(c, "student_session");
    deleteCookie(c, "admin_session");
    deleteCookie(c, "oauth_session");

    const jwtToken = getCookie(c, "staff_session");
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

    if (userRole !== "staff") return c.json({ error: "Unauthorized" }, 403);

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
 * Handles the retrieval of group mail list for staff users.
 *
 * This handler performs the following steps:
 * 1. Deletes any existing cookies for student, admin, and OAuth sessions.
 * 2. Retrieves and verifies the staff session JWT token.
 * 3. Ensures the user has the "staff" role.
 * 4. Fetches the list of group emails from the database.
 *
 * @param c - The route context containing request and response objects.
 * @returns A JSON response containing the group mail list or an error message.
 */
export const getFeedGroupMail: AppRouteHandler<GetFeedGroupMailRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
  deleteCookie(c, "oauth_session");
  const jwtToken = getCookie(c, "staff_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    // @ts-ignore
    staffId = decoded.staff_id;
    // @ts-ignore
    userRole = decoded.role;
    console.log(jwtToken)
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired", success: false }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
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
 * Logs out a staff member by deleting their session cookie.
 *
 * @param c - The route handler context.
 * @returns A JSON response indicating the result of the logout operation.
 */

//@ts-ignore
export const logoutStaff: AppRouteHandler<LogoutStaffRoute> = async (c) => {
  const jwtoken = getCookie(c, "staff_session")
  if (!jwtoken) {
    return c.json({ error: "No session found" }, 401);
  } else {
    deleteCookie(c, "staff_session");
  }
  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};



/**
 * Handles the forgot password functionality for staff users.
 *
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response indicating the success or failure of the password reset email operation.
 */
//@ts-ignore
export const forgotPassword: AppRouteHandler<ForgotPassword> = async (c) => {
  try {
    //@ts-ignore
    const { email }  = c.req.valid("json");
    const supabase = c.get("supabase");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:5173/staff/reset-password`,
    });

    if (error) {
      console.error("Supabase Forgot Password Error:", error);
      return c.json({ error: error.message, success: false }, 400);
    }

    return c.json({ message: "Password reset email sent", success: true }, 200);
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return c.json({ error: "Something went wrong", success: false }, 500);
  }
};

/**
 * Handles the password reset functionality for staff users.
 *
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response indicating the success or failure of the password reset operation.
 *
 * - Validates the presence of `token` and `newPassword` in the request body.
 * - Decodes the token to extract the user's email.
 * - Hashes the new password and updates the user's password in the database.
 * - Returns appropriate HTTP status codes and messages based on the operation's outcome.
 */

//@ts-ignore
export const resetPassword: AppRouteHandler<ResetPassword> = async (c) => {
  try {
    const { token, newPassword } = c.req.valid("json");
    if (!token || !newPassword) {
      console.error('Missing token or password');
      return c.json({ error: 'Missing token or password' }, 400);
    }
    const decodedToken = decode(token);
    if (!decodedToken || !decodedToken.payload.email) {
      console.error('Invalid token or missing email');
      return c.json({ error: 'Invalid token or expired link' }, 401);
    }
    const userEmail = decodedToken.payload.email;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    //@ts-ignore
    const updatedRows = await db
      .update(staff)
      .set({ password: hashedPassword })
      // @ts-ignore
      .where(eq(staff.email, userEmail))
      .returning();
    return c.json({ message: 'Password reset successfully' }, 200);
  } catch (error) {
    console.error('Internal server error:', error);
    return c.json({ error: 'Something went wrong' }, 500);
  }
};

/**
 * Handles the creation of events by staff members.
 * 
 * This function performs the following steps:
 * 1. Deletes any existing session cookies for students, admins, and OAuth.
 * 2. Validates the staff session using a JWT token.
 * 3. Initializes the Supabase client if not already available.
 * 4. Verifies the session token and extracts the staff ID.
 * 5. Validates and parses the incoming event data from the request body.
 * 6. Handles optional file uploads for event posters and retrieves the public URL.
 * 7. Inserts the new event into the database.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response with the created event or an error message.
 */
export const createevents: AppRouteHandler<CreateEventsRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
  deleteCookie(c, "oauth_session");
  try {
    // Session validation
    const jwtToken = getCookie(c, "staff_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
    }
    // Initialize Supabase
    let supabase = c.get("supabase");
    if (!supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.");
      }
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    // Verify session token
    const SECRET_KEY = process.env.SECRET_KEY!;
    let staffId: string;

    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.staff_id) {
        return c.json({ error: "Invalid session: Staff ID missing" }, HttpStatusCodes.UNAUTHORIZED);
      }
      staffId = decoded.staff_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
    }
    // Validate and parse the request body
    const eventData = c.req.valid("json");
    if (!eventData || typeof eventData !== "object") {
      return c.json({ error: "Invalid event data" }, HttpStatusCodes.BAD_REQUEST);
    }
    let posterUrl = eventData.url; // Use existing URL if provided
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
      // Get public URL
      posterUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
    }
    // Create event in the database
    const newEvent = {
      event_name: eventData.event_name,
      event_link: eventData.event_link,
      date: eventData.date,
      url: posterUrl || null,
    };
    const insertedEvent = await db
      .insert(events)
      //@ts-ignore
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