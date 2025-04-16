import { pgTable, text, varchar, timestamp, date, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const drive = pgTable('drive', {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    companyName: varchar("company_name"),
    jobDescription: text("job_description"),
    driveDate: date("drive_date"),
    driveLink: text("drive_link"), role: text("role"),lpa:text("lpa"),
    expiration: timestamp({ withTimezone: true, mode: 'string' }),
    department: text().array(),
    batch: text(),
});



// Schema for selecting drive records
export const selectDriveSchema = createSelectSchema(drive);

// Schema for inserting new drive records
export const insertDriveSchema = createInsertSchema(drive).required({
    companyName: true,
    driveLink: true,
    department: true,
    role: true,
    lpa:true,
    jobDescription: true,
    expiration: true,
    batch: true
}).extend({
    notificationEmail: z.array(z.string().email())
}).partial({ driveDate: true });
