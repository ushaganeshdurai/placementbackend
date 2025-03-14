import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs';
import type { ApplyForDriveRoute, CreateResumeRoute, DisplayDrivesRoute, GetOneRoute, LoginStudentRoute, UpdatePasswordRoute } from "./student.routes";
import { students, applications, drive } from "drizzle/schema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";


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
    id: queried_student.userId, // Use userId if present, else studentId
    student_id: queried_student.studentId, // Always include student_id for manual login
    role: "student",
    email: queried_student.email,
  };
  console.log('JWT Payload:', payload); // Debug: Verify id and student_id
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

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  // Clear irrelevant session cookies
  deleteCookie(c, "admin_session");
  deleteCookie(c, "staff_session");

  // Retrieve the session token from cookies
  const studentSessionToken = getCookie(c, "student_session");
  const oauthSessionToken = getCookie(c, "oauth_session");
  const jwtToken = studentSessionToken || oauthSessionToken;
  console.log('Received student_session:', studentSessionToken); // Debug: Manual login token
  console.log('Received oauth_session:', oauthSessionToken); // Debug: OAuth login token

  if (!jwtToken) {
    console.log('No session token found in cookies');
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let studentId = null;
  let userId = null;
  let userRole = null;
  const isOAuthLogin = !!oauthSessionToken; // True if oauth_session is present

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    console.log('Decoded JWT Payload:', decoded); // Debug: Inspect full payload

    if (!decoded) {
      console.log('JWT decoding returned no payload');
      return c.json({ error: "Invalid session: No payload" }, 401);
    }

    userId = decoded.id; // Always expect id (userId) to be present
    userRole = decoded.role;

    if (!userId) {
      console.log('JWT missing id field');
      return c.json({ error: "Invalid session: User ID missing" }, 401);
    }

    // Differentiate validation based on login type
    if (isOAuthLogin) {
      // OAuth login: Only check userId (id), student_id is optional
      console.log('OAuth login detected, validating userId:', userId);
    } else {
      // Manual login: Require student_id
      studentId = decoded.student_id;
      if (!studentId) {
        console.log('Manual login detected, but student_id is missing');
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      console.log('Manual login detected, validating studentId:', studentId);
    }

    console.log('Extracted from JWT - userId:', userId, 'studentId:', studentId, 'role:', userRole);
  } catch (error) {
    console.error("Session Verification Error:", error.message);
    return c.json({ error: "Invalid session: Token verification failed" }, 401);
  }

  if (userRole !== "student") {
    console.log('Role mismatch - Expected: student, Got:', userRole);
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    // Use studentId for manual login, userId for OAuth if studentId is absent
    const lookupId = studentId || userId;
    const lookupField = studentId ? students.studentId : students.userId;

    const student_details = await db
      .select({
        email: students.email,
        studentId: students.studentId,
        name: students.name, // Optional
      })
      .from(students)
      .where(eq(lookupField, lookupId))
      .limit(1)
      .execute();

    console.log('Fetched student details from DB:', student_details);

    if (student_details.length === 0) {
      console.log('No student found in DB for', studentId ? 'studentId' : 'userId', lookupId);
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json({
      success: "Authorization successful",
      studentId: student_details[0].studentId || null, // May be null for OAuth
      userId: userId, // Include userId for consistency
      role: userRole,
      student: student_details[0], // Includes email
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};


export const getResume: AppRouteHandler<GetResumeRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId = null;
    let userRole = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded || !decoded.student_id) { // Check student_id instead of id
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id; // Use student_id from JWT
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

export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.id; // Use `id` as studentId
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
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
      return c.json({ error: "Student not found" }, 404);
    }

    const passwordMatches = await bcrypt.compare(student.password!, oldPassword);
    if (!passwordMatches) {
      return c.json({ error: "Incorrect old password" }, 401);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(students)
      .set({ password: hashedNewPassword })
      .where(eq(students.studentId, studentId));

    return c.json({ message: "Password updated successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Password update error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};

export const displayDrives: AppRouteHandler<DisplayDrivesRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let studentId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.id) {
      return c.json({ error: "Invalid session: Student ID missing", success: false }, 401);
    }
    studentId = decoded.id; // Use `id` as studentId
    userRole = decoded.role;
    console.log('JWT Token Decoded:', decoded);
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


export const resumedetails: AppRouteHandler<CreateResumeRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId: string | null = null;
    let userRole: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded || !decoded.id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const resume = c.req.valid("json");
    if (!resume || typeof resume !== "object") {
      return c.json({ error: "Invalid resume details" }, 400);
    }

    if (userRole === "student") {
      const resumeDetails = {
        phoneNumber: resume.phoneNumber,
        skillSet: resume.skillSet,
        noOfArrears: resume.noOfArrears,
        languagesKnown: resume.languagesKnown,
        githubUrl: resume.githubUrl,
        linkedinUrl: resume.linkedinUrl,
        tenthMark: resume.tenthMark,
        cgpa: resume.cgpa,
        batch: resume.batch,
        department: resume.department,
        twelfthMark: resume.twelfthMark,
      };

      const updatedResume = await db
        .update(students)
        .set(resumeDetails)
        .where(eq(students.studentId, studentId))
        .returning();

      return c.json(updatedResume, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Resume creation error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};


export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId: string = null;
    let userRole: string = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.id || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id || decoded.id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const updateData = c.req.valid("json");
    if (!updateData || typeof updateData !== "object") {
      return c.json({ error: "Invalid update details" }, 400);
    }

    if (userRole === "student") {
      const updatedResume = await db
        .update(students)
        .set(updateData)
        .where(eq(students.studentId, studentId))
        .returning();

      return c.json(updatedResume[0], HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Resume update error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};


export const applyForDrive: AppRouteHandler<ApplyForDriveRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
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
      studentId = decoded.student_id as string; // Use `student_id` from JWT
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








export const removeApplication: AppRouteHandler<RemoveApplicationRoute> = async (c) => {
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
  console.log(`Checking application - studentId: ${studentId}, driveId: ${driveId}`);
  const existingApplication = await db
    .select()
    .from(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.driveId, parseInt(driveId))))
    .limit(1)
    .execute();
  console.log("Query Result:", existingApplication);

  const applied = existingApplication.length > 0;
  console.log(`Result for drive ${driveId}: applied = ${applied}`);
  return c.json({ applied }, HttpStatusCodes.OK);
};