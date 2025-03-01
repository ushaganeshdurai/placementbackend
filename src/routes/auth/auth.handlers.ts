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
      // redirectTo: "http://localhost:9999/auth/users/oauth/success"
      redirectTo: "http://localhost:9999/auth/success"
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

  // Step 1: Exchange Code for Session
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Step 2: Retrieve Authenticated User
  const { data: { user }, error: err } = await supabase.auth.getUser();
  if (err || !user) {
    console.log("Error retrieving user", err);
    return c.json({ message: "User not found" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Step 3: Determine User Role
  let userRole: "student" | "staff" | "super_admin" | null = null;
  const firstSeven = user?.email?.substring(0, 7);
  const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

  if (["gushanandhini2004@gmail.com","mhajith2003@gmail.com", "madhumegha900@gmail.com"].includes(user.email!)) {
    userRole = "super_admin";
  } else if (user.email === "kganeshdurai@gmail.com"||"wpage2098@gmail.com") {
    userRole = "staff";
  } else if (!user.email!.includes("@saec.ac.in")) {
    await supabase.auth.admin.deleteUser(user.id, false);
    return c.json({ message: "Unauthorized: You're not a part of SAEC" }, HttpStatusCodes.UNAUTHORIZED);
  } else {
    userRole = checkingIfStudent ? "student" : "staff";
  }

  console.log("Assigned user role:", userRole);

  // Step 4: Upsert Profile in "profiles" Table
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, user_role: userRole, email: user.email }, { onConflict: "id" });

  if (profileError) {
    console.log("Error updating profile:", profileError);
    return c.json({ message: "Error updating user role" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Step 5: Insert/Update in the Correct Table (staff, students, super_admin)
  let table: string | null = null;
  let idColumn: string | null = null;
  let data: Record<string, any> = { user_id: user.id, name: user.user_metadata.full_name, email: user.email };

  if (userRole === "student") {
    table = "students";
    idColumn = "student_id";
  } else if (userRole === "staff") {
    table = "staff";
    idColumn = "staff_id";
  } else {
    table = "super_admin";
  }

  let generatedId: string | null = null;

  if (table && idColumn) {
    const { data: insertedUser, error: roleError } = await supabase
      .from(table)
      .upsert(data, { onConflict: "email" })
      .select(idColumn)
      .single();

    if (roleError) {
      console.log(`Error adding to ${table} table:`, roleError);
      return c.json({ message: `Error adding ${userRole}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }

    generatedId = (insertedUser as Record<string, any>)?.[idColumn] || null;
    console.log(`Generated ${idColumn}:`, generatedId);
  }

  // Step 6: Generate Session Token
  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign(
    {
      id: user.id,
      role: userRole,
      staff_id: userRole === "staff" ? generatedId : null,
      student_id: userRole === "student" ? generatedId : null,
    },
    SECRET_KEY
  );

  setCookie(c, "oauth_session", sessionToken, {
    httpOnly: true,
    secure: false, // Change to true in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
    domain: "localhost",
  });

  console.log("Generated session token payload:", {
    id: user.id, role: userRole, staff_id: userRole === 'staff' ? generatedId : null,
    studentId: userRole === 'student' ? generatedId : null
  })

  // Clear role-specific session cookies
  setCookie(c, "admin_session", "", { path: "/", maxAge: 0 });
  setCookie(c, "staff_session", "", { path: "/", maxAge: 0 });
  setCookie(c, "student_session", "", { path: "/", maxAge: 0 });

  // Step 8: Redirect Based on Role
  // if (userRole === "super_admin") {
  //   // return c.redirect("/superadmin");

  // } else if (userRole === "staff") {
  //   return c.redirect("/staff");
  // } else {
  //   return c.redirect("/student");
  // }

  return c.json({ success: true, role: userRole, email: user.email, userId: user.id, message: "Oauth login successful" }, HttpStatusCodes.OK)
};
