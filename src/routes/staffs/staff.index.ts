import { createRouter } from "@/lib/create-app";
import * as handlers from "./staff.handlers";
import * as routes from "./staff.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginStaff, handlers.loginStaff)
  .openapi(routes.createstudentsroute, handlers.createStudents)
  .openapi(routes.removestudentroute, handlers.removeStudent)
  .openapi(routes.updatepassword, handlers.updatepassword)
  .openapi(routes.createjobalertroute, handlers.createjobalert)
  .openapi(routes.removejobroute, handlers.removejob)
  .openapi(routes.displayDrives, handlers.displayDrives)
  .openapi(routes.registeredStudents, handlers.registeredStudents) // Renamed back to registeredStudents
  .openapi(routes.bulkuploadstudents, handlers.bulkUploadStudents)
  .openapi(routes.placedstudents, handlers.placedstudents)
  .openapi(routes.logoutStaff, handlers.logoutStaff)
  .openapi(routes.feedGroupMail,handlers.FeedGroupMail)

export default router;