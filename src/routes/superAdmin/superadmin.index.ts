import { createRouter } from "@/lib/create-app";

import * as handlers from "./superadmin.handlers";
import * as routes from "./superadmin.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginAdmin,handlers.loginAdmin)
  .openapi(routes.createstaffsroute,handlers.createStaffs)
  .openapi(routes.removestaffroute,handlers.removeStaff)
  .openapi(routes.createjobroute,handlers.createjobs)
  .openapi(routes.removedriveroute,handlers.removedrive)
  .openapi(routes.registeredstudents,handlers.registeredStudents)
  .openapi(routes.bulkuploadstudents,handlers.bulkUploadStudents)
  .openapi(routes.getJobsWithStudentsRoute, handlers.getJobsWithStudents);

export default router;