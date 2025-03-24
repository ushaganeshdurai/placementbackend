import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { loginStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";
import { selectDriveSchema } from "@/db/schemas/driveSchema";
import { forgotPasswordSchema } from "../staffs/staff.routes";

export const loginStudent = createRoute({
  path: "/student/login",
  method: "post",
  request: {
    body: jsonContentRequired(loginStudentSchema, "The student's login credentials"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      { message: "Invalid credentials" },
      "Unauthorized access"
    ),
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to the student's page",
      headers: {
        Location: {
          schema: {
            type: 'string',
          },
        },
      },
    },
  },
  middleware: [supabaseMiddleware] as const
});

export const getOne = createRoute({
  path: "/student",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectStudentSchema,
      "The requested student details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectStudentSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Student not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});

export const getResume = createRoute({
  path: "/student/resume",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectStudentSchema,
      "The requested student resume details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectStudentSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Student not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});


export const displayDrives = createRoute({
  path: "/student/displaydrives",
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
  },
  middlewares: [supabaseMiddleware],
});

const driveIdSchema = z.object({
  id: z.number()
});

export const applyfordrive = createRoute({
  path: "/student/applyfordrive",
  method: "post",

  request: {
    body: jsonContentRequired(driveIdSchema, "drive Id is needed")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Applied for drive successfully"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Incorrect password"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Student not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const updatepassword = createRoute({
  path: "/student/updatepassword",
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

export const updateResume = createRoute({
  path: "/student/resume",
  method: "patch",
  request: {
    body: jsonContentRequired(
      z.object({
        file: z.string().optional(), // Base64 string for the file
        fileName: z.string().optional(), // Optional filename
        fileType: z.string().optional(),
      }).passthrough(), // Allow any fields
      "Update specific resume details"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectStudentSchema, "Updated student resume details"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createErrorSchema(z.object({})),
      "Invalid update details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), "Unauthorized access"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Student not found"),
  },
  middlewares: [supabaseMiddleware],
});



export const forgotpassword = createRoute({
  path: "/student/forgot-password",
  method: "post",
  request: {
    body: jsonContentRequired(forgotPasswordSchema, "forgot student password")
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
      "Student not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});



//reset password
export const resetpassword = createRoute({
  path: "/student/reset-password",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Password must be at least 6 characters long"),
      }),
      "Reset student password"
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
      "Student not found"
    ),
  },
});




export const removeApplication = createRoute({
  path: "/student/remove-application",
  method: "delete",
  request: {
    body: jsonContentRequired(
      z.object({ id: z.number() }),
      "Drive ID to remove application"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      "Application removed successfully"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Unauthorized access"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Application or drive not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});

export const checkApplicationStatus = createRoute({
  path: "/student/check-application-status/:driveId",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ applied: z.boolean() }),
      "Whether the student has applied for the drive"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Unauthorized access"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Drive not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});

export const registerStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  staffEmail: z.string().email()
})

export const registration = createRoute({
  path: "/student/signup",
  method: "post",
  request: {
    body: jsonContentRequired(registerStudentSchema, "The student's registration credentials"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      { message: "Invalid credentials" },
      "Unauthorized access"
    ),
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to the student's page",
      headers: {
        Location: {
          schema: {
            type: 'string',
          },
        },
      },
    },
  },
  middleware: [supabaseMiddleware] as const
});

export const logoutStudent = createRoute({
  path: "/student/logout",
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

export type RegStudentRoute = typeof registration;
export type CheckApplicationStatusRoute = typeof checkApplicationStatus;
export type RemoveApplicationRoute = typeof removeApplication;
export type GetResumeRoute = typeof getResume;
export type UpdateResumeRoute = typeof updateResume;
export type LoginStudentRoute = typeof loginStudent
export type GetOneRoute = typeof getOne;
export type ForgotPassword = typeof forgotpassword
export type ResetPassword = typeof resetpassword
export type ApplyForDriveRoute = typeof applyfordrive
export type UpdatePasswordRoute = typeof updatepassword
export type DisplayDrivesRoute = typeof displayDrives
export type LogoutStudentRoute = typeof logoutStudent