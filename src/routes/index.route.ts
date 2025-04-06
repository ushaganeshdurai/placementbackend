import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { eq } from "drizzle-orm";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { createRouter } from "@/lib/create-app";
import { events, students } from "drizzle/schema";
import db from "@/db";
import { drive } from "@/db/schemas/driveSchema";

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
    // @ts-ignore
    async (c) => {
      try {
        const studentDetails = await db
          .select({
            name: students.name,
            department: students.department,
            url: students.url,
            companyPlacedIn: students.companyPlacedIn,
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
    }
  )
  .openapi(
    createRoute({
      tags: ["Events"],
      method: "get",
      path: "/get-events",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                link: { type: "string" },
                url: { type: "string" },
                date: { type: "string" }
              }
            }
          },
          "Successfully retrieved events"
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
          { error: "No events found" },
          "No events available"
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
          { error: "Internal server error" },
          "Error fetching events"
        )
      }
    }),
    // @ts-ignore
    async (c) => {
      try {
        console.log("Fetching event details from database...");
    
        const eventDetails = await db
          .select({
            name: events.event_name,
            link: events.event_link,
            url: events.url,
            date: events.date,
          })
          .from(events)
          .execute();
    
        console.log("Event details fetched:", eventDetails);
    
        if (eventDetails.length === 0) {
          console.log("No events found.");
          return c.json({ error: "No events found" }, HttpStatusCodes.NOT_FOUND);
        }
    
        return c.json(eventDetails, HttpStatusCodes.OK);
      } catch (error) {
        console.error("Error fetching events:", error);
        return c.json(
          { error: "Internal server error" },
          HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
      }
    }
  )

  .openapi(
    createRoute({
      tags: ["Get jobs alone"],
      method: "get",
      path: "/get-jobs",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                companyName: { type: "string" },
                role: { type: "string" },
                lpa: { type: "string" },
              }
            }
          },
          "Successfully retrieved jobs"
        ),
      },
    }),
    // @ts-ignore
    async (c) => {
      try {
        const jobDetails = await db
          .select({
            companyName: drive.companyName,
            role: drive.role,
            lpa:drive.lpa
          })
          .from(drive)
          .execute();

        if (jobDetails.length === 0) {
          return c.json({ error: "Jobs not found" }, HttpStatusCodes.NOT_FOUND);
        }

        return c.json(jobDetails, HttpStatusCodes.OK);
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return c.json({ error: "Internal server error" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  )
  .openapi(
    createRoute({
      tags: ["Session"],
      method: "get",
      path: "/check-session",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(
          {
            type: "object",
            properties: {
              role: { type: "string", enum: ["admin", "student", "staff"] }
            }
          },
          "Session role retrieved successfully"
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
          { error: "Internal server error" },
          "Error checking session"
        )
      }
    }),
    //@ts-ignore
    (c) => {
      try {
        console.log('Request Headers:', c.req.raw.headers);
        const cookieHeader = c.req.header('Cookie') || '';
        console.log('Raw Cookie Header:', cookieHeader);

        // Manual cookie parsing
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) acc[name] = value;
          return acc;
        }, {});

        console.log('Parsed Cookies:', cookies);

        const adminSession = cookies['admin_session'];
        const studentSession = cookies['student_session'];
        const staffSession = cookies['staff_session'];

        console.log('Session Cookies:', { adminSession, studentSession, staffSession });

        if (adminSession) {
          return c.json({ role: 'admin' }, HttpStatusCodes.OK);
        } else if (studentSession) {
          return c.json({ role: 'student' }, HttpStatusCodes.OK);
        } else if (staffSession) {
          return c.json({ role: 'staff' }, HttpStatusCodes.OK);
        } else {
          return c.json({ error: "No active session" }, HttpStatusCodes.UNAUTHORIZED);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        return c.json({ error: "Internal server error" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  );

export default router;