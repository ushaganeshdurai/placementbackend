import { relations } from "drizzle-orm/relations";
import { usersInAuth, profiles, staff, students, superAdmin } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	staff: many(staff),
	students: many(students),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
	superAdmins: many(superAdmin),
}));

export const staffRelations = relations(staff, ({one, many}) => ({
	profile: one(profiles, {
		fields: [staff.userId],
		references: [profiles.id]
	}),
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	}),
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	}),
}));

export const studentsRelations = relations(students, ({one}) => ({
	staff_staffId: one(staff, {
		fields: [students.staffId],
		references: [staff.staffId],
		relationName: "students_staffId_staff_staffId"
	}),
	staff_staffId: one(staff, {
		fields: [students.staffId],
		references: [staff.staffId],
		relationName: "students_staffId_staff_staffId"
	}),
	profile: one(profiles, {
		fields: [students.userId],
		references: [profiles.id]
	}),
}));

export const superAdminRelations = relations(superAdmin, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [superAdmin.userId],
		references: [usersInAuth.id]
	}),
}));