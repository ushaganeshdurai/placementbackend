import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { decode } from 'hono/jwt';
import db from "@/db";
import bcrypt from 'bcryptjs';
import type { ApplyForDriveRoute, DisplayDrivesRoute, GetOneRoute, LoginStudentRoute, UpdatePasswordRoute, RegStudentRoute, ForgotPassword, ResetPassword, UpdateResumeRoute, RemoveApplicationRoute, CheckApplicationStatusRoute, LogoutStudentRoute, GetResumeRoute } from "./student.routes";
import { students, applications, drive, staff } from "drizzle/schema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { createClient } from "@supabase/supabase-js";

/**
 * Handles the login process for a student.
 * 
 * - Clears any existing "staff_session" and "admin_session" cookies.
 * - Validates the provided email and password against the database.
 * - Generates a JWT session token for the authenticated student.
 * - Sets a "student_session" cookie with the generated token.
 * - Redirects the student to the "/student" page upon successful login.
 * 
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response with an error message and status code if authentication fails,
 *          or a redirection to the "/student" page upon success.
 */
export const loginStudent: AppRouteHandler<LoginStudentRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  const { email, password } = c.req.valid("json");

  const queryStudent = await db
    .select()
    .from(students)
    .where(eq(students.email, email))
    .limit(1)
    .execute();

  if (queryStudent.length === 0) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const queried_student = queryStudent[0];
  const isPasswordValid = await bcrypt.compare(password, queried_student.password!);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (!queried_student.studentId) {
    return c.json({ error: "Student ID not found for this student" }, 500);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const payload = {
    student_id: queried_student.studentId, // Consistent key
    role: "student",
    email: queried_student.email,
  };
  const sessionToken = await sign(payload, SECRET_KEY);
  console.log('Generated JWT:', sessionToken);

  setCookie(c, "student_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/student", 302);
};

