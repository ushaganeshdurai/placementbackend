import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from 'bcryptjs'
import type { BulkUploadStudentsRoute, CreateJobAlertRoute, CreateStudentsRoute, DisplayDrivesRoute, FeedGroupMailRoute, GetFeedGroupMailRoute, GetOneRoute, LoginStaffRoute, LogoutStaffRoute, RegisteredStudentsRoute, RemoveJobRoute, RemoveStudentRoute, UpdatePasswordRoute } from "./staff.routes";
import { applications, drive, groupMails, placedOrNot, staff, students } from "drizzle/schema";
import { insertStudentSchema } from "@/db/schemas/studentSchema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { z } from "zod";


// login the staff
export const loginStaff: AppRouteHandler<LoginStaffRoute> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "admin_session");
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
  const sessionToken = await sign({ staff_id: queried_staff.staffId, role: "staff", email: queried_staff.email }, SECRET_KEY);
  console.log("Context:", c);
  setCookie(c, "staff_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/staff", 302)
};


//Remove Student
export const removeStudent: AppRouteHandler<RemoveStudentRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");
    console.log(`Attempting to delete student with ID: ${id}`);

    const result = await db.delete(students)
      .where(eq(students.studentId, id))
      .execute();

    console.log(`Delete result:`, result);

    if (result.count === 0) {
      console.log(`Student with ID ${id} not found in database`);
      return c.json({
        errors: [{
          code: 'NOT_FOUND',
          message: 'Student not found'
        }]
      }, HttpStatusCodes.NOT_FOUND);
    }

    console.log(`Student with ID ${id} deleted successfully`);
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error('Student deletion error:', error);
    return c.json({
      errors: [{
        path: ['param', 'id'],
        message: 'Invalid student ID format or server error'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};

//Post job
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
          department: job.department,
          driveLink: job.driveLink,
          expiration: job.expiration, //format: mm/dd/yyyy, --:--:-- --
          companyName: job.companyName,
          driveDate: job.driveDate, //format: mm/dd/yyyy
        }))
      );

      console.log("Staff ID being used:", staffId);

      const insertedJobs = await db.insert(drive).values(validJobs).returning();
      return c.json(insertedJobs, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};



//Remove job
export const removejob: AppRouteHandler<RemoveJobRoute> = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const result = await db.delete(drive)
      .where(eq(drive.id, id));
    return c.body("Job deleted successfully", HttpStatusCodes.OK);

  } catch (error) {
    console.error('Job deletion error:', error);
    return c.json({
      errors: [{
        path: ['param', 'id'],
        message: 'Invalid Job ID format'
      }]
    }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
};

//update password
export const updatepassword: AppRouteHandler<UpdatePasswordRoute> = async (c) => {
  try {
    // Get JWT Token from cookies
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false }, 401);
    }

    let staffId: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");

      staffId = decoded.staff_id as string;
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

    const staffy = staffQuery[0];

    if (!staffy) {
      return c.json({ error: "Staff not found", success: false }, 404);
    }

    const passwordMatches = await bcrypt.compare(staffy.password!, oldPassword);
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

// export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
//   const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

//   if (!jwtToken) {
//     return c.json({ error: "Unauthorized: No session found", success: false }, 401);
//   }

//   let staffId = null;
//   let userRole = null;

//   try {
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     const decoded = await verify(jwtToken!, SECRET_KEY);
//     if (!decoded) throw new Error("Invalid session");
//     staffId = decoded.staff_id;
//     userRole = decoded.role;
//     console.log(jwtToken)
//   } catch (error) {
//     if (error === "TokenExpiredError") {
//       return c.json({ error: "Session expired", success: false }, 401);
//     }
//     console.error("Session Verification Error:", error);
//     return c.json({ error: "Invalid session", success: false }, 401);
//   }

//   if (userRole !== "staff") {
//     return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
//   }

//   try {
//     const registeredStudentsList = await db.select({
//       applicationId: applications.id,
//       studentName: students.name,
//       email: students.email,
//       arrears: students.noOfArrears,
//       cgpa: students.cgpa,
//       batch: students.batch,
//       department: students.department,
//       placedStatus: students.placedStatus,
//       regNo: students.regNo,
//       rollNo: students.rollNo,
//       companyName: drive.companyName,
//       appliedAt: applications.appliedAt
//     })
//       .from(applications)
//       .innerJoin(students, eq(applications.studentId, students.studentId))
//       .innerJoin(drive, eq(applications.driveId, drive.id))
//       .execute();
//     return c.json({
//       success: "Fetched applications successfully",
//       staffId,
//       role: userRole,
//       registered_students: registeredStudentsList,
//     }, 200);

