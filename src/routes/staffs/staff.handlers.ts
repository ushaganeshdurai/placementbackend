import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs';
import type { CreateStudentsRoute, GetOneRoute, LoginStaffRoute, RemoveStudentRoute } from "./staff.routes";
import { staff, students } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

// Login the staff
export const loginStaff: AppRouteHandler<LoginStaffRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  console.log('Staff login attempt:', { email }); // Debug input

  const queryStaff = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1)
    .execute();

  console.log('Query result:', queryStaff); // Debug DB result
  if (queryStaff.length === 0) {
    console.log('No staff found for email:', email);
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const queried_staff = queryStaff[0];
  console.log('Stored password hash:', queried_staff.password); // Debug hash
  const isPasswordValid = await bcrypt.compare(password, queried_staff.password!);
  console.log('Password valid:', isPasswordValid); // Debug password check

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ staff_id: queried_staff.staffId, role: "staff" }, SECRET_KEY);

  setCookie(c, "staff_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production", // False in dev
    sameSite: "Lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });

  console.log('Staff login successful, redirecting to /staff');
  return c.redirect("/staff", 302);
};

// Get staff data
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    // Handle both staff_id (manual login) and id (OAuth)
    staffId = (decoded.staff_id || decoded.id) as string;
    userRole = decoded.role;
    console.log('Decoded JWT:', decoded); // Debug token
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
    const staff_details = await db.select().from(staff).where(eq(staff.staffId, staffId)).execute();
    const studentList = await db
      .select()
      .from(students)
      .where(eq(students.staffId, staffId))
      .execute();

    console.log('Staff details:', staff_details); // Debug staff data
    console.log('Student list:', studentList); // Debug student data

    return c.json({
      success: "Authorization successful",
      staffId,
      role: userRole,
      staff: staff_details[0],
      students: studentList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

// Add Students
export const createStudents: AppRouteHandler<CreateStudentsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let staffId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");
      // Use staff_id consistently with loginStaff
      staffId = (decoded.staff_id || decoded.id) as string;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token" }, 400);
    }

    const newStudents = c.req.valid("json");
    if (!Array.isArray(newStudents)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "staff") {
      const validStudents = await Promise.all(
        newStudents.map(async (student) => ({
          email: student.email,
          staffId: staffId,
          password: await bcrypt.hash(student.password!, 10),
        }))
      );

      console.log("Staff ID being used:", staffId);
      const insertedStudents = await db.insert(students).values(validStudents).returning();
      return c.json(insertedStudents, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};

// Remove Student
export const removeStudent: AppRouteHandler<RemoveStudentRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");

    const result = await db
      .delete(students)
      .where(eq(students.studentId, id))
      .returning(); // Add returning to check deleted rows

    console.log('Deletion result:', result); // Debug deletion
    if (result.length === 0) {
      return c.json({
        errors: [{ code: "NOT_FOUND", message: "Student not found" }],
      }, HttpStatusCodes.NOT_FOUND);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error("Student deletion error:", error);
    return c.json({
      errors: [{ path: ["param", "id"], message: "Invalid student ID format" }],
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};