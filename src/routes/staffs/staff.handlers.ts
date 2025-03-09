import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { BulkUploadStudentsRoute, CreateJobAlertRoute, CreateStudentsRoute, DisplayDrivesRoute, GetOneRoute, LoginStaffRoute, RegisteredStudentsRoute, RemoveJobRoute, RemoveStudentRoute, UpdatePasswordRoute } from "./staff.routes";
import { applications, drive, staff, students } from "drizzle/schema";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

// Login the staff
export const loginStaff: AppRouteHandler<LoginStaffRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  console.log("Staff login attempt:", { email });

  const queryStaff = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1)
    .execute();

  console.log("Query result:", queryStaff);
  if (queryStaff.length === 0) {
    console.log("No staff found for email:", email);
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const queried_staff = queryStaff[0];
  console.log("Stored password hash:", queried_staff.password);
  const isPasswordValid = await bcrypt.compare(password, queried_staff.password!);
  console.log("Password valid:", isPasswordValid);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ staff_id: queried_staff.staffId, role: "staff" }, SECRET_KEY);

  setCookie(c, "staff_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  console.log("Staff login successful, redirecting to /staff");
  return c.redirect("/staff", 302);
};

// Get staff data (including jobs)
// export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
//   const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

//   if (!jwtToken) {
//     return c.json({ error: "Unauthorized: No session found" }, 401);
//   }

//   let staffId = null;
//   let userRole = null;

//   try {
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     const decoded = await verify(jwtToken, SECRET_KEY);
//     if (!decoded) throw new Error("Invalid session");
//     staffId = (decoded.staff_id || decoded.id) as string;
//     userRole = decoded.role;
//     console.log("Decoded JWT:", decoded);
//   } catch (error) {
//     if (error === "TokenExpiredError") {
//       return c.json({ error: "Session expired" }, 401);
//     }
//     console.error("Session Verification Error:", error);
//     return c.json({ error: "Invalid session" }, 401);
//   }

//   if (userRole !== "staff") {
//     return c.json({ error: "Unauthorized: Insufficient role" }, 403);
//   }

//   try {
//     const staff_details = await db.select().from(staff).where(eq(staff.staffId, staffId)).execute();
//     const studentList = await db
//       .select()
//       .from(students)
//       .where(eq(students.staffId, staffId))
//       .execute();
//     const jobList = await db.select().from(drive).execute();

//     console.log("Staff details:", staff_details);
//     console.log("Student list:", studentList);
//     console.log("Job list:", jobList);

//     return c.json({
//       success: "Authorization successful",
//       staffId,
//       role: userRole,
//       staff: staff_details[0],
//       students: studentList,
//       drives: jobList,
//     }, 200);
//   } catch (error) {
//     console.error("Database query error:", error);
//     return c.json({ error: "Failed to fetch data" }, 500);
//   }
// };

// Add Students
// export const createStudents: AppRouteHandler<CreateStudentsRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     let userRole: string | null = null;
//     let staffId: string | null = null;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       console.log("Decoded JWT:", decoded);
//       if (!decoded) throw new Error("Invalid session");
//       staffId = (decoded.staff_id || decoded.id) as string;
//       userRole = decoded.role;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     if (!staffId) {
//       return c.json({ error: "Staff ID missing from token" }, 400);
//     }

//     const newStudents = c.req.valid("json");
//     if (!Array.isArray(newStudents)) {
//       return c.json([], HttpStatusCodes.OK);
//     }

//     if (userRole === "staff") {
//       const validStudents = await Promise.all(
//         newStudents
//           .filter((student) => student.email.endsWith("@saec.ac.in")) // Check email suffix
//           .map(async (student) => ({
//             email: student.email,
//             staffId: staffId,
//             password: await bcrypt.hash(student.password!, 10),
//           }))
//       );

//       if (validStudents.length === 0) {
//         return c.json({ error: "No valid students found with @saec.ac.in domain", success: false }, 400);
//       }

//       console.log("Staff ID being used:", staffId);
//       const insertedStudents = await db.insert(students).values(validStudents).returning();
//       return c.json(insertedStudents, HttpStatusCodes.OK);
//     }


//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Students creation error:", error);
//     return c.json([], HttpStatusCodes.OK);
//   }
// };

// //bulk upload students
// export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
//   const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

