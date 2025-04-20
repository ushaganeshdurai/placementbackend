import { relations } from "drizzle-orm/relations";
import { drive, applications, students, users, profiles, superAdmin, staff } from "./schema";

export const applicationsRelations = relations(applications, ({one}) => ({
	drive: one(drive, {
		fields: [applications.driveId],
		references: [drive.id]
	}),
	student: one(students, {
		fields: [applications.studentId],
		references: [students.studentId]
	}),
}));

export const driveRelations = relations(drive, ({many}) => ({
	applications: many(applications),
}));

export const studentsRelations = relations(students, ({one, many}) => ({
	applications: many(applications),
	staff_staffId: one(staff, {
		fields: [students.staffId],
		references: [staff.staffId],
		relationName: "students_staffId_staff_staffId"
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	users: one(users, {
		fields: [profiles.id],
		references: [users.id]
	}),
	staff: many(staff),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
	superAdmins_userId: many(superAdmin, {
		relationName: "superAdmin_userId_users_id"
	}),
	staff: many(staff),
}));

export const superAdminRelations = relations(superAdmin, ({one}) => ({
	users_userId: one(users, {
		fields: [superAdmin.userId],
		references: [users.id],
		relationName: "superAdmin_userId_users_id"
	}),
}));

export const staffRelations = relations(staff, ({one, many}) => ({
	users: one(users, {
		fields: [staff.userId],
		references: [users.id]
	}),
	profile: one(profiles, {
		fields: [staff.userId],
		references: [profiles.id]
	}),
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	})
}));