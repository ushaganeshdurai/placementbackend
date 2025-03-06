import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { CreateResumeRoute, GetOneRoute, LoginStudentRoute, UpdatePasswordRoute } from "./student.routes";
import { students } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

// Login the student
export const loginStudent: AppRouteHandler<LoginStudentRoute> = async (c) => {
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

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: queried_student.userId, role: "student", email: queried_student.email }, SECRET_KEY);

  setCookie(c, "student_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/student", 302);
};

// Get student data
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id; // Matches user.id from OAuth
    userRole = decoded.role;
    console.log('JWT Token Decoded:', decoded);
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "student") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const student_details = await db
      .select({
        email: students.email,
        studentId: students.studentId,
        name: students.name, // Optional
      })
      .from(students)
      .where(eq(students.userId, String(userId))) // Use userId instead of studentId
      .limit(1)
      .execute();

    console.log('Fetched student details:', student_details);

    if (student_details.length === 0) {
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json({
      success: "Authorization successful",
      studentId: student_details[0].studentId,
      role: userRole,
      student: student_details[0], // Includes email
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

export const resumedetails: AppRouteHandler<CreateResumeRoute> = async (c) => {
  try {
    // Get JWT Token from cookies
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let studentId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      studentId = decoded.student_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!studentId) {
      return c.json({ error: "Student ID missing from token" }, 400);
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
        tengthMark: resume.tenthMark,
        cgpa: resume.cgpa,
        year: resume.year,
        department: resume.department,
        twelfthMark: resume.twelfthMark
      };

      console.log("Student ID being used:", studentId);

      // Insert into database
      const updatedResume = await db.update(students)
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





//Toodo:udpate pasowrd


export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  try {
    // Get JWT Token from cookies
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");

      studentId = decoded.student_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!studentId) {
      return c.json({ error: "Student ID missing from token" }, 400);
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