/**
 * Handles the retrieval of a single student's details based on their session token.
 * 
 * This function performs the following steps:
 * 1. Deletes any existing admin or staff session cookies.
 * 2. Retrieves the student's session token from cookies.
 * 3. Verifies the session token and extracts the student ID and role.
 * 4. Ensures the user has the "student" role.
 * 5. Fetches the student's details from the database using the student ID.
 * 
 * @param c - The route context containing the request and response objects.
 * @returns A JSON response with the student's details if authorized, or an error message with the appropriate HTTP status code.
 */
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  deleteCookie(c, "admin_session");
  deleteCookie(c, "staff_session");
  const studentSessionToken = getCookie(c, "student_session");
  const oauthSessionToken = getCookie(c, "oauth_session");
  const jwtToken = studentSessionToken || oauthSessionToken;
  if (!jwtToken) {
    console.log('No session token found in cookies');
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }
  let studentId = null;
  let userRole = null;
  const isOAuthLogin = !!oauthSessionToken;
  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) {
      return c.json({ error: "Invalid session: No payload" }, 401);
    }
    studentId = decoded.student_id; // Prioritize student_id
    userRole = decoded.role;
    if (!studentId) {
      return c.json({ error: "Invalid session: Student ID missing" }, 401);
    }
  } catch (error) {
    console.error("Session Verification Error:", error.message);
    return c.json({ error: "Invalid session: Token verification failed" }, 401);
  }
  if (userRole !== "student") {
    console.log('Role mismatch - Expected: student, Got:', userRole);
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }
  try {
    const student_details = await db
      .select({
        email: students.email,
        studentId: students.studentId,
        name: students.name,
      })
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1)
      .execute();
    if (student_details.length === 0) {
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json({
      success: "Authorization successful",
      studentId: student_details[0].studentId,
      role: userRole,
      student: student_details[0],
    }, 200);
  } catch (error) {
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

/**
 * Handles student registration.
 *
 * This function performs the following steps:
 * - Deletes any existing admin or staff session cookies.
 * - Validates the provided email to ensure it belongs to the "@saec.ac.in" domain.
 * - Checks if the student is already registered.
 * - Verifies the existence of the provided staff email.
 * - Hashes the student's password and stores the new student record in the database.
 * - Generates a session token for the student and sets it as a cookie.
 * - Redirects the student to the "/student" page upon successful registration.
 *
 * @param c - The context object containing the request and response.
 * @returns A JSON response or a redirection to the student page.
 */
export const registration: AppRouteHandler<RegStudentRoute> = async (c) => {
  try {
    deleteCookie(c, "admin_session");
    deleteCookie(c, "staff_session");

    const SECRET_KEY = process.env.SECRET_KEY!;
    const { email, password, staffEmail } = c.req.valid("json");

    if (!email.endsWith("@saec.ac.in")) {
      return c.json({ error: "Invalid email domain, must be @saec.ac.in" }, HttpStatusCodes.BAD_REQUEST);
    }

    const existingStudent = await db.select().from(students).where(eq(students.email, email)).limit(1);
    if (existingStudent.length > 0) {
      return c.json({ error: "Student already registered" }, HttpStatusCodes.CONFLICT);
    }

    const staffy = await db.select().from(staff).where(eq(staff.email, staffEmail)).limit(1);
    if (staffy.length === 0) {
      return c.json({ error: "Staff email not found" }, HttpStatusCodes.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = await db.insert(students).values({
      email,
      password: hashedPassword,
      staffId: staffy[0].staffId,
    }).returning();

    const sessionToken = await sign({
      student_id: newStudent[0].studentId,
      role: "student",
      email: newStudent[0].email,
    }, SECRET_KEY);

    setCookie(c, "student_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });

    return c.redirect("/student", HttpStatusCodes.MOVED_TEMPORARILY);
  } catch (error) {
    console.error("Student registration error:", error);
    return c.json({ error: "Internal server error" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Handles the retrieval of a student's resume details.
 * 
 * This function verifies the student's session using a JWT token, checks the user's role,
 * and fetches the student's details from the database. If the session is invalid, the user
 * is unauthorized, or the student is not found, appropriate error responses are returned.
 * 
 * @param c - The context object containing request and response details.
 * @returns A JSON response containing the student's details or an error message.
 *
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response indicating the result of the application process.
 *
 * - If no session is found, returns an unauthorized error.
 * - If the session is invalid or missing a student ID, returns an unauthorized error.
 * - If the drive ID is missing in the request, returns a bad request error.
 * - If the student has already applied for the drive, returns a success message indicating so.
 * - If the application is successful, returns a success message.
 * - If an error occurs during the process, returns an internal server error.
 */
export const applyForDrive: AppRouteHandler<ApplyForDriveRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
    }
    let studentId = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
      }
      studentId = decoded.student_id;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
    }
    const { id } = c.req.valid("json");
    if (!id) {
      return c.json({ error: "Missing drive ID" }, HttpStatusCodes.BAD_REQUEST);
    }
    const existingApplication = await db
      .select()
      .from(applications)
      .where(and(eq(applications.studentId, studentId), eq(applications.driveId, id)))
      .limit(1)
      .execute();
    if (existingApplication.length > 0) {
      return c.json({ message: "You have already applied for this drive" }, HttpStatusCodes.OK);
    }
    await db.insert(applications).values({
      studentId,
      driveId: id,
      appliedAt: new Date().toISOString(),
    });
    return c.json({ message: "Applied successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Application error:", error);
    return c.json({ error: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Handles the password update process for a student.
 * 
 * This function verifies the student's session, checks the validity of the old password,
 * and updates the password to a new one if all conditions are met.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating success or failure of the password update operation.
 */
export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  try {
    deleteCookie(c, "staff_session")
    deleteCookie(c, "admin_session")
    const jwtToken = getCookie(c, "student_session") ;
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }

    let studentId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");

      studentId = decoded.student_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session", success: false }, 401);
    }

    if (!studentId) {
      return c.json({ error: "Student ID missing from token", success: false }, 400);
    }

    const { oldPassword, newPassword } = c.req.valid("json");

    const studentQuery = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1)
      .execute();

    const student = studentQuery[0];

    if (!student) {
      return c.json({ error: "Staff not found", success: false }, 404);
    }

    const passwordMatches = await bcrypt.compare(student.password!, oldPassword);
    if (!passwordMatches) {
      return c.json({ error: "Incorrect old password", success: false }, 401);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(students)
      .set({ password: hashedNewPassword })
      .where(eq(students.studentId, studentId));

    return c.json({ message: "Password updated successfully", success: true }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Password update error:", error);
    return c.json({ error: "Something went wrong", success: false }, 500);
  }
};

/**
 * Handles the removal of a student's application for a specific drive.
 * 
 * - Deletes cookies for staff and admin sessions.
 * - Verifies the student's session using a JWT token.
 * - Deletes the application record from the database if it exists.
 * 
 * @param c - The route handler context.
 * @returns A JSON response indicating success or failure of the operation.
 */
export const removeApplication: AppRouteHandler<RemoveApplicationRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");

  const jwtToken = getCookie(c, "student_session");
  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let studentId = null;
  const SECRET_KEY = process.env.SECRET_KEY!;
  try {
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
    }
    studentId = decoded.student_id;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid("json");
  const deleted = await db
    .delete(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.driveId, id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Application not found" }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: "Application removed successfully" }, HttpStatusCodes.OK);
};

/**
 * Handles the check for a student's application status for a specific drive.
 * 
 * This function verifies the student's session using a JWT token, retrieves the student ID,
 * and checks if the student has applied for the specified drive.
 * 
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating whether the student has applied (`applied: boolean`).
 *          Returns an error response if the session is invalid or unauthorized.
 */
export const checkApplicationStatus: AppRouteHandler<CheckApplicationStatusRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");

  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let studentId = null;
  const SECRET_KEY = process.env.SECRET_KEY!;
  try {
    const decoded = await verify(jwtToken, SECRET_KEY);
    console.log("JWT Decoded:", decoded);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
    }
    studentId = decoded.student_id;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { driveId } = c.req.param();
  const existingApplication = await db
    .select()
    .from(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.driveId, parseInt(driveId))))
    .limit(1)
    .execute();
  const applied = existingApplication.length > 0;
  return c.json({ applied }, HttpStatusCodes.OK);
};
/**
 * Logs out a student by deleting their session cookie.
 *
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating the logout status.
 */
export const logoutStudent: AppRouteHandler<LogoutStudentRoute> = async (c) => {
  const jwtoken = getCookie(c, "student_session")
  if (!jwtoken) {
    return c.json({ error: "No session found" }, 401);
  } else {
    deleteCookie(c, "student_session");
  }
  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};
/**
 * Handles the forgot password functionality for students.
 * 
 * @param c - The context object containing the request and other utilities.
 * @returns A JSON response indicating success or failure of the password reset email process.
 */
export const forgotPassword: AppRouteHandler<ForgotPassword> = async (c) => {
  try {
    const { email } = c.req.valid("json");
    const supabase = c.get("supabase");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:5173/student/reset-password`,
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
 * Handles the password reset functionality for a student.
 *
 * @param c - The route handler context containing the request and response objects.
 * @returns A JSON response indicating the success or failure of the password reset operation.
 *
 * - Validates the presence of a token and new password in the request body.
 * - Decodes the token to extract the user's email.
 * - Hashes the new password and updates the student's record in the database.
 * - Returns appropriate HTTP status codes and messages for success or error scenarios.
 */
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
    const updatedRows = await db
      .update(students)
      .set({ password: hashedPassword })
      .where(eq(students.email, userEmail))
      .returning();
    return c.json({ message: 'Password reset successfully' }, 200);
  } catch (error) {
    console.error('Internal server error:', error);
    return c.json({ error: 'Something went wrong' }, 500);
  }
};

/**
 * Updates the resume details of a student.
 *
 * @param c - The route handler context.
 * @returns A JSON response indicating success or failure.
 *
 * - If the student session is invalid or missing, returns a 401 Unauthorized error.
 * - If the update data is invalid, returns a 400 Bad Request error.
 * - If the file upload fails, returns a 500 Internal Server Error.
 * - If the student is not found, returns a 404 Not Found error.
 * - If the user role is not "student", returns a 403 Forbidden error.
 * - On success, returns the updated resume details with a 200 OK status.
 */
export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "student_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let supabase = c.get("supabase");
    if (!supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.");
      }
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    const SECRET_KEY = process.env.SECRET_KEY!;
    let studentId: string;
    let userRole: string;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id as string;
      userRole = decoded.role as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }
    const updateData = c.req.valid("json");
    if (!updateData || typeof updateData !== "object") {
      return c.json({ error: "Invalid update details" }, 400);
    }
    let resumeUrl = updateData.url; // Extract existing URL if provided
    if (updateData.file) {
      if (typeof updateData.file !== "string") {
        return c.json({ error: "Invalid file: Must be a base64-encoded string" }, 400);
      }
      const fileBuffer = Buffer.from(updateData.file, "base64");
      const fileName = updateData.fileName
        ? `uploads/${Date.now()}_${updateData.fileName}`
        : `uploads/${Date.now()}_profile-pic`;

      const { data, error } = await supabase.storage
        .from("bucky")
        .upload(fileName, fileBuffer, {
          contentType: updateData.fileType || "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });
      if (error) {
        console.error("Supabase Upload Error:", error);
        return c.json({ error: `File upload failed: ${error.message}` }, 500);
      }

      resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
      console.log("Uploaded file URL:", resumeUrl);
    }

    if (userRole === "student") {
      const resumeDetails = {
        ...updateData,
        ...(resumeUrl !== undefined && { url: resumeUrl }), // Override url with new value if file was uploaded
      };

      const updatedResume = await db
        .update(students)
        .set(resumeDetails)
        .where(eq(students.studentId, studentId))
        .returning();

      if (updatedResume.length === 0) {
        return c.json({ error: "Student not found" }, 404);
      }

      return c.json(updatedResume[0], HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Resume update error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};

/**
 * Handles the display of available drives for a student.
 * 
 * This route verifies the student's session using a JWT token, checks the user's role,
 * and fetches the list of drives from the database if the user is authorized.
 * 
 * @param c - The route context containing request and response objects.
 * @returns A JSON response with the list of drives or an error message.
 * 
 * Possible Responses:
 * - 200: Successfully fetched all drives.
 * - 401: Unauthorized due to missing or invalid session.
 * - 403: Unauthorized due to insufficient role.
 * - 500: Internal server error during database query.
 */
export const displayDrives: AppRouteHandler<DisplayDrivesRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  const jwtToken = getCookie(c, "student_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let studentId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing", success: false }, 401);
    }
    studentId = decoded.student_id;
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }
  if (userRole !== "student") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }
  try {
    const drivesList = await db.select().from(drive).execute();
    return c.json({
      success: "Fetched all drives successfully",
      studentId,
      role: userRole,
      drives_list: drivesList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};


/**
 * Handles the display of resume for a student.
 */

export const getResume: AppRouteHandler<GetResumeRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") ;
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId = null;
    let userRole = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (userRole !== "student") {
      return c.json({ error: "Unauthorized: Insufficient role" }, 403);
    }

    const studentDetails = await db
      .select({
        name: students.name,
        email: students.email,
        phoneNumber: students.phoneNumber,
        regNo: students.regNo,
        department: students.department,
        tenthMark: students.tenthMark,
        twelfthMark: students.twelfthMark,
        cgpa: students.cgpa,
        noOfArrears: students.noOfArrears,
        skillSet: students.skillSet,
        languagesKnown: students.languagesKnown,
        url:students.url,
        linkedinUrl: students.linkedinUrl,
        githubUrl: students.githubUrl,
        batch: students.batch,
      })
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1)
      .execute();

    if (studentDetails.length === 0) {
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(studentDetails[0], HttpStatusCodes.OK);
  } catch (error) {
    console.error("Resume fetch error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};
