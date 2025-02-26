import { createRouter } from "@/lib/create-app";

import * as handlers from "./student.handlers";
import * as routes from "./student.routes";

const router = createRouter()
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.loginStudent,handlers.loginStudent)

export default router;
