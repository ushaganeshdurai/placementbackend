import { eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import db from "@/db";
import bcrypt from "bcryptjs";
import { applications, drive, students, superAdmin, staff, profiles } from "drizzle/schema";
import type {
  BulkUploadStudentsRoute,
  CreateJobsRoute,
  GetJobsWithStudentsRoute,
  CreateStaffsRoute,
  GetOneRoute,
  LoginSuperAdmin,
  RegisteredStudentsRoute,
  RemoveDriveRoute,
  RemoveStaffRoute,
  LogoutAdminRoute

} from "./superadmin.routes";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

// Login the admin
export const loginAdmin: AppRouteHandler<LoginSuperAdmin> = async (c) => {
  deleteCookie(c, "student_session");
  deleteCookie(c, "staff_session");
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
  const isPasswordValid = await bcrypt.compare(password, admin.password!);

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: admin.id, email: admin.email, role: "super_admin" }, SECRET_KEY);

  setCookie(c, "admin_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });
  return c.redirect("/superadmin", 302);
};

// Get Super Admin Dashboard Data
// export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
//   const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

//   if (!jwtToken) {
//     return c.json({ error: "Unauthorized: No session found" }, 401);
//   }

//   let userId = null;
//   let userRole = null;
//   let email = null;

//   try {
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     const decoded = await verify(jwtToken, SECRET_KEY);
//     if (!decoded) throw new Error("Invalid session");
//     userId = decoded.id;
//     userRole = decoded.role;
//     email = decoded.email;
//     console.log("JWT Token:", jwtToken);
//   } catch (error) {
//     if (error === "TokenExpiredError") {
//       return c.json({ error: "Session expired" }, 401);
//     }
//     console.error("Session Verification Error:", error);
//     return c.json({ error: "Invalid session" }, 401);
//   }

//   if (userRole !== "super_admin") {
//     return c.json({ error: "Unauthorized: Insufficient role" }, 403);
//   }

//   try {
//     const staffList = await db
//       .select({
//         staffId: staff.staffId,
//         userId: staff.userId,
//         email: staff.email,
//         name: staff.name,
//         department: staff.department,
//       })
//       .from(staff)
//       .execute();

//     console.log("Fetched staff list:", staffList);

//     return c.json(
//       {
//         success: true,
//         userId,
//         role: userRole,
//         email,
//         staff: staffList,
//       },
//       200
//     );
//   } catch (error) {
//     console.error("Database query error:", error);
//     return c.json({ error: "Failed to fetch data" }, 500);
//   }
// };


