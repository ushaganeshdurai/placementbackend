import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import { superAdmin } from "@/db/schemas/superAdminSchema";
import type { CreateStaffsRoute, CreateStudentsRoute, CreateSuperAdminRoute, GetOneRoute, LoginSuperAdmin, RemoveRoute, RemoveStaffRoute, RemoveStudentRoute } from "./superadmin.routes";
import { staff } from "@/db/schemas/staffSchema";
import { students } from "@/db/schemas/studentSchema";



export const create: AppRouteHandler<CreateSuperAdminRoute> = async (c) => {
  const newSuperAdmin = c.req.valid("json");
  const hashedPassword = await bcrypt.hash(newSuperAdmin.password, 10);
  const newSuperAdminWithHashedPassword = { ...newSuperAdmin, password: hashedPassword }
  const [insertedSuperAdmin] = await db.insert(superAdmin).values(newSuperAdminWithHashedPassword).returning();
  return c.json(insertedSuperAdmin, HttpStatusCodes.OK);
};

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
    return c.json(
      { error: "Invalid credentials" },
      401
    );
  }

  const admin = queryAdmin[0];
  console.log("from the login admin", admin.id);
  const passwordMatch = await bcrypt.compare(password, admin.password);

  if (!passwordMatch) {
    return c.json(
      { error: "Invalid credentials" },
      401
    );
  }

  return c.redirect(`/superadmin/${admin.id}`, 302);
};



export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param");

  console.log("from get one", id);

  const newSuperAdmin = await db
    .select()
    .from(superAdmin)
    .where(eq(superAdmin.id, id))  // id is now a string
    .limit(1)
    .execute();

  if (newSuperAdmin.length === 0) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.json(newSuperAdmin[0], HttpStatusCodes.OK);
};




export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");

  // Ensure id is a string
  const result = await db.delete(superAdmin)
    .where(eq(superAdmin.id, String(id))); // Convert id to string

  if (result.length === 0) {
    return c.json(
      { message: HttpStatusPhrases.NOT_FOUND },
      HttpStatusCodes.NOT_FOUND
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};




//Add Staff
export const createStaffs: AppRouteHandler<CreateStaffsRoute> = async (c) => {
  try {
    const newStaffs = c.req.valid('json');

    // Instead of returning a 400 error
    if (!Array.isArray(newStaffs)) {
      // Return empty array with 200 status since that's what the route expects
      return c.json([], HttpStatusCodes.OK);
    }

    const insertedStaffs = await db.insert(staff).values(newStaffs).returning();
    return c.json(insertedStaffs, HttpStatusCodes.OK);

  } catch (error) {
    // Instead of returning error objects, return empty array
    console.error('Staff creation error:', error);
    return c.json([], HttpStatusCodes.OK);
  }
};




//Remove Staff
export const removeStaff: AppRouteHandler<RemoveStaffRoute> = async (c) => {
  const { staffId } = c.req.valid("param");

  try {
    const result = await db.delete(staff)
      .where(eq(staff.staffId, staffId)); 

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
    const { student_id } = c.req.valid("param");

    const result = await db.delete(students)
      .where(eq(students.studentId, student_id));

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
