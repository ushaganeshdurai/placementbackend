import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import {  selectStaffSchema } from "@/db/schemas/staffSchema";
import {  loginStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";

export const loginStudent = createRoute({
    path: "/student/login",
    method: "post",
    request: {
        body: jsonContentRequired(loginStudentSchema, "The super admin login credentials"),
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
    // middleware: [supabaseMiddleware] as const
});


//to display what is in particular admin's data
export const getOne = createRoute({
    path: "/student",
    method: "get",
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            selectStaffSchema,
            "The requested student details"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            createErrorSchema(selectStaffSchema),
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

export type LoginStudentRoute = typeof loginStudent
export type GetOneRoute = typeof getOne;