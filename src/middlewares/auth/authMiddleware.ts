import db from '@/db'
import { staff } from '@/db/schemas/staffSchema'
import { AppBindings } from '@/lib/types'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import { profiles } from 'drizzle/schema'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { setCookie } from 'hono/cookie'
import { createMiddleware } from "hono/factory"


// declare module 'hono' {
//   interface ContextVariableMap {
//     supabase: SupabaseClient
//   }
// }

export const getSupabase = (c: Context) => {
  return c.get('supabase')
}


type SupabaseEnv = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export const supabaseMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const supabaseEnv = env<SupabaseEnv>(c)
  const supabaseUrl = supabaseEnv.SUPABASE_URL!
  const supabaseServiceRoleKey = supabaseEnv.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(c.req.header('Cookie') ?? '')
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => setCookie(c, name, value, options))
      },
    },
  })

  c.set('supabase', supabase)

  await next()
})

export const authMiddleware = createMiddleware<AppBindings>(async (c) => {
  const supabase = c.get("supabase");
  const { data: { session } } = await supabase.auth.getSession();
  console.log("\n \n \nSupabase session da dei", session)
  if (!session) {
    return c.json({ message: "Unauthenticated" }, 401)
  }
})