//   } catch (error) {
//     console.error("Database query error:", error);
//     return c.json({ error: "Failed to fetch data", success: false }, 500);
//   }
// };





export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId = null;
  let userRole = null;
  let staffEmail = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    staffEmail = decoded.email; // Extract staffEmail from JWT payload
    if (!staffEmail) throw new Error("Staff email not found in session");
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
    const { driveId } = c.req.valid("param");
    const registeredStudentsList = await db
      .select({
        applicationId: applications.id,
        studentName: students.name,
        email: students.email,
        cgpa: students.cgpa,
        batch: students.batch,
        department: students.department,
        appliedAt: applications.appliedAt,
        phoneNumber: students.phoneNumber,
        noOfArrears: students.noOfArrears,
      })
      .from(applications)
      .innerJoin(students, eq(applications.studentId, students.studentId))
      .innerJoin(drive, eq(applications.driveId, drive.id))
      .where(eq(applications.driveId, driveId))
      .execute();

    // Add staffEmail from session to each student
    const enrichedStudents = registeredStudentsList.map(student => ({
      ...student,
      staffEmail, // Add the current staff's email from the session
    }));

    console.log("Enriched Students:", enrichedStudents); // Debug log

    return c.json(
      {
        success: "Fetched applications successfully",
        userId,
        role: userRole,
        registered_students: enrichedStudents,
      },
      200
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};





//students creation
export const createStudents: AppRouteHandler<CreateStudentsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let staffId: string | null = null;
    let staffDepartment: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      staffId = (decoded.staff_id || decoded.id) as string;
      userRole = decoded.role;
    } catch (error) {

      return c.json({ error: "Invalid session" }, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token" }, 400);
    }

    // Fetch staff department
    const staffDetails = await db
      .select({ department: staff.department })
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .execute();
    staffDepartment = staffDetails[0]?.department;
    if (!staffDepartment) {
      return c.json({ error: "Staff department not found" }, 400);
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
            department: staffDepartment, // Set to staff's department
            batch: student.batch, // From request body
          }))
      );

      if (validStudents.length === 0) {
        return c.json({ error: "No valid students found with @saec.ac.in domain", success: false }, 400);
      }

      const insertedStudents = await db
        .insert(students)
        .values(validStudents)
        .returning({ studentId: students.studentId, email: students.email, staffId: students.staffId, department: students.department, batch: students.batch });

      const responseStudents = insertedStudents.map(student => ({
        ...student,
        staffEmail: staffDetails[0].email,
      }));

      return c.json(responseStudents, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Students creation error:", error);
    return c.json([], HttpStatusCodes.OK);
  }
};





export const placedstudents: AppRouteHandler<PlacedStudentsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found", success: false } as never, 401);
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
      return c.json({ error: "Invalid session", success: false } as never, 401);
    }

    if (!staffId) {
      return c.json({ error: "Staff ID missing from token", success: false } as never, 400);
    }

    const placed = c.req.valid("json");
    if (!Array.isArray(placed) || placed.length === 0) {
      return c.json([], 400);
    }

    if (userRole === "staff") {
      console.log("Updating placedstatus for students:", placed);

      const updatedStudents = await db
        .update(students)
        .set({ placedStatus: "yes" })
        .where(inArray(students.email, placed.map((s) => s.email)));

      console.log("Updated Students:", updatedStudents);
      return c.json(placed, 200);
    }

    return c.json({ error: "Unauthorized", success: false } as never, 403);
  } catch (error) {
    console.error("Students update error:", error);
    return c.json({ error: "An error occurred", success: false } as never, 500);
  }
};




