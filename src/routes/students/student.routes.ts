import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdUUIDParamsSchema } from "stoker/openapi/schemas";
import { notFoundSchema } from "@/lib/constants";
import { insertResumeSchema, loginStudentSchema, selectStudentSchema } from "@/db/schemas/studentSchema";
import { supabaseMiddleware } from "@/middlewares/auth/authMiddleware";

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


//to collect student's data
export const createresume = createRoute({
    path: "/student/resume",
    method: "post",
    request: {
        body: jsonContentRequired(insertResumeSchema, "Add resume details for dashboard")
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            selectStudentSchema,
            "The requested student resume details"
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            createErrorSchema(insertResumeSchema),
            "Some details are missing"
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


const updatePasswordSchema = z.object({
    oldPassword: z.string().min(6),
    newPassword: z.string().min(6),
});


export const updatepassword = createRoute({
    path: "/student/updatepassword",
    method: "patch",
    request: {
        body: jsonContentRequired(updatePasswordSchema, "Update student password")
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
            "Student not found"
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


export type LoginStudentRoute = typeof loginStudent
export type GetOneRoute = typeof getOne;
export type CreateResumeRoute = typeof createresume
export type UpdatePasswordRoute = typeof updatepassword
export type ApplyForDriveRoute = typeof applyfordrive