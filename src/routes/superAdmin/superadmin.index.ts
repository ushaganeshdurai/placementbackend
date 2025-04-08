import { createRouter } from "@/lib/create-app";

import * as handlers from "./superadmin.handlers";
import * as routes from "./superadmin.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginAdmin,handlers.loginAdmin)
  .openapi(routes.createstaffsroute,handlers.createStaffs)
  .openapi(routes.createcoordinatorsroute,handlers.createCoordinators)
  .openapi(routes.removestaffroute,handlers.removeStaff)
  .openapi(routes.createjobroute,handlers.createjobs)
  .openapi(routes.removedriveroute,handlers.removedrive)
  .openapi(routes.registeredstudents,handlers.registeredStudents)
  .openapi(routes.bulkuploadstudents,handlers.bulkUploadStudents)
  .openapi(routes.getJobsWithStudentsRoute, handlers.getJobsWithStudents)
  .openapi(routes.logoutAdmin, handlers.logoutAdmin)
  .openapi(routes.feedGroupMail,handlers.FeedGroupMail)
  .openapi(routes.createeventsroute,handlers.createevents)
  .openapi(routes.getFeedGroupMail,handlers.getFeedGroupMail)
  .openapi(routes.placedstudentsRoute,handlers.placedstudents)
export default router;
