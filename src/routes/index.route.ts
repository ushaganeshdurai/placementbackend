import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { eq } from "drizzle-orm";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

import { createRouter } from "@/lib/create-app";
import { students } from "drizzle/schema";
import db from "@/db";

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Index"],
      method: "get",
      path: "/",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema("Placement statistics API"),
          "Placement API Index",
        ),
      },
    }),
    (c) => {
      return c.json({
        message: "Placement cell API",
      }, HttpStatusCodes.OK);
    },
  )
  .openapi(
    createRoute({
      tags: ["Placed students"],
      method: "get",
      path: "/get-placed-students",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          createMessageObjectSchema("Placed Students API"),
          "Placed Students API"
        ),
      },
    }),
    async (c) => {
      try {
        const studentDetails = await db
          .select({
            name: students.name,
            department: students.department,
            url: students.url,
            batch: students.batch,
          })
          .from(students)
          .where(eq(students.placedStatus, "yes"))
          .execute();
  
        if (studentDetails.length === 0) {
          return c.json({ error: "Student not found" }, HttpStatusCodes.NOT_FOUND);
        }
  
        return c.json(studentDetails, HttpStatusCodes.OK);
      } catch (error) {
        console.error("Error fetching students:", error);
        return c.json({ error: "Internal server error" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }  );
  

export default router;
