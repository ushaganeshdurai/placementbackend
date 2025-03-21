import { createRoute, z } from "@hono/zod-openapi";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { createErrorSchema } from "stoker/openapi/schemas";

const insertUrlSchema = z.object({
    url: z.string(),
});

export const createjobroute = createRoute({
    path: "/upload",
    method: "post",
    request: {
        body: jsonContentRequired(
            (insertUrlSchema),
            "Add profile picture url",
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: { description: "Successfully added the url" },
        [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
            createErrorSchema(insertUrlSchema),
            "The validation error(s)",
        ),
    },
});