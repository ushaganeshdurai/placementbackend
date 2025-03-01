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
      redirectTo: "http://localhost:5173/auth/success"
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

  console.log('Received OAuth code:', code); // Log the code for debugging

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('OAuth exchange error:', error.message, error); // Detailed logging
    return c.json({ message: "Invalid or expired OAuth code", error: error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  const { data: { user }, error: err } = await supabase.auth.getUser();
  if (err || !user) {
    console.error("Error retrieving user:", err);
    return c.json({ message: "User not found" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  let userRole: "student" | "staff" | "super_admin" | null = null;
  const firstSeven = user?.email?.substring(0, 7);
  const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

  if (user.email && (user.email === "gushanandhini2004@gmail.com" || user.email === "wpage2098@gmail.com" || user.email === "madhumegha900@gmail.com")) {
    userRole = "super_admin";
  } else if (user.email && user.email === "kganeshdurai@gmail.com") {
    userRole = 'staff';
  } else if (user.email && !user.email.includes("@saec.ac.in")) {
    await supabase.auth.admin.deleteUser(user.id, false);
    return c.json({ message: "Unauthorized: You're not a part of SAEC" }, HttpStatusCodes.UNAUTHORIZED);
  } else if (user.email?.includes("@saec.ac.in")) {
    userRole = checkingIfStudent ? "student" : "staff";
  }

  if (userRole) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, user_role: userRole, email: user.email }, { onConflict: "id" });
    if (profileError) {
      console.error("Error updating profile:", profileError);
      return c.json({ message: "Error updating user role" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    let table: string | null = null;
    let data: Record<string, any> = { user_id: user.id, name: user.user_metadata.full_name, email: user.email };
    if (userRole === "student") table = "students";
    else if (userRole === "staff") table = "staff";
    else table = "super_admin";

    if (table) {
      const { error: roleError } = await supabase.from(table).upsert(data, { onConflict: "email" });
      if (roleError) {
        console.error(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign({ id: user.id, role: userRole }, SECRET_KEY);

  setCookie(c, "oauth_session", sessionToken, {
    httpOnly: true,
    secure: false, // Set to true in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
    domain: "localhost"
  });

  return c.json({
    success: true,
    role: userRole,
    userId: user.id,
    email: user.email,
    message: "OAuth login successful"
  }, HttpStatusCodes.OK);
};