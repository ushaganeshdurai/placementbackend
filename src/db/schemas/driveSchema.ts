import { pgTable, text, varchar, timestamp, date, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";



export const drive = pgTable('drive', {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    companyName: varchar("company_name"),
    jobDescription: text("job_description"),
    driveDate: date("drive_date"),
    driveLink: text("drive_link"),
    expiration: timestamp({ withTimezone: true, mode: 'string' }),
    department: text().array(),
    batch: text(),
});



// Schema for selecting drive records
export const selectDriveSchema = createSelectSchema(drive);

// Schema for inserting new drive records
export const insertDriveSchema = createInsertSchema(drive).required({
    driveDate: true,
    companyName: true,
    driveLink: true,
    department: true,
    jobDescription: true,
    expiration: true,
    batch: true
}).extend({
    notificationEmail: z.array(z.string().email())
});
// example data to send 

/**
 *   {
      "batch": "2025",
      "expiration": "12/31/2025 23:59:59",
      "companyName": "TechCorp Ltd.",
      "driveDate": "12/20/2025",
      "jobDescription": "Software Developer role for fresh graduates.",
      "department": ["Computer Science", "Information Technology"]
    },
 */