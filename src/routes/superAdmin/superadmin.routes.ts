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
import { groupMails, students } from "drizzle/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { insertStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { insertEventSchema } from "@/db/schemas/eventSchema";



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

export const insertStudentsSchema = createInsertSchema(students)
  .required({
    email: true,
    password: true,
  })
  .omit({
    studentId: true,
    userId: true,
    department: true,
    placedStatus: true,
    skillSet: true,
    languagesKnown: true,
    phoneNumber: true,
    noOfArrears: true,
    staffId: true,
    githubUrl: true,
    linkedinUrl: true,
    twelfthMark: true,
    tenthMark: true,
    cgpa: true,
    name: true,
    regNo: true,
    rollNo: true,
    year: true,
  }) .extend({
    staffEmail: z.string().email(),
  });




//bulk upload students
export const bulkuploadstudents = createRoute({
  path: "/superadmin/bulkuploadstudents",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertStudentsSchema),
      "Add multiple students",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectStudentSchema),
      "Created many students",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertStudentsSchema),
      "The validation error(s)",
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



export const getJobsWithStudentsRoute = createRoute({
  path: "/superadmin/jobs-with-students",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        jobs: z.array(
          z.object({
            jobId: z.number(),
            companyName: z.string(),
            jobDescription: z.string(),
            driveDate: z.string(),
            expiration: z.string(),
            batch: z.string(),
            department: z.array(z.string()),
            createdAt: z.string(),
            driveLink: z.string(), // Added driveLink
            students: z.array(
              z.object({
                applicationId: z.number(),
                studentName: z.string(),
                email: z.string(),
                cgpa: z.number().optional(),
                batch: z.string().optional(),
                department: z.string().optional(),
                appliedAt: z.string(),
              })
            ),
          })
        ),
      }),
      "List of jobs with registered students"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createErrorSchema(z.any()),
      "Unauthorized access - Token required"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "Jobs not found"
    ),
  },
  middlewares: [supabaseMiddleware],
});


export const logoutAdmin = createRoute({
  path: "/superadmin/logout",
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
  path: "/superadmin/feedgroupmail",
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
  path: "/superadmin/getfeedgroupmail",
  method: "get",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMailSchema,
      "List of group emails"
    ),
    [HttpStatusCodes.UNAUTHORIZED]: {
      description: "Unauthorized access - Token required",
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createErrorSchema(z.object({ error: z.string() })),
      "Unexpected server error"
    ),
  },
  middlewares: [supabaseMiddleware],
});
/**
 * API route for creating multiple events in the super admin dashboard
 * 
 * @route POST /superadmin/add-events
 * @accepts Array of event objects conforming to insertEventSchema
 * @returns Created events on success, validation errors on unprocessable entity
 */

export const createeventsroute = createRoute({
  path: "/superadmin/add-events",
  method: "post",
  request: {
    body: jsonContentRequired(
      z.array(insertEventSchema),  
      "Add multiple events",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContentRequired(
      z.array(insertEventSchema),  
      "Created many events",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertEventSchema),
      "The validation error(s)",
    ),
  },
});



export type GetFeedMailRoute = typeof getFeedGroupMail;
export type LogoutAdminRoute = typeof logoutAdmin;
export type GetJobsWithStudentsRoute = typeof getJobsWithStudentsRoute;
export type LoginSuperAdmin = typeof loginAdmin
export type GetOneRoute = typeof getOne;
export type CreateEventsRoute = typeof createeventsroute;
export type CreateStaffsRoute = typeof createstaffsroute;
export type RemoveStaffRoute = typeof removestaffroute;
export type RemoveDriveRoute = typeof removedriveroute
export type CreateJobsRoute = typeof createjobroute
export type RegisteredStudentsRoute = typeof registeredstudents
export type BulkUploadStudentsRoute = typeof bulkuploadstudents
export type FeedGroupMailRoute = typeof feedGroupMail

