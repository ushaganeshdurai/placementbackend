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
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { groupMails, students } from "drizzle/schema";
import { insertEventSchema } from "@/db/schemas/eventSchema";

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



const placedStudentsSchema = z.object({
  emails: z.array(z.string().email()).nonempty(),
  companyName: z.string().nonempty(),
});

export const placedstudentsRoute = createRoute({
  path: "/staff/updateplacedstudentslist",
  method: "post",
  request: {
    body: jsonContentRequired(placedStudentsSchema, "Updated status"),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "Updated placed students list",
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(loginStaffSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(placedStudentsSchema),
      "The validation error(s)"
    ),
  },
});


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

export const feedGroupMail = createRoute({
  path: "/staff/feedgroupmail",
  method: "post",
  body: jsonContentRequired(
    z.array(z.string().email()).nonempty(),
    "List of emails to be added"
  ),
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(
        z.object({
          id: z.number(),
          email: z.string().email(),
        })
      ),
      "Successfully added emails"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createErrorSchema(z.object({ error: z.string() })),
      "Invalid request format"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: {
      description: "Unauthorized access - Token required",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({ error: z.string() })),
      "Unexpected server error"
    ),
  },
  middlewares: [supabaseMiddleware], // Ensures authentication
});

export const selectMailSchema = createSelectSchema(groupMails).omit({
  id: true
});

export const getFeedGroupMail = createRoute({
  path: "/staff/getfeedgroupmail",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMailSchema,
      "The requested mail details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: {
      description:
        "Unauthorized access - Token required"
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Group Mail not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});


export const forgotPasswordSchema = z.string().email();
//forgot password

export const forgotpassword = createRoute({
  path: "/staff/forgot-password",
  method: "post",
  request: {
    body: jsonContentRequired(forgotPasswordSchema, "forgot staff password")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Forgot Password initiated successfully"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createErrorSchema(forgotPasswordSchema),
      "Missing or invalid email details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Incorrect email"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Staff not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});


//reset password
export const resetpassword = createRoute({
  path: "/staff/reset-password",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Password must be at least 6 characters long"),
      }),
      "Reset staff password"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Password reset successfully"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid or missing token/password"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid token or expired link"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Staff not found"
    ),
  },
});

export const createeventsroute = createRoute({
  path: "/staff/add-events",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.object({
        event_name: z.string().min(3, "Event name is required"),
        event_link: z.string().url("Invalid event link format"),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid date format",
        }),
        file: z.string().optional(),      
        fileName: z.string().optional(),
        fileType: z.string().optional(),  
      }).passthrough(),
      "Event details including optional file upload"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        id: z.number(),
        event_name: z.string(),
        event_link: z.string(),
        date: z.string(),
        url: z.string().nullable(),
        staff_id: z.string(),
      }),
      "Successfully created event"
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      "Invalid event data"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Unauthorized access"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      "Server error during event creation"
    ),
  },
});


const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});
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



export type ForgotPassword = typeof forgotpassword
export type ResetPassword = typeof resetpassword
export type PlacedStudentsRoute = typeof placedstudentsRoute;
export type LogoutStaffRoute = typeof logoutStaff;
export type FeedGroupMailRoute = typeof feedGroupMail
export type LoginStaffRoute = typeof loginStaff;
export type GetOneRoute = typeof getOne;
export type CreateStudentsRoute = typeof createstudentsroute;
export type RemoveStudentRoute = typeof removestudentroute;
export type CreateJobAlertRoute = typeof createjobalertroute;
export type RemoveJobRoute = typeof removejobroute;
export type DisplayDrivesRoute = typeof displayDrives;
export type UpdatePasswordRoute = typeof updatepassword
export type BulkUploadStudentsRoute = typeof bulkuploadstudents;
export type GetFeedGroupMailRoute = typeof getFeedGroupMail;
export type RegisteredStudentsRoute = typeof registeredStudents; 
export type CreateEventsRoute = typeof createeventsroute;