import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { CreateStudentsRoute, GetOneRoute, LoginStaffRoute, RemoveStudentRoute } from "./staff.routes";
import { staff, students } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";


// login the admin
export const loginStaff: AppRouteHandler<LoginStaffRoute> = async (c) => {
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
  const sessionToken = await sign({ id: queried_staff.staffId, role: "staff" }, SECRET_KEY);
  console.log("Context:", c);
  // Set cookie with proper options
  setCookie(c, "staff_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production", // Secure only in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });

  return c.redirect("/staff", 302)
};


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const staff_details = await db.select().from(staff).execute();
    //TODO: get only one staff details not the entire array

    //TODO: check if for all : encrypt the password 
    // const studentList = await db.select().from(students).execute();

    return c.json({
      success: "Authorization successful",
      userId,
      role: userRole,
      staff: staff_details,
      // students: studentList
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};



//Add Student
export const createStudents: AppRouteHandler<CreateStudentsRoute> = async (c) => {
  try {
    const newStudents = c.req.valid('json');
    if (!Array.isArray(newStudents)) {
      return c.json([], HttpStatusCodes.OK);
    }
    const insertedStudents = await db.insert(students).values(newStudents).returning();
    return c.json(insertedStudents, HttpStatusCodes.OK);

  } catch (error) {
    console.error('Staff creation error:', error);
    return c.json([], HttpStatusCodes.OK);
  }
};


//Remove Student

export const removeStudent: AppRouteHandler<RemoveStudentRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");

    const result = await db.delete(students)
      .where(eq(students.studentId, id));

    if (result.length === 0) {
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
        message: 'Invalid student ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};
