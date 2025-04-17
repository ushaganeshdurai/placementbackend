import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import superadmin from "@/routes/superAdmin/superadmin.index";
import staff from "@/routes/staffs/staff.index";
import student from "@/routes/students/student.index";

import { authRouter } from "./routes/auth/auth.index";
import { cors } from 'hono/cors'

const app = createApp();
configureOpenAPI(app);

const routes = [
  index,
  superadmin,
  staff,
  student,
  authRouter
] as const;


app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
