import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { insertSuperAdminSchema, loginSuperAdminSchema, selectSuperAdminSchema } from "@/db/schemas/superAdminSchema";
import { insertStaffSchema, selectStaffSchema } from "@/db/schemas/staffSchema";
import { insertStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";


//get super admin data
export const create = createRoute({
  path: "/superadmin/register",
  method: "post",
  request: {
    body: jsonContentRequired(
      insertSuperAdminSchema,
      "The super admin to register",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectSuperAdminSchema,
      "The created super admin",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertSuperAdminSchema),
      "The validation error(s)",
    ),
  },
});


//log in the admin
export const loginAdmin = createRoute({
  path: "/superadmin",
  method: "post",
  request: {
    body: jsonContentRequired(loginSuperAdminSchema, "The super admin login credentials"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      { message: "Invalid credentials" },
      "Unauthorized access"
    ),
    [302]: {
      description: "Redirect to the admin page",
      headers: {
        Location: {
          schema: {
            type: 'string',
            example: '/superadmin/{id}',
          },
        },  
      }, 
    },
  },
});





export const remove = createRoute({
  path: "/superadmin/{id}",
  method: "delete",
  request: {
    params: IdUUIDParamsSchema,
  },

  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Super Admin deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Super Admin not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid id error",
    ),
  },
});



//to display what is in particular admin's data
export const getOne = createRoute({
  path: "/superadmin/{id}",
  method: "get",
  request: {
    params: IdUUIDParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectSuperAdminSchema,
      "The requested super admin",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Super Admin not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdUUIDParamsSchema),
      "Invalid id error",
    ),
  },
});






//get staffs multiple data (post request)
export const createstaffsroute = createRoute({
  path: "/superadmin/{id}/createStaffs",
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
      "The created many staffs",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStaffSchema),
      "The validation error(s)",
    ),
  },
});



//get the id of staff to be deleted from params

export const removestaffroute = createRoute({
  path: "/superadmin/{id}/staff/{staff_id}",
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


//students

// To create many students at once
export const createstudentsroute = createRoute({
  path: "/superadmin/{id}/createstudents",
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
      "The created many students",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStudentSchema),
      "The validation error(s)",
    ),
  },
});


// To remove one student
export const removestudentroute = createRoute({
  path: "/superadmin/{id}/student/{student_id}",
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



export type CreateSuperAdminRoute = typeof create;
export type LoginSuperAdmin = typeof loginAdmin
export type GetOneRoute = typeof getOne;
export type RemoveRoute = typeof remove;
export type CreateStaffsRoute = typeof createstaffsroute;
export type RemoveStaffRoute = typeof removestaffroute;
export type CreateStudentsRoute = typeof createstudentsroute;
export type RemoveStudentRoute = typeof removestudentroute;
