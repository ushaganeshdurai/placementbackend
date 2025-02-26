import { createRouter } from "@/lib/create-app";

import * as handlers from "./superadmin.handlers";
import * as routes from "./superadmin.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginAdmin,handlers.loginAdmin)
  .openapi(routes.createstaffsroute,handlers.createStaffs)
  .openapi(routes.removestaffroute,handlers.removeStaff)

export default router;
