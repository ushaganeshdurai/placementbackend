import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import { superAdmin } from "@/db/schemas/superAdminSchema";
import type { CreateStaffsRoute, CreateStudentsRoute, GetOneRoute, LoginSuperAdmin, RemoveStaffRoute, RemoveStudentRoute } from "./superadmin.routes";
import { staff } from "@/db/schemas/staffSchema";
import { students } from "@/db/schemas/studentSchema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";


// login the admin
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

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: admin.id, role: "superadmin" }, SECRET_KEY);

  // Set cookie with proper options
  setCookie(c, "admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure only in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });

  return c.json(
    {
      message: "Login successful",
      redirect: "/superadmin",
    },
    200
  );
};


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session");
  const oauthSession = getCookie(c, "oauth_session");
  if (!jwtToken || !oauthSession) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;
  
  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);

    console.log("Decoded JWT:", decoded);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  console.log("Cookies:", c.req.header("cookie"));



  const staffList = await db.select().from(staff).execute();
  const studentList = await db.select().from(students).execute();

  if (userRole === "super_admin") {
    return c.json({ userId, role: userRole, staff: staffList, students: studentList }, 200);
  }
  
};



//Add Staff
export const createStaffs: AppRouteHandler<CreateStaffsRoute> = async (c) => {
  try {
    const newStaffs = c.req.valid('json');

    if (!Array.isArray(newStaffs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    const insertedStaffs = await db.insert(staff).values(newStaffs).returning();
    return c.json(insertedStaffs, HttpStatusCodes.OK);

  } catch (error) {
    console.error('Staff creation error:', error);
    return c.json([], HttpStatusCodes.OK);
  }
};




//Remove Staff
export const removeStaff: AppRouteHandler<RemoveStaffRoute> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    const result = await db.delete(staff)
      .where(eq(staff.staffId, id));

    if (result.length === 0) {
      return c.json({
        errors: [{
          code: 'NOT_FOUND',
          message: 'Staff not found'
        }]
      }, HttpStatusCodes.NOT_FOUND);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error('Staff deletion error:', error);

    return c.json({
      errors: [{
        path: ['param', 'id', 'staffId'],
        message: 'Invalid staff ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
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
        path: ['param', 'student_id', 'id'],
        message: 'Invalid student ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};
