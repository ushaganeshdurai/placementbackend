import { pgSchema, uuid, foreignKey, pgTable, pgEnum } from "drizzle-orm/pg-core";
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])


const auth = pgSchema("auth");

export const users = auth.table("users", {
    id: uuid('id').primaryKey()
});


export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey().notNull(),
    userRole: userRole("user_role").notNull(),
}, (table) => [
    foreignKey({
        columns: [table.id],
        foreignColumns: [users.id],
        name: "profiles_id_fkey"
    }).onDelete("cascade"),
]);
