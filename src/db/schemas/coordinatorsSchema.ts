import { bigint, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

export const coordinators = pgTable("coordinators", {
    name: text(),
    dept: text(),
    phoneNumber: text("phone number"),
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "coordinators_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
}, (table) => [
    unique("coordinators_id_key").on(table.id),
]);


export const selectCoordinatorsSchema = createSelectSchema(coordinators);

export const insertCoordinatorsSchema = createInsertSchema(coordinators).required({
    phoneNumber: true,
    name: true,
    dept: true,
})