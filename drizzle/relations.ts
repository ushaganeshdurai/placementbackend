import { relations } from "drizzle-orm/relations";
import { usersInAuth, profiles, staff, students, superAdmin } from "./schema";

export const profilesRelations = relations(profiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
	superAdmins: many(superAdmin),
}));

export const studentsRelations = relations(students, ({one}) => ({
	staff_email: one(staff, {
		fields: [students.email],
		references: [staff.studentEmailId],
		relationName: "students_email_staff_studentEmailId"
	}),
	staff_staffId: one(staff, {
		fields: [students.staffId],
		references: [staff.staffId],
		relationName: "students_staffId_staff_staffId"
	}),
	staff_studentId: one(staff, {
		fields: [students.studentId],
		references: [staff.studentId],
		relationName: "students_studentId_staff_studentId"
	}),
}));

export const staffRelations = relations(staff, ({many}) => ({
	students_email: many(students, {
		relationName: "students_email_staff_studentEmailId"
	}),
	students_staffId: many(students, {
		relationName: "students_staffId_staff_staffId"
	}),
	students_studentId: many(students, {
		relationName: "students_studentId_staff_studentId"
	}),
}));

export const superAdminRelations = relations(superAdmin, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [superAdmin.userId],
		references: [usersInAuth.id]
	}),
}));