export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let userId = null;
  let userRole = null;
  let email = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    email = decoded.email;
    console.log("JWT Token:", jwtToken);
  } catch (error) {
    if (error.name === "TokenExpiredError") { // Correct error check
      return c.json({ error: "Session expired" }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    // Fetch staff data
    const staffList = await db
      .select({
        staffId: staff.staffId,
        userId: staff.userId,
        email: staff.email,
        name: staff.name,
        department: staff.department,
      })
      .from(staff)
      .execute();

    // Fetch students data (adjust fields based on your students table schema)
    const studentList = await db
      .select({
        studentId: students.studentId, // Adjust to match your schema
        email: students.email,
        name: students.name,
        batch: students.batch,
        department: students.department,
      })
      .from(students)
      .execute();

    console.log("Fetched staff list:", staffList);
    console.log("Fetched student list:", studentList);

    return c.json(
      {
        success: true,
        userId,
        role: userRole,
        email,
        staff: staffList,
        students: studentList, // Add students to the response
      },
      200
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};



// Add Staff
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
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      userId = decoded.id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const newStaffs = c.req.valid("json");
    if (!Array.isArray(newStaffs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      // Hash passwords and include department
      const validStaffs = await Promise.all(
        newStaffs.map(async (staff) => ({
          email: staff.email,
          password: await bcrypt.hash(staff.password, 10),
          department: staff.department || null, // Include department, default to null if not provided
        }))
      );

      // Check for existing emails
      const emailsToCheck = validStaffs.map((s) => s.email);
      const existingEmails = await db
        .select({ email: staff.email })
        .from(staff)
        .where(inArray(staff.email, emailsToCheck.length > 0 ? emailsToCheck : [""])) // Avoid empty IN clause
        .execute()
        .then((rows) => rows.map((row) => row.email));

      // Filter out duplicates
      const uniqueStaffs = validStaffs.filter((s) => !existingEmails.includes(s.email));
      const duplicateEmails = validStaffs.filter((s) => existingEmails.includes(s.email)).map((s) => s.email);

      let insertedStaffs = [];
      if (uniqueStaffs.length > 0) {
        insertedStaffs = await db.insert(staff).values(uniqueStaffs).returning();
      }

      // Return response with both inserted and skipped info
      return c.json(
        {
          inserted: insertedStaffs,
          skipped: duplicateEmails.length > 0 ? `Skipped duplicate emails: ${duplicateEmails.join(", ")}` : null,
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Staff creation error:", error);
    return c.json({ error: "Failed to process staff creation" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// Remove Staff
export const removeStaff: AppRouteHandler<RemoveStaffRoute> = async (c) => {
  const { id } = c.req.valid("param");

  try {
    const staffResult = await db
      .delete(staff)
      .where(eq(staff.staffId, id))
      .returning();

    console.log("Staff deletion result:", staffResult);

    if (staffResult.length === 0) {
      return c.json(
        {
          errors: [
            {
              code: "NOT_FOUND",
              message: "Staff not found or already deleted",
            },
          ],
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const userId = staffResult[0].userId;
    if (userId) {
      const profileResult = await db
        .delete(profiles)
        .where(eq(profiles.id, userId))
        .returning();
      console.log("Profile deletion result:", profileResult);
    }

    return c.body(null, HttpStatusCodes.NO_CONTENT);
  } catch (error) {
    console.error("Staff deletion error:", error);
    return c.json(
      {
        errors: [
          {
            path: ["staffId"],
            message: "Invalid staff ID format",
          },
        ],
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Create Jobs
export const createjobs: AppRouteHandler<CreateJobsRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let userId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");
      userRole = decoded.role as string;
      userId = decoded.id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!userId) {
      return c.json({ error: "Super admin ID missing from token" }, 400);
    }

    const newJobs = c.req.valid("json");
    console.log("Received jobs data:", newJobs);
    if (!Array.isArray(newJobs)) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (userRole === "super_admin") {
      const validJobs = await Promise.all(
        newJobs.map(async (job) => ({
          batch: job.batch!,
          jobDescription: job.jobDescription!,
          department: job.department,
          expiration: job.expiration!,
          companyName: job.companyName!,
          driveDate: job.driveDate!,
          driveLink: job.driveLink!,
        }))
      );

      console.log("Formatted jobs for DB:", validJobs);

      const insertedJobs = await db.insert(drive).values(validJobs).returning();
      return c.json(insertedJobs, HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Job creation error:", error);
    return c.json({ error: "Failed to create jobs", details: error.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// Remove Job
export const removedrive: AppRouteHandler<RemoveDriveRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole: string | null = null;
    let userId: string | null = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken!, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded) throw new Error("Invalid session");

      userRole = decoded.role as string;
      userId = decoded.id as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (!userId) {
      return c.json({ error: "Super admin ID missing from token" }, 400);
    }

    const { id } = c.req.valid("param");
    const result = await db.delete(drive).where(eq(drive.id, id));
    return c.body("Job deleted successfully", HttpStatusCodes.OK);
  } catch (error) {
    console.error("Job deletion error:", error);
    return c.json(
      {
        errors: [
          {
            path: ["param", "id"],
            message: "Invalid Job ID format",
          },
        ],
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }
};

// Get Registered Students
export const registeredStudents: AppRouteHandler<RegisteredStudentsRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken!, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    console.log(jwtToken);
  } catch (error) {
    if (error === "TokenExpiredError") {
      return c.json({ error: "Session expired", success: false }, 401);
    }
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

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
      .execute();
    return c.json(
      {
        success: "Fetched applications successfully",
        userId,
        role: userRole,
        registered_students: registeredStudentsList,
      },
      200
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};

// Bulk Add Students
export const bulkUploadStudents: AppRouteHandler<BulkUploadStudentsRoute> = async (c) => {
  type StudentData = {
    staffEmail: string;
    email: string;
    password: string;
  };

  try {
    const jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let userRole = null;
    try {
      const SECRET_KEY = process.env.SECRET_KEY!;
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded) throw new Error("Invalid session");
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (userRole !== "super_admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const studentData: StudentData[] = c.req.valid("json").map((student: any) => ({
      ...student,
      password: student.password || "",
    }));
    if (!Array.isArray(studentData) || studentData.length === 0) {
      return c.json({ error: "No valid students found" }, 400);
    }

    if (studentData.some((s) => !s.staffEmail || !s.email || !s.password)) {
      return c.json({ error: "Missing required fields: staffEmail, email, or password" }, 400);
    }

    const staffEmails = [...new Set(studentData.map((s) => s.staffEmail))];

    const staffRecords = await db
      .select({ email: staff.email, id: staff.staffId })
      .from(staff)
      .where(inArray(staff.email, staffEmails));

    const staffEmailToId = Object.fromEntries(staffRecords.map((s) => [s.email, s.id]));

    const invalidEmails = staffEmails.filter((email) => !staffEmailToId[email]);
    if (invalidEmails.length > 0) {
      return c.json({ error: "Invalid staff emails", emails: invalidEmails }, 400);
    }

    const validStudents = studentData.map(({ staffEmail, email, password }) => ({
      email,
      password: bcrypt.hashSync(password, 10),
      staffId: staffEmailToId[staffEmail],
    }));

    const insertedStudents = await db.insert(students).values(validStudents).returning();

    return c.json(insertedStudents, 200);
  } catch (error) {
    console.error("Bulk student upload error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};

// Get Jobs with Students
export const getJobsWithStudents: AppRouteHandler<GetJobsWithStudentsRoute> = async (c) => {
  const authHeader = c.req.header("Authorization");
  let jwtToken = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    jwtToken = getCookie(c, "admin_session") || getCookie(c, "oauth_session");
  }

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let userId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded) throw new Error("Invalid session");
    userId = decoded.id;
    userRole = decoded.role;
    console.log("Decoded JWT:", decoded);
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "super_admin") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const jobsWithStudents = await db
      .select({
        jobId: drive.id,
        companyName: drive.companyName,
        jobDescription: drive.jobDescription,
        driveDate: drive.driveDate,
        expiration: drive.expiration,
        batch: drive.batch,
        department: drive.department,
        createdAt: drive.createdAt,
        driveLink: drive.driveLink,
        studentApplications: {
          applicationId: applications.id,
          studentName: students.name,
          email: students.email,
          cgpa: students.cgpa,
          batch: students.batch,
          department: students.department,
          appliedAt: applications.appliedAt,
          phoneNumber: students.phoneNumber,
          noOfArrears: students.noOfArrears,
        },
      })
      .from(drive)
      .leftJoin(applications, eq(drive.id, applications.driveId))
      .leftJoin(students, eq(applications.studentId, students.studentId))
      .execute();

    const groupedJobs = jobsWithStudents.reduce((acc, curr) => {
      const jobId = curr.jobId;
      if (!acc[jobId]) {
        acc[jobId] = {
          jobId: curr.jobId,
          companyName: curr.companyName,
          jobDescription: curr.jobDescription,
          driveDate: curr.driveDate,
          expiration: curr.expiration,
          batch: curr.batch,
          department: curr.department,
          createdAt: curr.createdAt,
          driveLink: curr.driveLink,
          students: [],
        };
      }
      if (curr.studentApplications.applicationId) {
        acc[jobId].students.push(curr.studentApplications);
      }
      return acc;
    }, {});

    const jobsArray = Object.values(groupedJobs);

    return c.json(
      {
        success: true,
        jobs: jobsArray,
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch jobs", success: false }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};



export const logoutAdmin: AppRouteHandler<LogoutAdminRoute> = async (c) => {
  const jwtToken = getCookie(c, "admin_session");

  if (!jwtToken) {
    return c.json({ message: "No active session" }, HttpStatusCodes.UNAUTHORIZED);
  }

  // Clear the admin_session cookie
  deleteCookie(c, "admin_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
  });

  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};