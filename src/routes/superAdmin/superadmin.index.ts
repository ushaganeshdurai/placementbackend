import { createRouter } from "@/lib/create-app";

import * as handlers from "./superadmin.handlers";
import * as routes from "./superadmin.routes";

const router = createRouter()
  .openapi(routes.create, handlers.create)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.remove, handlers.remove)
  .openapi(routes.loginAdmin,handlers.loginAdmin)
  .openapi(routes.createstaffsroute,handlers.createStaffs)
  .openapi(routes.createstudentsroute,handlers.createStudents)
  .openapi(routes.removestaffroute,handlers.removeStaff)
  .openapi(routes.removestudentroute,handlers.removeStudent)

export default router;
