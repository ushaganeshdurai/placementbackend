import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { setCookie } from "hono/cookie";
import { sign } from 'hono/jwt';
import { OAuthRoute, OAuthSuccessRoute } from "./auth.routes";

type UserRoles = "student" | "admin" | "staff";

declare module "@supabase/supabase-js" {
  interface UserAttributes {
    user_role?: UserRoles;
  }
}

export const oauth: AppRouteHandler<OAuthRoute> = async (c) => {
  const supabase = c.get("supabase");

  const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://localhost:5173/auth/success"
    }
  });

  console.log('OAuth redirect URL:', oauthData?.url);
  if (error) {
    console.log('OAuth initiation error:', error);
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

export const oauthSuccess: AppRouteHandler<OAuthSuccessRoute> = async (c) => {
  const supabase = c.get("supabase");
  const { code } = c.req.valid("query");

  console.log('Received OAuth code:', code);

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('OAuth exchange error:', error.message, error);
    return c.json({ message: "Invalid or expired OAuth code", error: error.message }, HttpStatusCodes.BAD_REQUEST);
  }

  // Retrieve Authenticated User
  const { data: userData, error: err } = await supabase.auth.getUser();
  if (err || !userData?.user) {
    console.error("Error retrieving user:", err);
    return c.json({ message: "User not found" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  const user = userData.user;

  // Determine User Role
  let userRole: "student" | "staff" | "super_admin" | null = null;
  const firstSeven = user?.email?.substring(0, 7);
  const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

  if (["gushanandhini2004@gmail.com", "wpage2098@gmail.com", "madhumegha900@gmail.com"].includes(user.email!)) {
    userRole = "super_admin";
  } else if (user.email === "kganeshdurai@gmail.com") {
    userRole = "staff";
  } else if (!user.email!.includes("@saec.ac.in")) {
    await supabase.auth.admin.deleteUser(user.id, false);
    return c.json({ message: "Unauthorized: You're not a part of SAEC" }, HttpStatusCodes.UNAUTHORIZED);
  } else {
    userRole = checkingIfStudent ? "student" : "staff";
  }

  console.log("Assigned user role:", userRole);

  // Upsert Profile in "profiles" Table
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, user_role: userRole, email: user.email }, { onConflict: "id" });

  if (profileError) {
    console.log("Error updating profile:", profileError);
    return c.json({ message: "Error updating user role" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  // Insert/Update in the Correct Table (staff, students, super_admin)
  let table: string | null = null;
  let idColumn: string | null = null;
  let upsertData: Record<string, any> = { user_id: user.id, name: user.user_metadata.full_name, email: user.email };

  if (userRole === "student") {
    table = "students";
    idColumn = "student_id";
  } else if (userRole === "staff") {
    table = "staff";
    idColumn = "staff_id";
  } else if (userRole === "super_admin") {
    table = "super_admin";
    idColumn = null;
  }

  let generatedId: string | null = null;

  if (table) {
    const query = supabase.from(table).upsert(upsertData, { onConflict: "email" });
    if (idColumn) {
      const { data: insertedUser, error: roleError } = await query.select(idColumn).single();
      if (roleError) {
        console.log(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
      generatedId = insertedUser ? insertedUser[idColumn] : null;
      console.log(`Generated ${idColumn}:`, generatedId);
    } else {
      const { error: roleError } = await query;
      if (roleError) {
        console.log(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}` }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  }

  // Generate Session Token
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

  // Set Cookies for Session
  setCookie(c, "oauth_session", sessionToken, {
    httpOnly: true,
    secure: false, // Set to true in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
    domain: "localhost",
  });

  setCookie(c, "admin_session", "", { path: "/", maxAge: 0 });
  setCookie(c, "staff_session", "", { path: "/", maxAge: 0 });
  setCookie(c, "student_session", "", { path: "/", maxAge: 0 });

  return c.json({
    success: true,
    role: userRole,
    userId: user.id,
    email: user.email,
    message: "OAuth login successful"
  }, HttpStatusCodes.OK);
};