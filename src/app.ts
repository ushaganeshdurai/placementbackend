import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import superadmin from "@/routes/superAdmin/superadmin.index";
import staff from "@/routes/staffs/staff.index";
import student from "@/routes/students/student.index";

import { authRouter } from "./routes/auth/auth.index";
import {cors} from 'hono/cors'

const app = createApp();
configureOpenAPI(app);

const routes = [
  index,
  superadmin,
  staff,
  student,
  authRouter
] as const;



//Yet to add staff, students cors


routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