//   if (!jwtToken) {
//     return c.json({ error: "Unauthorized: No session found", success: false }, 401);
//   }

//   let staffId = null;
//   let userRole = null;

//   try {
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     const decoded = await verify(jwtToken, SECRET_KEY);
//     if (!decoded) throw new Error("Invalid session");
//     staffId = decoded.staff_id;
//     userRole = decoded.role;
//   } catch (error) {
//     console.error("Session Verification Error:", error);
//     return c.json({ error: "Invalid session", success: false }, 401);
//   }

//   if (userRole !== "staff") {
//     return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
//   }

//   const body = await c.req.json();
//   const studentData = body; // Array of { email, password, staffEmail }

//   try {
//     // Fetch existing emails from the database
//     const existingStudents = await db
//       .select({ email: students.email })
//       .from(students)
//       .where(studentData.map((s) => s.email).includes(students.email))
//       .execute();
//     const existingEmails = new Set(existingStudents.map((s) => s.email));

//     // Filter out students with existing emails
//     const newStudents = studentData.filter((student) => !existingEmails.has(student.email));

//     if (newStudents.length === 0) {
//       return c.json({
//         success: true,
//         message: "No new students to upload; all emails already exist",
//         inserted: [],
//         skipped: studentData,
//       }, 200);
//     }

//     // Insert only new students
//     const insertedStudents = await db
//       .insert(students)
//       .values(newStudents)
//       .returning(); // Adjust returning fields as per your schema

//     const skippedStudents = studentData.filter((student) => existingEmails.has(student.email));

//     return c.json({
//       success: true,
//       message: `Inserted ${insertedStudents.length} students, skipped ${skippedStudents.length} duplicates`,
//       inserted: insertedStudents,
//       skipped: skippedStudents,
//     }, 200);
//   } catch (error) {
//     console.error("Bulk upload error:", error);
//     if (error.code === "23505") { // Unique constraint violation
//       return c.json({
//         error: "Some emails already exist in the database",
//         success: false,
//         details: error.detail,
//       }, 409); // Conflict status code
//     }
//     return c.json({ error: "Failed to upload students", success: false }, 500);
//   }
// };



//Remove Student
export const removeStudent: AppRouteHandler<RemoveStudentRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");

    const result = await db
      .delete(students)
      .where(eq(students.studentId, id))
      .returning();

    console.log("Deletion result:", result);
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

