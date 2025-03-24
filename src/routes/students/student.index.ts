import { createRouter } from "@/lib/create-app";
import * as handlers from "./student.handlers";
import * as routes from "./student.routes";
const router = createRouter()
  .openapi(routes.loginStudent, handlers.loginStudent)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.applyfordrive, handlers.applyForDrive)
  .openapi(routes.forgotpassword, handlers.forgotPassword)
  .openapi(routes.resetpassword, handlers.resetPassword)
  .openapi(routes.displayDrives, handlers.displayDrives)
  .openapi(routes.updatepassword,handlers.updatepassword)
  .openapi(routes.getResume, handlers.getResume) 
  .openapi(routes.updateResume, handlers.updateResume) 
  .openapi(routes.removeApplication, handlers.removeApplication) 
  .openapi(routes.checkApplicationStatus, handlers.checkApplicationStatus) 
  .openapi(routes.registration, handlers.registration)
  .openapi(routes.logoutStudent, handlers.logoutStudent);
export default router;
