import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { setCookie } from "hono/cookie";

import { sign } from 'hono/jwt'

import { OAuthRoute, OAuthSuccessRoute } from "./auth.routes";

type UserRoles = "student" | "admin" | "staff"

declare module "@supabase/supabase-js" {
  interface UserAttributes {
    user_role?: UserRoles;
  }
}



export const oauth: AppRouteHandler<OAuthRoute> = async (c) => {
  const supabase = c.get("supabase");

  const { data: { url }, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://localhost:9999/auth/users/oauth/success"
    }
  });
  console.log(url);
  if (error) {
    console.log(error)
    return c.json({ message: " Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }
  return c.redirect(url!, HttpStatusCodes.MOVED_TEMPORARILY)
};



export const oauthSuccess: AppRouteHandler<OAuthSuccessRoute> = async (c) => {
  const supabase = c.get("supabase");
  const { code } = c.req.valid("query");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  const { data: { user }, error: err } = await supabase.auth.getUser();
  if (err || !user) {
    console.log("Error retrieving user", err);
    return c.json({ message: "User not found" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  let userRole: "student" | "staff" | "super_admin" | null = null;
  const firstSeven = user?.email?.substring(0, 7);
  const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

  if (user.email && user.email === "gushanandhini2004@gmail.com") {
    userRole = "super_admin";
  } else if (user.email && !user.email.includes("@saec.ac.in")) {
    await supabase.auth.admin.deleteUser(user.id, false);
    return c.json({ message: "Unauthorized: You're not a part of SAEC" }, HttpStatusCodes.UNAUTHORIZED);
  } else if (user.email?.includes("@saec.ac.in")) {
    userRole = checkingIfStudent ? "student" : "staff";
  }

  if (userRole) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, user_role: userRole }, { onConflict: "id" });

    if (profileError) {
      console.log("Error updating profile:", profileError);
      return c.json({ message: "Error updating user role" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Determine the table to insert into
    let table: string | null = null;
    let data: Record<string, any> = { userId: user.id, email: user.email };

    if (userRole === "student") {
      table = "students";
    } else if (userRole === "staff") {
      table = "staff";
    }

    if (table) {
      const { error: roleError } = await supabase.from(table).upsert(data, { onConflict: "email" });

      if (roleError) {
        console.log(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  }

  console.log("Assigned user role:", userRole);

  const SECRET_KEY = process.env.SECRET_KEY!
  const sessionToken = await sign({ id: user.id, role: userRole }, SECRET_KEY);

  setCookie(c, "oauth_session", sessionToken, {
    httpOnly: true,
    secure: false, //for now
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
    domain: "localhost"
  });
  setCookie(c, "admin_session", "", { path: "/", maxAge: 0 })
  if (userRole === 'super_admin') { return c.redirect("/superadmin"); }
  else if (userRole === 'staff') { return c.redirect("/staff") }
  else { return c.redirect("/student") }
};
