import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired} from "stoker/openapi/helpers";
import { createErrorSchema, IdUUIDParamsSchema, createMessageObjectSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { insertSuperAdminSchema, loginSuperAdminSchema, selectSuperAdminSchema } from "@/db/schemas/superAdminSchema";
import { insertStaffSchema, selectStaffSchema } from "@/db/schemas/staffSchema";
import { insertStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { jwt } from "hono/jwt";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";





//get super admin data
export const oauth = createRoute({
  path: "/users/oauth",
  method: "get",
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
        description: "Redirect to the dashboard page",
        headers: {
          Location: {
            schema: {
              type: 'string',
            },
          },  
        }, 
      },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(createMessageObjectSchema("Something went wrong while logging in"), "Server error message for Oauth")
  },
  middleware: [supabaseMiddleware] as const
}
)

export const oauthSuccess = createRoute({
    path: "/users/oauth/success",
    method: "get",
    request: {
        query: z.object({
            next: z.string().optional(),
            code: z.string(),
        })
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(createMessageObjectSchema("ok"), "adasdf"),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(createMessageObjectSchema("Unauthorized"), "Custom message for unauthorization"),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]:jsonContent(createMessageObjectSchema("Internal server error"),"Internalservererror")
    },
    middleware: [supabaseMiddleware] as const
})


// New OAuth route for students
export const oauthStudent = createRoute({
  path: "/auth/oauth/student",
  method: "get",
  responses: {
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to OAuth provider for student login",
      headers: {
        Location: {
          schema: { type: "string" },
        },
      },
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ message: z.string() }),
      "OAuth initiation failed"
    ),
  },
});

export type OAuthRoute = typeof oauth;
export type OAuthSuccessRoute = typeof oauthSuccess;
export type OAuthStudentRoute = typeof oauthStudent;