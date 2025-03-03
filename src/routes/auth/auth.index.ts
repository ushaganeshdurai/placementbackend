import * as routes from "./auth.routes";
import * as handlers from "./auth.handlers";
import { createRouter } from "@/lib/create-app";

export const authRouter = createRouter()
  .basePath("/auth")
  .openapi(routes.oauth, handlers.oauth)
  .openapi(routes.oauthStudent, handlers.oauthStudent)
  .openapi(routes.oauthStaff, handlers.oauthStaff)
  .openapi(routes.oauthSuccess, handlers.oauthSuccess)
  .openapi(routes.session, handlers.checkSession);