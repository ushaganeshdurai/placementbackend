import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { GetOneRoute, LoginStudentRoute } from "./student.routes";
import { staff, students } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";


// login the student
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
  const sessionToken = await sign({ id: queried_student.studentId, role: "student" }, SECRET_KEY);
  console.log("Context:", c);
  // Set cookie with proper options
  setCookie(c, "student_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production", // Secure only in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });

  return c.redirect("/student", 302)
};


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let studentId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    studentId = decoded.id;
    userRole = decoded.role;
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
      .select()
      .from(students)
      .where(eq(students.studentId, String(studentId))) 
      .limit(1)
      .execute();

    //get only one student's details
    return c.json({
      success: "Authorization successful",
      studentId,
      role: userRole,
      student: student_details[0],
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};
