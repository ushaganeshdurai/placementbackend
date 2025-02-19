import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import superadmin from "@/routes/superAdmin/superadmin.index";
import { authRouter } from "./routes/auth/auth.index";
import { jwt } from "hono/jwt";
import {cors} from 'hono/cors'

const app = createApp();
const SECRET = process.env.SECRET_KEY!;
configureOpenAPI(app);

const routes = [
  index,
  superadmin,
  authRouter
] as const;

app.use("/*",cors({ origin: "*", credentials: true }));


//Yet to add staff, students cors


routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
