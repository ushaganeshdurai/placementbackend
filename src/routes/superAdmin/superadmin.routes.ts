import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { loginSuperAdminSchema, selectSuperAdminSchema } from "@/db/schemas/superAdminSchema";
import { insertStaffSchema, selectStaffSchema } from "@/db/schemas/staffSchema";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";
import { jobIdSchema } from "../staffs/staff.routes";
import { insertDriveSchema, selectDriveSchema } from "@/db/schemas/driveSchema";
import { selectApplicationsSchema } from "@/db/schemas/applicationsSchema";



//log in the admin
export const loginAdmin = createRoute({
  path: "/superadmin/login",
  method: "post",
  request: {
    body: jsonContentRequired(loginSuperAdminSchema, "The super admin login credentials"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      { message: "Invalid credentials" },
      "Unauthorized access"
    ),
    [HttpStatusCodes.MOVED_TEMPORARILY]: {
      description: "Redirect to the admin page",
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




//to display what is in particular admin's data
export const getOne = createRoute({
  path: "/superadmin",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectSuperAdminSchema,
      "The requested super admin with student and staff details"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectSuperAdminSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Super Admin not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});



//get staffs multiple data (post request)
export const createstaffsroute = createRoute({
  path: "/superadmin/createstaffs",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertStaffSchema),  // The request expects an array of staff objects
      "Add multiple staffs",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContentRequired(
      z.array(selectStaffSchema),  // The response will contain an array of created staff objects
      "Created many staffs",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStaffSchema),
      "The validation error(s)",
    ),
  },
});



//get the id of staff to be deleted from params

export const removestaffroute = createRoute({
  path: "/superadmin/staff/{id}",
  method: "delete",
  request: {
    params: IdUUIDParamsSchema,
  },

  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Staff deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Staff not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid id error",
    ),
  },
});

//jobs:

export const createjobroute = createRoute({
  path: "/superadmin/createjobs",
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


export const removedriveroute = createRoute({
  path: "/superadmin/job/{id}",
  method: "delete",
  request: {
    params: jobIdSchema,
  },

  responses: {
    [HttpStatusCodes.OK]: {
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



export const registeredstudents = createRoute({
  path: "/superadmin/registeredstudents",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectApplicationsSchema,
      "The requested applicant list"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(selectApplicationsSchema),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Registered students not found"
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid ID format"
    ),
  },
  middlewares: [supabaseMiddleware],
});


export type LoginSuperAdmin = typeof loginAdmin
export type GetOneRoute = typeof getOne;
export type CreateStaffsRoute = typeof createstaffsroute;
export type RemoveStaffRoute = typeof removestaffroute;
export type RemoveDriveRoute = typeof removedriveroute
export type CreateJobsRoute = typeof createjobroute
export type RegisteredStudentsRoute = typeof registeredstudents

