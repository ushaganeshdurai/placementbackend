import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
// import { superAdmin } from "@/db/schemas/superAdminSchema";
import { superAdmin } from "drizzle/schema";
import type { CreateStaffsRoute, GetOneRoute, LoginSuperAdmin, RemoveStaffRoute } from "./superadmin.routes";
import { staff,students } from "drizzle/schema";
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

  const isPasswordValid = await bcrypt.compare(password, admin.password);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }


  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: admin.id, role: "super_admin" }, SECRET_KEY);
  console.log("Context:", c);
  // Set cookie with proper options
  setCookie(c, "admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production", // Secure only in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });
  return c.redirect("/superadmin",302)
};


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

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
    if ( error=== "TokenExpiredError") {
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const staffList = await db.select().from(staff).execute();
    const studentList = await db.select().from(students).execute();
    
    return c.json({
      success: "Authorization successful",
      userId,
      role: userRole,
      staff: staffList,
      students: studentList
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};


//Add Staff

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
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
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
      // Hash all passwords before inserting
      const validStaffs = await Promise.all(newStaffs.map(async (staff) => ({
        email: staff.email,
        password: await bcrypt.hash(staff.password, 10), // Hash password with salt rounds = 10
      })));

      const insertedStaffs = await db.insert(staff).values(validStaffs).returning();
      return c.json(insertedStaffs, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);

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

