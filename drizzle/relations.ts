import { relations } from "drizzle-orm/relations";
import { staff, students, profiles, usersInAuth, drive, applications, superAdmin } from "./schema";

export const studentsRelations = relations(students, ({one, many}) => ({
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
	applications: many(applications),
}));

export const staffRelations = relations(staff, ({one, many}) => ({
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	}),
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	}),
	profile: one(profiles, {
		fields: [staff.userId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	students: many(students),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	staff: many(staff),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
	superAdmins: many(superAdmin),
}));

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

export const superAdminRelations = relations(superAdmin, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [superAdmin.userId],
		references: [usersInAuth.id]
	}),
}));