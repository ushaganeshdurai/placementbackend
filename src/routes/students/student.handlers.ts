import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { decode } from 'hono/jwt';
import db from "@/db";
import bcrypt from 'bcryptjs';
import type { ApplyForDriveRoute, CreateResumeRoute, DisplayDrivesRoute, GetOneRoute, LoginStudentRoute, UpdatePasswordRoute, RegStudentRoute, ForgotPassword, ResetPassword, UpdateResumeRoute } from "./student.routes";
import { students, applications, drive, staff } from "drizzle/schema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { jwt, sign, verify } from "hono/jwt";
import { createClient } from "@supabase/supabase-js";

export const loginStudent: AppRouteHandler<LoginStudentRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
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

  if (!queried_student.studentId) {
    return c.json({ error: "Student ID not found for this student" }, 500);
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const payload = {
    student_id: queried_student.studentId, // Consistent key
    role: "student",
    email: queried_student.email,
  };
  console.log('JWT Payload:', payload);
  const sessionToken = await sign(payload, SECRET_KEY);
  console.log('Generated JWT:', sessionToken);

  setCookie(c, "student_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  return c.redirect("/student", 302);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  deleteCookie(c, "admin_session");
  deleteCookie(c, "staff_session");

  const studentSessionToken = getCookie(c, "student_session");
  const oauthSessionToken = getCookie(c, "oauth_session");
  const jwtToken = studentSessionToken || oauthSessionToken;
  console.log('Received student_session:', studentSessionToken);
  console.log('Received oauth_session:', oauthSessionToken);

  if (!jwtToken) {
    console.log('No session token found in cookies');
    return c.json({ error: "Unauthorized: No session found" }, 401);
  }

  let studentId = null;
  let userRole = null;
  const isOAuthLogin = !!oauthSessionToken;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    console.log('Decoded JWT Payload:', decoded);

    if (!decoded) {
      console.log('JWT decoding returned no payload');
      return c.json({ error: "Invalid session: No payload" }, 401);
    }

    studentId = decoded.student_id; // Prioritize student_id
    userRole = decoded.role;

    if (!studentId) {
      console.log('JWT missing student_id field');
      return c.json({ error: "Invalid session: Student ID missing" }, 401);
    }

    console.log('Extracted from JWT - studentId:', studentId, 'role:', userRole);
  } catch (error) {
    console.error("Session Verification Error:", error.message);
    return c.json({ error: "Invalid session: Token verification failed" }, 401);
  }

  if (userRole !== "student") {
    console.log('Role mismatch - Expected: student, Got:', userRole);
    return c.json({ error: "Unauthorized: Insufficient role" }, 403);
  }

  try {
    const student_details = await db
      .select({
        email: students.email,
        studentId: students.studentId,
        name: students.name,
      })
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1)
      .execute();

    console.log('Fetched student details from DB:', student_details);

    if (student_details.length === 0) {
      console.log('No student found in DB for studentId:', studentId);
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json({
      success: "Authorization successful",
      studentId: student_details[0].studentId,
      role: userRole,
      student: student_details[0],
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
};

export const registration: AppRouteHandler<RegStudentRoute> = async (c) => {
  try {
    deleteCookie(c, "admin_session");
    deleteCookie(c, "staff_session");

    const SECRET_KEY = process.env.SECRET_KEY!;
    const { email, password, staffEmail } = c.req.valid("json");

    if (!email.endsWith("@saec.ac.in")) {
      return c.json({ error: "Invalid email domain, must be @saec.ac.in" }, HttpStatusCodes.BAD_REQUEST);
    }

    const existingStudent = await db.select().from(students).where(eq(students.email, email)).limit(1);
    if (existingStudent.length > 0) {
      return c.json({ error: "Student already registered" }, HttpStatusCodes.CONFLICT);
    }

    const staffy = await db.select().from(staff).where(eq(staff.email, staffEmail)).limit(1);
    if (staffy.length === 0) {
      return c.json({ error: "Staff email not found" }, HttpStatusCodes.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = await db.insert(students).values({
      email,
      password: hashedPassword,
      staffId: staffy[0].staffId,
    }).returning();

    const sessionToken = await sign({
      student_id: newStudent[0].studentId,
      role: "student",
      email: newStudent[0].email,
    }, SECRET_KEY);

    setCookie(c, "student_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });

    return c.redirect("/student", HttpStatusCodes.MOVED_TEMPORARILY);
  } catch (error) {
    console.error("Student registration error:", error);
    return c.json({ error: "Internal server error" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// Remaining routes unchanged for brevity, but updated to use `student_id` consistently
export const getResume: AppRouteHandler<GetResumeRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let studentId = null;
    let userRole = null;

    const SECRET_KEY = process.env.SECRET_KEY!;
    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      console.log("Decoded JWT:", decoded);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id;
      userRole = decoded.role;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    if (userRole !== "student") {
      return c.json({ error: "Unauthorized: Insufficient role" }, 403);
    }

    const studentDetails = await db
      .select({
        name: students.name,
        email: students.email,
        phoneNumber: students.phoneNumber,
        regNo: students.regNo,
        department: students.department,
        tenthMark: students.tenthMark,
        twelfthMark: students.twelfthMark,
        cgpa: students.cgpa,
        noOfArrears: students.noOfArrears,
        skillSet: students.skillSet,
        languagesKnown: students.languagesKnown,
        url:students.url,
        linkedinUrl: students.linkedinUrl,
        githubUrl: students.githubUrl,
        batch: students.batch,
      })
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1)
      .execute();

    if (studentDetails.length === 0) {
      return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(studentDetails[0], HttpStatusCodes.OK);
  } catch (error) {
    console.error("Resume fetch error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};


export const displayDrives: AppRouteHandler<DisplayDrivesRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found", success: false }, 401);
  }

  let studentId = null;
  let userRole = null;

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing", success: false }, 401);
    }
    studentId = decoded.student_id;
    userRole = decoded.role;
    console.log('JWT Token Decoded:', decoded);
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session", success: false }, 401);
  }

  if (userRole !== "student") {
    return c.json({ error: "Unauthorized: Insufficient role", success: false }, 403);
  }

  try {
    const drivesList = await db.select().from(drive).execute();
    return c.json({
      success: "Fetched all drives successfully",
      studentId,
      role: userRole,
      drives_list: drivesList,
    }, 200);
  } catch (error) {
    console.error("Database query error:", error);
    return c.json({ error: "Failed to fetch data", success: false }, 500);
  }
};

// export const resumedetails: AppRouteHandler<CreateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }
//     const supabase = c.get("supabase")

//     let studentId = null;
//     let userRole = null;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       console.log("Decoded JWT:", decoded);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id;
//       userRole = decoded.role;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const resume = c.req.valid("json") as {
//       url?: string;
//       file?: string;
//       fileName?: string;
//       fileType?: string;
//       phoneNumber: number;
//       skillSet: string | null;
//       noOfArrears: number;
//       languagesKnown: string | null;
//       githubUrl: string;
//       linkedinUrl: string;
//       tenthMark: number | null;
//       cgpa: number | null;
//       batch: string;
//       department: string | null;
//       twelfthMark: number | null;
//     };
    
//     if (!resume || typeof resume !== "object") {
//       return c.json({ error: "Invalid resume details" }, 400);
//     }

//     let resumeUrl = resume.url; 

//     if (resume.file) {
//       const fileBuffer = Buffer.from(resume.file, "base64");
//       const fileName = `uploads/${Date.now()}_${resume.fileName}`;

//       const { data, error } = await supabase.storage
//         .from("bucky")
//         .upload(fileName, fileBuffer, {
//           contentType: resume.fileType,
//           cacheControl: "3600",
//           upsert: false,
//         });

//       if (error) {
//         console.error("Supabase Upload Error:", error);
//         return c.json({ error: "File upload failed" }, 500);
//       }

//       resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
//     }

//     if (userRole === "student") {
//       const resumeDetails = {
//         phoneNumber: resume.phoneNumber,
//         skillSet: resume.skillSet,
//         noOfArrears: resume.noOfArrears,
//         languagesKnown: resume.languagesKnown,
//         githubUrl: resume.githubUrl,
//         linkedinUrl: resume.linkedinUrl,
//         tenthMark: resume.tenthMark,
//         url: resumeUrl, 
//         cgpa: resume.cgpa,
//         batch: resume.batch,
//         department: resume.department,
//         twelfthMark: resume.twelfthMark,
//       };

//       const updatedResume = await db
//         .update(students)
//         .set(resumeDetails)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       return c.json(updatedResume, HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume creation error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };



// export const resumedetails: AppRouteHandler<CreateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     const supabase = c.get("supabase");
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     let studentId: string;
//     let userRole: string;

//     // Verify JWT token
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       console.log("Decoded JWT:", decoded);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session: Token verification failed" }, 401);
//     }

//     // Check user role
//     if (userRole !== "student") {
//       return c.json({ error: "Unauthorized: Insufficient permissions" }, 403);
//     }

//     // Validate and parse request body
//     const resume = c.req.valid("json") as {
//       url?: string;
//       file?: string;
//       fileName?: string;
//       fileType?: string;
//       phoneNumber?: number;
//       skillSet?: string | null;
//       noOfArrears?: number;
//       languagesKnown?: string | null;
//       githubUrl?: string;
//       linkedinUrl?: string;
//       tenthMark?: number | null;
//       cgpa?: number | null;
//       batch?: string;
//       department?: string | null;
//       twelfthMark?: number | null;
//     };

//     if (!resume || typeof resume !== "object") {
//       return c.json({ error: "Invalid resume details" }, 400);
//     }

//     let resumeUrl = resume.url;

//     // Handle file upload for profile picture
//     if (resume.file) {
//       if (!resume.fileType || !resume.fileType.startsWith("image/")) {
//         return c.json({ error: "Invalid file type: Only images are allowed" }, 400);
//       }

//       const fileBuffer = Buffer.from(resume.file, "base64");
//       const fileName = resume.fileName
//         ? `uploads/${Date.now()}_${resume.fileName}`
//         : `uploads/${Date.now()}_profile-pic`;

//       const { data, error } = await supabase.storage
//         .from("bucky")
//         .upload(fileName, fileBuffer, {
//           contentType: resume.fileType,
//           cacheControl: "3600",
//           upsert: true, // Overwrite if file exists with the same name
//         });

//       if (error) {
//         console.error("Supabase Upload Error:", error);
//         return c.json({ error: `File upload failed: ${error.message}` }, 500);
//       }

//       resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
//       console.log("Uploaded file URL:", resumeUrl);
//     }

//     // Prepare update data
//     const resumeDetails: Partial<typeof students.$inferInsert> = {
//       ...(resume.phoneNumber !== undefined && { phoneNumber: resume.phoneNumber }),
//       ...(resume.skillSet !== undefined && { skillSet: resume.skillSet }),
//       ...(resume.noOfArrears !== undefined && { noOfArrears: resume.noOfArrears }),
//       ...(resume.languagesKnown !== undefined && { languagesKnown: resume.languagesKnown }),
//       ...(resume.githubUrl !== undefined && { githubUrl: resume.githubUrl }),
//       ...(resume.linkedinUrl !== undefined && { linkedinUrl: resume.linkedinUrl }),
//       ...(resume.tenthMark !== undefined && { tenthMark: resume.tenthMark }),
//       ...(resumeUrl !== undefined && { url: resumeUrl }),
//       ...(resume.cgpa !== undefined && { cgpa: resume.cgpa }),
//       ...(resume.batch !== undefined && { batch: resume.batch }),
//       ...(resume.department !== undefined && { department: resume.department }),
//       ...(resume.twelfthMark !== undefined && { twelfthMark: resume.twelfthMark }),
//     };

//     // Update student data in the database
//     const updatedResume = await db
//       .update(students)
//       .set(resumeDetails)
//       .where(eq(students.studentId, studentId))
//       .returning();

//     if (updatedResume.length === 0) {
//       return c.json({ error: "Student not found" }, 404);
//     }

//     return c.json(updatedResume[0], HttpStatusCodes.OK);
//   } catch (error) {
//     console.error("Resume creation error:", error);
//     return c.json({ error: "Internal server error" }, 500);
//   }
// };




// export const resumedetails: AppRouteHandler<CreateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     const supabase = c.get("supabase");
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     let studentId: string;
//     let userRole: string;

//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     if (userRole !== "student") {
//       return c.json({ error: "Unauthorized" }, 403);
//     }

//     const resume = c.req.valid("json");

//     let resumeUrl = resume.url;

//     if (resume.file) {
//       const fileBuffer = Buffer.from(resume.file, "base64");
//       const fileName = `uploads/${Date.now()}_${resume.fileName || 'profile-pic'}`;

//       const { data, error } = await supabase.storage
//         .from("bucky")
//         .upload(fileName, fileBuffer, {
//           contentType: resume.fileType || 'image/jpeg',
//           cacheControl: "3600",
//           upsert: true,
//         });

//       if (error) {
//         console.error("Supabase Upload Error:", error);
//         return c.json({ error: "File upload failed" }, 500);
//       }

//       resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
//     }

//     const resumeDetails = {
//       ...(resume.phoneNumber !== undefined && { phoneNumber: resume.phoneNumber }),
//       ...(resume.skillSet !== undefined && { skillSet: resume.skillSet }),
//       ...(resume.noOfArrears !== undefined && { noOfArrears: resume.noOfArrears }),
//       ...(resume.languagesKnown !== undefined && { languagesKnown: resume.languagesKnown }),
//       ...(resume.githubUrl !== undefined && { githubUrl: resume.githubUrl }),
//       ...(resume.linkedinUrl !== undefined && { linkedinUrl: resume.linkedinUrl }),
//       ...(resume.tenthMark !== undefined && { tenthMark: resume.tenthMark }),
//       ...(resumeUrl !== undefined && { url: resumeUrl }),
//       ...(resume.cgpa !== undefined && { cgpa: resume.cgpa }),
//       ...(resume.batch !== undefined && { batch: resume.batch }),
//       ...(resume.department !== undefined && { department: resume.department }),
//       ...(resume.twelfthMark !== undefined && { twelfthMark: resume.twelfthMark }),
//     };

//     const updatedResume = await db
//       .update(students)
//       .set(resumeDetails)
//       .where(eq(students.studentId, studentId))
//       .returning();

//     return c.json(updatedResume[0], HttpStatusCodes.OK);
//   } catch (error) {
//     console.error("Resume creation error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };

// export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     let studentId = null;
//     let userRole = null;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id;
//       userRole = decoded.role;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const updateData = c.req.valid("json");
//     if (!updateData || typeof updateData !== "object") {
//       return c.json({ error: "Invalid update details" }, 400);
//     }

//     if (userRole === "student") {
//       const updatedResume = await db
//         .update(students)
//         .set(updateData)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       return c.json(updatedResume[0], HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume update error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };



// export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     let studentId: string;
//     let userRole: string;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const updateData = c.req.valid("json");
//     if (!updateData || typeof updateData !== "object") {
//       return c.json({ error: "Invalid update details" }, 400);
//     }

//     if (userRole === "student") {
//       const updatedResume = await db
//         .update(students)
//         .set(updateData)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       if (updatedResume.length === 0) {
//         return c.json({ error: "Student not found" }, 404);
//       }

//       return c.json(updatedResume[0], HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume update error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };




// export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     let studentId: string;
//     let userRole: string;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const updateData = c.req.valid("json");
//     if (!updateData || typeof updateData !== "object") {
//       return c.json({ error: "Invalid update details" }, 400);
//     }

//     if (userRole === "student") {
//       const updatedResume = await db
//         .update(students)
//         .set(updateData)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       if (updatedResume.length === 0) {
//         return c.json({ error: "Student not found" }, 404);
//       }

//       return c.json(updatedResume[0], HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume update error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };





// export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     let studentId: string;
//     let userRole: string;

//     const SECRET_KEY = process.env.SECRET_KEY!;
//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const updateData = c.req.valid("json");
//     if (!updateData || typeof updateData !== "object") {
//       return c.json({ error: "Invalid update details" }, 400);
//     }




//     if (userRole === "student") {
//       const updatedResume = await db
//         .update(students)
//         .set(updateData)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       if (updatedResume.length === 0) {
//         return c.json({ error: "Student not found" }, 404);
//       }

//       return c.json(updatedResume[0], HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume update error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };

// export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
//   try {
//     const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
//     if (!jwtToken) {
//       return c.json({ error: "Unauthorized: No session found" }, 401);
//     }

//     const supabase = c.get("supabase"); // Added Supabase client
//     const SECRET_KEY = process.env.SECRET_KEY!;
//     let studentId: string;
//     let userRole: string;

//     try {
//       const decoded = await verify(jwtToken, SECRET_KEY);
//       if (!decoded || !decoded.student_id) {
//         return c.json({ error: "Invalid session: Student ID missing" }, 401);
//       }
//       studentId = decoded.student_id as string;
//       userRole = decoded.role as string;
//     } catch (error) {
//       console.error("Session Verification Error:", error);
//       return c.json({ error: "Invalid session" }, 401);
//     }

//     const updateData = c.req.valid("json");
//     if (!updateData || typeof updateData !== "object") {
//       return c.json({ error: "Invalid update details" }, 400);
//     }

//     let resumeUrl = updateData.url; // Extract existing URL if provided

//     // Handle file upload with Supabase
//     if (updateData.file) {
//       const fileBuffer = Buffer.from(updateData.file, "base64");
//       const fileName = updateData.fileName
//         ? `uploads/${Date.now()}_${updateData.fileName}`
//         : `uploads/${Date.now()}_profile-pic`;

//       const { data, error } = await supabase.storage
//         .from("bucky")
//         .upload(fileName, fileBuffer, {
//           contentType: updateData.fileType || 'image/jpeg',
//           cacheControl: "3600",
//           upsert: true,
//         });

//       if (error) {
//         console.error("Supabase Upload Error:", error);
//         return c.json({ error: "File upload failed" }, 500);
//       }

//       resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
//     }

//     if (userRole === "student") {
//       // Merge updateData with the new resumeUrl if applicable
//       const resumeDetails = {
//         ...updateData,
//         ...(resumeUrl !== undefined && { url: resumeUrl }), // Override url with new value if file was uploaded
//       };

//       const updatedResume = await db
//         .update(students)
//         .set(resumeDetails)
//         .where(eq(students.studentId, studentId))
//         .returning();

//       if (updatedResume.length === 0) {
//         return c.json({ error: "Student not found" }, 404);
//       }

//       return c.json(updatedResume[0], HttpStatusCodes.OK);
//     }

//     return c.json({ error: "Unauthorized" }, 403);
//   } catch (error) {
//     console.error("Resume update error:", error);
//     return c.json({ error: "Something went wrong" }, 500);
//   }
// };








export const applyForDrive: AppRouteHandler<ApplyForDriveRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
    }

    let studentId = null;
    const SECRET_KEY = process.env.SECRET_KEY!;

    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
      }
      studentId = decoded.student_id;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const { id } = c.req.valid("json");
    if (!id) {
      return c.json({ error: "Missing drive ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const existingApplication = await db
      .select()
      .from(applications)
      .where(and(eq(applications.studentId, studentId), eq(applications.driveId, id)))
      .limit(1)
      .execute();

    if (existingApplication.length > 0) {
      return c.json({ message: "You have already applied for this drive" }, HttpStatusCodes.OK);
    }

    await db.insert(applications).values({
      studentId,
      driveId: id,
      appliedAt: new Date().toISOString(),
    });

    return c.json({ message: "Applied successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Application error:", error);
    return c.json({ error: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const removeApplication: AppRouteHandler<RemoveApplicationRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");

  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let studentId = null;
  const SECRET_KEY = process.env.SECRET_KEY!;
  try {
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
    }
    studentId = decoded.student_id;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { id } = c.req.valid("json");
  const deleted = await db
    .delete(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.driveId, id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Application not found" }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json({ message: "Application removed successfully" }, HttpStatusCodes.OK);
};

export const checkApplicationStatus: AppRouteHandler<CheckApplicationStatusRoute> = async (c) => {
  deleteCookie(c, "staff_session");
  deleteCookie(c, "admin_session");

  const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
  if (!jwtToken) {
    return c.json({ error: "Unauthorized: No session found" }, HttpStatusCodes.UNAUTHORIZED);
  }

  let studentId = null;
  const SECRET_KEY = process.env.SECRET_KEY!;
  try {
    const decoded = await verify(jwtToken, SECRET_KEY);
    console.log("JWT Decoded:", decoded);
    if (!decoded || !decoded.student_id) {
      return c.json({ error: "Invalid session: Student ID missing" }, HttpStatusCodes.UNAUTHORIZED);
    }
    studentId = decoded.student_id;
  } catch (error) {
    console.error("Session Verification Error:", error);
    return c.json({ error: "Invalid session" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { driveId } = c.req.param();
  console.log(`Checking application - studentId: ${studentId}, driveId: ${driveId}`);
  const existingApplication = await db
    .select()
    .from(applications)
    .where(and(eq(applications.studentId, studentId), eq(applications.driveId, parseInt(driveId))))
    .limit(1)
    .execute();
  console.log("Query Result:", existingApplication);

  const applied = existingApplication.length > 0;
  console.log(`Result for drive ${driveId}: applied = ${applied}`);
  return c.json({ applied }, HttpStatusCodes.OK);
};


export const logoutStudent: AppRouteHandler<LogoutStudentRoute> = async (c) => {
  const jwtoken = getCookie(c, "student_session")
  if (!jwtoken) {
    return c.json({ error: "No session found" }, 401);
  } else {
    deleteCookie(c, "student_session");
  }
  return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
};



export const forgotPassword: AppRouteHandler<ForgotPassword> = async (c) => {
  try {
    const { email } = c.req.valid("json");
    const supabase = c.get("supabase");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:5173/student/reset-password`,
    });

    if (error) {
      console.error("Supabase Forgot Password Error:", error);
      return c.json({ error: error.message, success: false }, 400);
    }

    return c.json({ message: "Password reset email sent", success: true }, 200);
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return c.json({ error: "Something went wrong", success: false }, 500);
  }
};




export const resetPassword: AppRouteHandler<ResetPassword> = async (c) => {
  try {
    const { token, newPassword } = c.req.valid("json");

    console.log('Received payload:', { token, newPassword });

    if (!token || !newPassword) {
      console.error('Missing token or password');
      return c.json({ error: 'Missing token or password' }, 400);
    }

    const decodedToken = decode(token);

    console.log('Decoded Token:', decodedToken);

    if (!decodedToken || !decodedToken.payload.email) {
      console.error('Invalid token or missing email');
      return c.json({ error: 'Invalid token or expired link' }, 401);
    }

    const userEmail = decodedToken.payload.email;
    console.log(`Resetting password for: ${userEmail}`);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedRows = await db
      .update(students)
      .set({ password: hashedPassword })
      .where(eq(students.email, userEmail))
      .returning();

    console.log('Password reset successfully');
    return c.json({ message: 'Password reset successfully' }, 200);

  } catch (error) {
    console.error('Internal server error:', error);
    return c.json({ error: 'Something went wrong' }, 500);
  }
};




export const updateResume: AppRouteHandler<UpdateResumeRoute> = async (c) => {
  try {
    const jwtToken = getCookie(c, "student_session") || getCookie(c, "oauth_session");
    if (!jwtToken) {
      return c.json({ error: "Unauthorized: No session found" }, 401);
    }

    let supabase = c.get("supabase");
    if (!supabase) {
      console.warn("Supabase client not found in context. Initializing manually.");
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.");
      }
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    const SECRET_KEY = process.env.SECRET_KEY!;
    let studentId: string;
    let userRole: string;

    try {
      const decoded = await verify(jwtToken, SECRET_KEY);
      if (!decoded || !decoded.student_id) {
        return c.json({ error: "Invalid session: Student ID missing" }, 401);
      }
      studentId = decoded.student_id as string;
      userRole = decoded.role as string;
    } catch (error) {
      console.error("Session Verification Error:", error);
      return c.json({ error: "Invalid session" }, 401);
    }

    const updateData = c.req.valid("json");
    if (!updateData || typeof updateData !== "object") {
      return c.json({ error: "Invalid update details" }, 400);
    }

    let resumeUrl = updateData.url; // Extract existing URL if provided

    // Handle file upload with Supabase
    if (updateData.file) {
      if (typeof updateData.file !== "string") {
        return c.json({ error: "Invalid file: Must be a base64-encoded string" }, 400);
      }

      const fileBuffer = Buffer.from(updateData.file, "base64");
      const fileName = updateData.fileName
        ? `uploads/${Date.now()}_${updateData.fileName}`
        : `uploads/${Date.now()}_profile-pic`;

      const { data, error } = await supabase.storage
        .from("bucky")
        .upload(fileName, fileBuffer, {
          contentType: updateData.fileType || "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (error) {
        console.error("Supabase Upload Error:", error);
        return c.json({ error: `File upload failed: ${error.message}` }, 500);
      }

      resumeUrl = supabase.storage.from("bucky").getPublicUrl(data.path).data.publicUrl;
      console.log("Uploaded file URL:", resumeUrl);
    }

    if (userRole === "student") {
      const resumeDetails = {
        ...updateData,
        ...(resumeUrl !== undefined && { url: resumeUrl }), // Override url with new value if file was uploaded
      };

      const updatedResume = await db
        .update(students)
        .set(resumeDetails)
        .where(eq(students.studentId, studentId))
        .returning();

      if (updatedResume.length === 0) {
        return c.json({ error: "Student not found" }, 404);
      }

      return c.json(updatedResume[0], HttpStatusCodes.OK);
    }

    return c.json({ error: "Unauthorized" }, 403);
  } catch (error) {
    console.error("Resume update error:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
};