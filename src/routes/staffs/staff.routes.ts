import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { loginStaffSchema, selectStaffSchema } from "@/db/schemas/staffSchema";
import { insertStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";
import { insertDriveSchema, selectDriveSchema } from "@/db/schemas/driveSchema";
import { selectApplicationsSchema } from "@/db/schemas/applicationsSchema";
import { createInsertSchema } from "drizzle-zod";
import { students } from "drizzle/schema";

// Log in the staff
export const loginStaff = createRoute({
  path: "/staff/login",
  method: "post",
  request: {
    body: jsonContentRequired(loginStaffSchema, "The staff login credentials"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        staffId: z.string(),
        role: z.literal("staff"),
      }),
      "Staff login successful"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Unauthorized access"
    ),
  },
});

// Display staff data
export const getOne = createRoute({
  path: "/staff",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.string(),
        staffId: z.string(),
        role: z.string(),
        staff: selectStaffSchema,
        students: z.array(selectStudentSchema),
        drives: z.array(selectDriveSchema),
      }),
      "The requested staff details including jobs"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectStaffSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Staff not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});

// Create many students
export const createstudentsroute = createRoute({
  path: "/staff/createstudents",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertStudentSchema),
      "Add multiple students",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectStudentSchema),
      "Created many students",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStudentSchema),
      "The validation error(s)",
    ),
  },
});

// Create jobs
export const createjobalertroute = createRoute({
  path: "/staff/createjobs",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertDriveSchema),
      "Add multiple drives",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectDriveSchema),
      "Created many drives",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertDriveSchema),
      "The validation error(s)",
    ),
  },
});

export const jobIdSchema = z.object({
  id: z.string().transform((val) => Number(val)), // Coerce string to number
});

export const removejobroute = createRoute({
  path: "/staff/job/{id}",
  method: "delete",
  request: {
    params: jobIdSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Job deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Job listing not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(jobIdSchema),
      "Invalid id error",
    ),
  },
});

// Remove one student
export const removestudentroute = createRoute({
  path: "/staff/student/{id}",
  method: "delete",
  request: {
    params: IdUUIDParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Student deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Student not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid id error",
    ),
  },
});

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

// Update password
export const updatepassword = createRoute({
  path: "/staff/updatepassword",
  method: "patch",
  request: {
    body: jsonContentRequired(updatePasswordSchema, "Update staff password")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Password updated successfully"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createErrorSchema(updatePasswordSchema),
      "Missing or invalid password details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Incorrect old password"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Staff not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});

export const displayDrives = createRoute({
  path: "/staff/displaydrives",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectDriveSchema,
      "The requested drive details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectDriveSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Drive not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});

// See all the students who have registered for a specific drive
// export const registeredStudents = createRoute({
//   path: "/staff/registeredstudents/{driveId}",
//   method: "get",
//   request: {
//     params: z.object({
//       driveId: z.string().transform((val) => Number(val)), // Coerce to number
//     }),
//   },
//   responses: {
//     [HttpStatusCodes.OK]: jsonContent(
//       z.array(selectApplicationsSchema),
//       "The requested applicant list for a specific drive"
//     ),
//     [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
//       createErrorSchema(selectApplicationsSchema),
//       "Unauthorized access - Token required"
//     ),
//     [HttpStatusCodes.NOT_FOUND]: jsonContent(
//       notFoundSchema,
//       "No registrations for this drive"
//     ),
//   },
//   middlewares: [supabaseMiddleware],
// });



export const registeredStudents = createRoute({
  path: "/staff/registeredstudents/{driveId}",
  method: "get",
  request: {
    params: z.object({
      driveId: z.string().transform((val) => Number(val)), // Coerce to number
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectApplicationsSchema),
      "The requested applicant list for a specific drive"
    ),
    // ... other responses
  },
  middlewares: [supabaseMiddleware],
});


// export const insertStudentsSchema = createInsertSchema(students)
//   .required({
//     email: true,
//     password: true,
//   })
//   .omit({
//     studentId: true,
//     userId: true,
//     department: true,
//     placedStatus: true,
//     staffId: true,
//     skillSet: true,
//     languagesKnown: true,
//     phoneNumber: true,
//     noOfArrears: true,
//     githubUrl: true,
//     linkedinUrl: true,
//     twelfthMark: true,
//     tenthMark: true,
//     cgpa: true,
//     name: true,
//     regNo: true,
//     rollNo: true,
//     year: true,
//   })
//   .extend({
//     staffEmail: z.string().email(),
//   });

// Bulk upload students
// export const bulkuploadstudents = createRoute({
//   path: "/staff/bulkuploadstudents",
//   method: "post",
//   request: {
//     body: jsonContentRequired(
//       z.array(insertStudentsSchema),
//       "Add multiple students",
//     ),
//   },
//   responses: {
//     [HttpStatusCodes.OK]: jsonContent(
//       z.array(selectStudentSchema),
//       "Created many students",
//     ),
//     [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
//       createErrorSchema(insertStudentsSchema),
//       "The validation error(s)",
//     ),
//   },
// });


export const bulkuploadstudents = createRoute({
  path: "/staff/bulkuploadstudents",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertStudentSchema),
      "Add multiple students"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectStudentSchema),
      "Created many students"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStudentSchema),
      "The validation error(s)"
    ),
  },
});



const placedStudentsSchema = createInsertSchema(students)
  .required({
    email: true,
  }).omit({
    studentId: true,
    userId: true,
    department: true,
    placedStatus: true,
    staffId: true,
    skillSet: true,
    languagesKnown: true,
    phoneNumber: true,
    noOfArrears: true,
    githubUrl: true,
    linkedinUrl: true,
    twelfthMark: true,
    tenthMark: true,
    cgpa: true,
    name: true,
    regNo: true,
    rollNo: true,
    batch: true, password: true
  })

export const placedstudents = createRoute({
  path: "/staff/updateplacedstudentslist",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(placedStudentsSchema), "Updated status"
    )
  }, responses: {
    [HttpStatusCodes.OK]: {
      description: "Updated placed students list"
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(loginStaffSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(placedStudentsSchema),
      "The validation error(s)",
    ),
  },
})


export const logoutStaff = createRoute({
  path: "/staff/logout",
  method: "post",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      { message: "Logged out successfully" },
      "Successful logout"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      { message: "No active session" },
      "Unauthorized access"
    ),
  },
  middlewares: [supabaseMiddleware],
});


export type PlacedStudentsRoute = typeof placedstudents;
export type LogoutStaffRoute = typeof logoutStaff;
export type LoginStaffRoute = typeof loginStaff;
export type GetOneRoute = typeof getOne;
export type CreateStudentsRoute = typeof createstudentsroute;
export type RemoveStudentRoute = typeof removestudentroute;
export type CreateJobAlertRoute = typeof createjobalertroute;
export type RemoveJobRoute = typeof removejobroute;
export type UpdatePasswordRoute = typeof updatepassword;
export type DisplayDrivesRoute = typeof displayDrives;
export type BulkUploadStudentsRoute = typeof bulkuploadstudents;
export type RegisteredStudentsRoute = typeof registeredStudents; // Updated type name