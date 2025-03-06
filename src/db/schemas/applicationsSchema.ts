import { bigint, foreignKey, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { drive, students } from "drizzle/schema";



export const applications = pgTable("applications", {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "applications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
    studentId: uuid("student_id").notNull(),
    driveId: bigint("drive_id", { mode: "number" }).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    foreignKey({
            columns: [table.driveId],
            foreignColumns: [drive.id],
            name: "applications_drive_id_fkey"
        }),
    foreignKey({
            columns: [table.studentId],
            foreignColumns: [students.studentId],
            name: "applications_student_id_fkey"
        }),
    unique("unique_application").on(table.studentId, table.driveId),
]);