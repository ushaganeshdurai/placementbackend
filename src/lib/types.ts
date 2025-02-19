import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { SupabaseClient } from "@supabase/supabase-js"
export interface AppBindings {
  Variables: {
    logger: PinoLogger;
    supabase: SupabaseClient
  };
};

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
