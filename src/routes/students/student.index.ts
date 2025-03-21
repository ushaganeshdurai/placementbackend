import { createRouter } from "@/lib/create-app";

import * as handlers from "./student.handlers";
import * as routes from "./student.routes";

const router = createRouter()
  .openapi(routes.loginStudent, handlers.loginStudent)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.createresume, handlers.resumedetails)
  .openapi(routes.applyfordrive, handlers.applyForDrive)
  .openapi(routes.forgotpassword, handlers.forgotPassword)
  .openapi(routes.resetpassword, handlers.resetPassword)
  .openapi(routes.displayDrives, handlers.displayDrives)
  .openapi(routes.getResume, handlers.getResume) // Add this line
  .openapi(routes.updateResume, handlers.updateResume) // Add PATCH route
  .openapi(routes.removeApplication, handlers.removeApplication) // Must be here
  .openapi(routes.checkApplicationStatus, handlers.checkApplicationStatus) // Add this line
  .openapi(routes.registration, handlers.registration)
  .openapi(routes.logoutStudent, handlers.logoutStudent);
export default router;
