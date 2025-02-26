import { createRouter } from "@/lib/create-app";

import * as handlers from "./staff.handlers";
import * as routes from "./staff.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginStaff,handlers.loginStaff)
  .openapi(routes.createstudentsroute,handlers.createStudents)
  .openapi(routes.removestudentroute,handlers.removeStudent)

export default router;