// Post job
export const createjobalert: AppRouteHandler<CreateJobAlertRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let staffId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      staffId = decoded.staff_id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token" }, 400);
    }

    const newJobs = c.req.valid("json");
    if (!Array.isArray(newJobs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "staff") {
      const validJobs = await Promise.all(
        newJobs.map(async (job) => ({
          batch: job.batch,
          jobDescription: job.jobDescription,
          department: job.department ? [job.department] : null,
          driveLink: job.driveLink,
          expiration: job.expiration, //format: mm/dd/yyyy, --:--:-- --
          companyName: job.companyName,
          driveDate: job.driveDate,
        }))
      );

      console.log("Staff ID being used:", staffId);

      const insertedJobs = await db.insert(drive).values(validJobs).returning();
      return c.json(insertedJobs, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Job creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};

// Remove job
export const removejob: AppRouteHandler<RemoveJobRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");
    console.log('Attempting to delete job with ID:', id, 'Type:', typeof id);

    const numericId = Number(id);
    if (isNaN(numericId)) {
      return c.json({
        errors: [{ path: ["param", "id"], message: "ID must be a valid number" }],
      }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const result = await db
      .delete(drive)
      .where(eq(drive.id, numericId))
      .returning();

    console.log("Deletion result:", result);
    if (result.length === 0) {
      return c.json({
        errors: [{ code: "NOT_FOUND", message: "Job not found" }],
      }, HttpStatusCodes.NOT_FOUND);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error("Job deletion error:", error);
    return c.json({
      errors: [{ path: ["param", "id"], message: error.message || "Invalid job ID format" }],
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};

// Update Password
export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }

    let staffId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      staffId = (decoded.staff_id || decoded.id) as string;
      console.log("Decoded JWT:", decoded);
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

    if (staffQuery.length === 0) {
      return c.json({ error: "Staff not found" }, 404);
    }

    const staffy = staffQuery[0];
    const passwordMatches = await bcrypt.compare(oldPassword, staffy.password!);
    console.log("Old password valid:", passwordMatches);

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


export const displayDrives: AppRouteHandler<DisplayDrivesRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    staffId = decoded.staff_id;
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


//get the registered students


export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    staffId = decoded.staff_id;
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  const { driveId } = c.req.valid("param");

  try {
    const registeredStudentsList = await db
      .select({
        applicationId: applications.id,
        studentName: students.name,
        email: students.email,
        arrears: students.noOfArrears,
        cgpa: students.cgpa,
        batch: students.batch,
        department: students.department,
        placedStatus: students.placedStatus,
        regNo: students.regNo,
        rollNo: students.rollNo,
        companyName: drive.companyName,
        appliedAt: applications.appliedAt,
      })
      .from(applications)
      .innerJoin(students, eq(applications.studentId, students.studentId))
      .innerJoin(drive, eq(applications.driveId, drive.id))
      .where(eq(applications.driveId, driveId))
      .execute();

    return c.json({
      success: "Fetched applications successfully",
      staffId,
      role: userRole,
      registered_students: registeredStudentsList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};






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
    staffId = (decoded.staff_id || decoded.id) as string;
    userRole = decoded.role;
    console.log("Decoded JWT:", decoded);
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
    const staff_details = await db
      .select({
        staffId: staff.staffId,
        email: staff.email,
        name: staff.name,
        department: staff.department, // Include department
      })
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .execute();

    const studentList = await db
      .select({
        studentId: students.studentId,
        email: students.email,
        staffEmail: staff.email,
      })
      .from(students)
      .leftJoin(staff, eq(students.staffId, staff.staffId))
      .where(eq(students.staffId, staffId))
      .execute();

    const jobList = await db.select().from(drive).execute();

    console.log("Staff details:", staff_details);
    console.log("Student list:", studentList);
    console.log("Job list:", jobList);

    return c.json({
      success: "Authorization successful",
      staffId,
      role: userRole,
      staff: staff_details[0], // Includes department
      students: studentList,
      drives: jobList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};



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
        newStudents
          .filter((student) => student.email.endsWith("@saec.ac.in"))
          .map(async (student) => ({
            email: student.email,
            staffId: staffId,
            password: await bcrypt.hash(student.password!, 10),
          }))
      );

      if (validStudents.length === 0) {
        return c.json({ error: "No valid students found with @saec.ac.in domain", success: false }, 400);
      }

      console.log("Staff ID being used:", staffId);
      const insertedStudents = await db
        .insert(students)
        .values(validStudents)
        .returning({ studentId: students.studentId, email: students.email, staffId: students.staffId });

      // Fetch staff email for the response
      const staffDetails = await db
        .select({ email: staff.email })
        .from(staff)
        .where(eq(staff.staffId, staffId))
        .execute();

      const staffEmail = staffDetails[0]?.email || "Unknown";
      const responseStudents = insertedStudents.map(student => ({
        ...student,
        staffEmail,
      }));

      return c.json(responseStudents, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};








export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    staffId = decoded.staff_id;
    userRole = decoded.role;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  const body = await c.req.json();
  const studentData = body.map(student => ({
    email: student.email,
    password: student.password,
    staffId: staffId, // Use staffId from token if not provided
  }));

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
      .values(newStudents)
      .returning({ studentId: students.studentId, email: students.email, staffId: students.staffId });

    const staffDetails = await db
      .select({ email: staff.email })
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .execute();
    const staffEmail = staffDetails[0]?.email || "Unknown";

    const responseInserted = insertedStudents.map(student => ({
      ...student,
      staffEmail,
    }));
    const responseSkipped = studentData
      .filter((student) => existingEmails.has(student.email))
      .map(student => ({ ...student, staffEmail }));

    return c.json({
      success: true,
      message: `Inserted ${insertedStudents.length} students, skipped ${responseSkipped.length} duplicates`,
      inserted: responseInserted,
      skipped: responseSkipped,
    }, 200);
  } catch (error) {
    console.error("Bulk upload error:", error);
    if (error.code === "23505") {
      return c.json({
        error: "Some emails already exist in the database",
        success: false,
        details: error.detail,
      }, 409);
    }
    return c.json({ error: "Failed to upload students", success: false }, 500);
  }
};