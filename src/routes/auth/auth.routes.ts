import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";

export const oauth = createRoute({
  path: "/users/oauth",
  method: "get",
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to OAuth provider",
      headers: { Location: { schema: { type: 'string' } } },
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(createMessageObjectSchema("Something went wrong"), "Server error"),
  },
  middleware: [supabaseMiddleware] as const,
});

export const oauthStudent = createRoute({
  path: "/oauth/student",
  method: "get",
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to OAuth provider for student",
      headers: { Location: { schema: { type: "string" } } },
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(createMessageObjectSchema("Something went wrong"), "OAuth initiation failed"),
  },
  middleware: [supabaseMiddleware] as const,
});

export const oauthStaff = createRoute({
  path: "/oauth/staff",
  method: "get",
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to OAuth provider for staff",
      headers: { Location: { schema: { type: "string" } } },
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(createMessageObjectSchema("Something went wrong"), "OAuth initiation failed"),
  },
  middleware: [supabaseMiddleware] as const,
});

export const oauthSuccess = createRoute({
  path: "/users/oauth/success",
  method: "get",
  request: {
    query: z.object({
      next: z.string().optional(),
      code: z.string(),
      intendedRole: z.enum(["student", "staff", "super_admin"]).optional(),
      returnUrl: z.string().optional(), // Add returnUrl
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({
      success: z.boolean(),
      role: z.enum(["student", "staff", "super_admin"]),
      userId: z.string(),
      email: z.string(),
      message: z.string(),
      redirect: z.string(),
    }), "Successful OAuth login"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({
      success: z.literal(false),
      message: z.string(),
      redirect: z.string(),
    }), "Unauthorized access"),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(z.object({
      success: z.literal(false),
      message: z.string(),
      redirect: z.string(),
    }), "Server error"),
  },
  middleware: [supabaseMiddleware] as const,
});

export const session = createRoute({
  path: "/session",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({
      success: z.literal(true),
      role: z.enum(["super_admin", "staff", "student"]),
    }), "Session valid"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(createMessageObjectSchema("Unauthorized"), "Invalid or missing session"),
  },
  middleware: [supabaseMiddleware] as const,
});

export type OAuthRoute = typeof oauth;
export type OAuthStudentRoute = typeof oauthStudent;
export type OAuthStaffRoute = typeof oauthStaff;
export type OAuthSuccessRoute = typeof oauthSuccess;
export type SessionRoute = typeof session;