import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import superadmin from "@/routes/superAdmin/superadmin.index";
import { cors } from 'hono/cors'

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  superadmin,
] as const;

app.use('/superadmin/*', cors({
  origin: 'http://localhost:5173',
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods:['POST','GET','DELETE','PATCH'],
  maxAge: 600
}))

//Yet to add staff, students cors


routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
