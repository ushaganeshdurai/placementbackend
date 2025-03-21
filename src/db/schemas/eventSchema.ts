import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const events = pgTable("events", {
    id: serial().primaryKey().notNull(),
    event_name: text().notNull(),
    event_link: text('event_link'),
    date: text('date'),
    url: text("url")
});

export const insertEventSchema = createInsertSchema(events).required({
    event_name: true,
    event_link: true,   
    date: true,
    url: true,
});