export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
  console.log("1. Entering bulkUploadStudents handler");
  console.log("2. Request Headers:", c.req.headers);

  const jwtToken = getCookie(c, "staff_session") || getCookie(c, "oauth_session");
  if (!jwtToken) {
    console.log("3. No session found");
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let staffId = null;
  let userRole = null;
  let defaultStaffDepartment = null;
  let defaultStaffEmail = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    staffId = decoded.staff_id;
    userRole = decoded.role;
    console.log("4. Session decoded:", { staffId, userRole });
  } catch (error) {
    console.error("5. Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "staff") {
    console.log("6. Insufficient role");
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  const staffDetails = await db
    .select({ email: staff.email, department: staff.department })
    .from(staff)
    .where(eq(staff.staffId, staffId))
    .execute();
  defaultStaffDepartment = staffDetails[0]?.department;
  defaultStaffEmail = staffDetails[0]?.email;
  if (!defaultStaffDepartment || !defaultStaffEmail) {
    console.log("7. Default staff details not found");
    return c.json({ error: "Staff department or email not found", success: false }, 400);
  }
  console.log("8. Default staff details:", { staffId, defaultStaffEmail, defaultStaffDepartment });

  let body;
  try {
    console.log("9. Attempting to parse body");
    body = await c.req.json();
    console.log("10. Received Body:", body);
  } catch (error) {
    console.error("11. Error parsing request body:", error);
    return c.json(
      { error: "Failed to parse request body", success: false, details: error.message },
      400
    );
  }

  if (!body || !Array.isArray(body)) {
    console.log("12. Body validation failed:", body);
    return c.json(
      { error: "Invalid request body: Expected an array", success: false },
      400
    );
  }

  // Extend schema to allow optional staffEmail and department
  const extendedSchema = insertStudentSchema.extend({
    staffEmail: z.string().email().optional(),
    department: z.string().optional(), // Add department as optional
  });

  let validatedData;
  try {
    console.log("13. Validating body against extended schema");
    validatedData = z.array(extendedSchema).parse(body);
    console.log("14. Schema validation passed:", validatedData);
  } catch (validationError) {
    console.error("15. Validation Error Raw:", validationError);
    const issues = validationError instanceof z.ZodError ? validationError.issues : [];
    console.error("16. Validation Issues:", issues);
    return c.json(
      {
        error: "Invalid data format",
        details: issues.map((e) => ({
          path: e.path,
          message: e.message,
        })),
        success: false,
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  // Map students with staffId and department
  console.log("17. Mapping student data");
  const studentDataPromises = validatedData.map(async (student) => {
    let targetStaffId = staffId;
    let targetStaffEmail = defaultStaffEmail;
    let targetDepartment = student.department || defaultStaffDepartment; // Use provided department or fallback

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(student.password, 10);

    if (student.staffEmail) {
      const staffRecord = await db
        .select({ staffId: staff.staffId, department: staff.department })
        .from(staff)
        .where(eq(staff.email, student.staffEmail))
        .execute();
      if (staffRecord.length > 0) {
        targetStaffId = staffRecord[0].staffId;
        targetStaffEmail = student.staffEmail;
        targetDepartment = student.department || staffRecord[0].department;
      }
    }

    return {
      email: student.email,
      password: hashedPassword, // Store the hashed password instead of plain text
      staffId: targetStaffId,
      department: targetDepartment,
      batch: student.batch || null,
      staffEmail: targetStaffEmail,
    };
  });

  const studentData = await Promise.all(studentDataPromises);
  console.log("19. Mapped Student Data:", studentData);

  try {
    const existingStudents = await db
      .select({ email: students.email })
      .from(students)
      .where(inArray(students.email, studentData.map((s) => s.email)))
      .execute();
    const existingEmails = new Set(existingStudents.map((s) => s.email));
    console.log("20. Existing Emails:", existingEmails);

    const newStudents = studentData.filter((student) => !existingEmails.has(student.email));
    console.log("21. New Students to Insert:", newStudents);

    if (newStudents.length === 0) {
      console.log("22. No new students to insert");
      return c.json({
        success: true,
        message: "No new students to upload; all emails already exist",
        inserted: [],
        skipped: studentData,
      }, 200);
    }

    const insertedStudents = await db
      .insert(students)
      .values(newStudents.map(({ staffEmail, ...rest }) => rest))
      .returning({
        studentId: students.studentId,
        email: students.email,
        staffId: students.staffId,
        department: students.department,
        batch: students.batch,
      });
    console.log("23. Inserted Students:", insertedStudents);

    const responseInserted = insertedStudents.map((student) => {
      const matchingStudent = newStudents.find((s) => s.email === student.email);
      return { ...student, staffEmail: matchingStudent?.staffEmail };
    });
    const responseSkipped = studentData
      .filter((student) => existingEmails.has(student.email))
      .map((student) => ({ ...student }));

    console.log("24. Response Prepared:", { inserted: responseInserted, skipped: responseSkipped });
    return c.json({
      success: true,
      message: `Inserted ${insertedStudents.length} students, skipped ${responseSkipped.length} duplicates`,
      inserted: responseInserted,
      skipped: responseSkipped,
    }, 200);
  } catch (error) {
    console.error("25. Bulk upload error:", error);
    if (error.code === "23505") {
      return c.json(
        {
          error: "Some emails already exist in the database",
          success: false,
          details: error.detail,
        },
        409
      );
    }
    return c.json({ error: "Failed to upload students", success: false }, 500);
  }
};









export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session");

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
    console.log("JWT Token:", jwtToken);
    console.log("Decoded JWT:", decoded);
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: `Invalid session: ${error.message}` }, 401);
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
        department: staff.department,
      })
      .from(staff)
      .where(eq(staff.staffId, staffId))
      .execute();

    console.log("Staff Query Result:", staff_details);

    if (staff_details.length === 0) {
      return c.json({ error: `Staff not found for staffId: ${staffId}` }, 404);
    }

    const staffEmail = staff_details[0].email;
    const staffDepartment = staff_details[0].department;
    if (!staffDepartment) {
      return c.json({ error: `Staff department not set for staffId: ${staffId}` }, 400);
    }

    // Fetch all students in the staff's department
    const allStudents = await db
      .select({
        studentId: students.studentId,
        email: students.email,
        staffEmail: staff.email,
        department: students.department,
        batch: students.batch,
        staffId: students.staffId,
        regNo: students.regNo,
        placedStatus: students.placedStatus,
      })
      .from(students)
      .leftJoin(staff, eq(students.staffId, staff.staffId))
      .where(eq(students.department, staffDepartment))
      .execute();

    // Group all students by department and batch
    const allStudentsByDeptAndBatch = allStudents.reduce((acc, student) => {
      const dept = student.department || "Unknown";
      const batch = student.batch || "Unknown";
      if (!acc[dept]) acc[dept] = {};
      acc[dept][batch] = [...(acc[dept][batch] || []), student];
      return acc;
    }, {});

    // Filter and group students added by this staff
    const yourStudents = allStudents.filter((student) => student.staffId === staffId);
    const yourStudentsByBatch = yourStudents.reduce((acc, student) => {
      const batch = student.batch || "Unknown";
      acc[batch] = [...(acc[batch] || []), student];
      return acc;
    }, {});

    const jobList = await db.select().from(drive).execute();

    return c.json({
      success: "Authorization successful",
      staffId,
      role: userRole,
      staffEmail, // Added
      staffDepartment, // Added
      staff: staff_details[0],
      allStudents: allStudentsByDeptAndBatch, // Grouped by department and batch
      yourStudents: yourStudentsByBatch, // Grouped by batch
      drives: jobList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};



export const FeedGroupMail: AppRouteHandler<FeedGroupMailRoute> = async (c) => {
  try {
    deleteCookie(c, "student_session");
    deleteCookie(c, "admin_session");

    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) return c.json({ error: "Unauthorized: No session found" }, 401);

    let userRole: string | null = null;
    const SECRET_KEY = process.env.SECRET_KEY!;

    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      userRole = decoded.role as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const requestBody = await c.req.json();
    if (!Array.isArray(requestBody)) {
      return c.json({ error: "Invalid request format, expected an array of emails" }, 400);
    }

    if (userRole !== "staff") return c.json({ error: "Unauthorized" }, 403);

    // Validate and clean emails
    const validEmails = [...new Set(
      requestBody
        .filter((email: any) => typeof email === "string")
        .map((email: string) => email.trim().toLowerCase())
        .filter((email: string) => email.endsWith("@saec.ac.in"))
    )];

    if (validEmails.length === 0) {
      return c.json({ error: "No valid emails with @saec.ac.in domain" }, 400);
    }

    // Insert emails into DB
    const insertedEmails = await db.insert(groupMails).values(
      validEmails.map((email) => ({ email }))
    ).returning();

    return c.json({ inserted: insertedEmails.length, emails: insertedEmails }, 200);
  } catch (error) {
    console.error("Mail IDs creation error:", error);
    return c.json({ error: "Server error" }, 500);
  }
};

export const getFeedGroupMail: AppRouteHandler<GetFeedGroupMailRoute> = async (c) => {
  const jwtToken = getCookie(c, "staff_session");

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
    const groupMailList = await db.select({email: groupMails.email}).from(groupMails).execute();
    return c.json({
    groupMailList,
    }, 200);

  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};




export const logoutStaff: AppRouteHandler<LogoutStaffRoute> = async (c) => {
  const jwtoken = getCookie(c, "staff_session")
  if (!jwtoken) {
    return c.json({ error: "No session found" }, 401);
  } else {
    deleteCookie(c, "staff_session");
  }
  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};

