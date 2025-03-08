import { createRouter } from "@/lib/create-app";

import * as handlers from "./student.handlers";
import * as routes from "./student.routes";

const router = createRouter()
  .openapi(routes.loginStudent, handlers.loginStudent)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.createresume, handlers.resumedetails)
  .openapi(routes.updatepassword, handlers.updatepassword)
  .openapi(routes.applyfordrive, handlers.applyForDrive)

export default router;
