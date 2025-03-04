import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { setCookie, getCookie } from "hono/cookie";
import { sign, verify } from 'hono/jwt';
import { OAuthRoute, OAuthSuccessRoute, OAuthStudentRoute, OAuthStaffRoute, SessionRoute } from "./auth.routes";

type UserRoles = "student" | "admin" | "staff" | "super_admin";

declare module "@supabase/supabase-js" {
  interface UserAttributes {
    user_role?: UserRoles;
  }
}

// Helper function to parse cookies from the Cookie header
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = value;
  });
  return cookies;
};

export const oauth: AppRouteHandler<OAuthRoute> = async (c) => {
  const supabase = c.get("supabase");

  const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `http://localhost:5173/auth/success?intendedRole=super_admin&returnUrl=${encodeURIComponent('/auth/superadmin')}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  console.log('OAuth redirect URL:', oauthData?.url);
  if (error) {
    console.log('OAuth initiation error:', error);
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

export const oauthStudent: AppRouteHandler<OAuthStudentRoute> = async (c) => {
  const supabase = c.get("supabase");

  const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `http://localhost:5173/auth/success?intendedRole=student&returnUrl=${encodeURIComponent('/auth/student')}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  console.log('Student OAuth redirect URL:', oauthData?.url);
  if (error) {
    console.log('Student OAuth initiation error:', error);
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

export const oauthStaff: AppRouteHandler<OAuthStaffRoute> = async (c) => {
  const supabase = c.get("supabase");

  const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `http://localhost:5173/auth/success?intendedRole=staff&returnUrl=${encodeURIComponent('/auth/staff')}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  console.log('Staff OAuth redirect URL:', oauthData?.url);
  if (error) {
    console.log('Staff OAuth initiation error:', error);
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

export const oauthSuccess: AppRouteHandler<OAuthSuccessRoute> = async (c) => {
  const supabase = c.get("supabase");
  const { code, intendedRole, returnUrl } = c.req.valid("query");

  console.log('Received OAuth code:', code, 'Intended role:', intendedRole, 'Return URL:', returnUrl);

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('OAuth exchange error:', error.message, error);
    return c.json({ message: "Invalid or expired OAuth code", error: error.message, redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.BAD_REQUEST);
  }

  const { data: userData, error: err } = await supabase.auth.getUser();
  if (err || !userData?.user) {
    console.error("Error retrieving user:", err);
    return c.json({ message: "User not found", redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  const user = userData.user;

  console.log('User Details (Backend):', {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name,
    profile_pic: user.user_metadata?.avatar_url,
    all_metadata: user.user_metadata,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    identities: user.identities,
  });

  let userRole: UserRoles | null = null;
  const firstSeven = user?.email?.substring(0, 7);
  const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

  if (["gushanandhini2004@gmail.com", "wpage2098@gmail.com", "mhajith2003@gmail.com", "madhumegha900@gmail.com"].includes(user.email!)) {
    userRole = "super_admin";
  } else if (user.email === "kganeshdurai@gmail.com") {
    userRole = "staff";
  } else if (/^\d{7}@saec\.ac\.in$/.test(user.email!)) {
    userRole = "student";
  } else if (user.email!.endsWith("@saec.ac.in")) {
    userRole = checkingIfStudent ? "student" : "staff";
  } else {
    await supabase.auth.admin.deleteUser(user.id, false);
    return c.json({ message: "Unauthorized: You're not a part of SAEC", redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.UNAUTHORIZED);
  }

  console.log("Assigned user role:", userRole);

  if (intendedRole && userRole !== intendedRole) {
    console.log(`Role mismatch: intended ${intendedRole}, assigned ${userRole}`);
    return c.json({
      success: false,
      message: `Unauthorized: Expected ${intendedRole} role, but user is ${userRole}`,
      redirect: returnUrl || (intendedRole === "student" ? "/auth/student" : intendedRole === "staff" ? "/auth/staff" : "/auth/superadmin"),
    }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (intendedRole === "student") {
    const { data: existingStudent, error: studentError } = await supabase
      .from("students")
      .select("email")
      .eq("email", user.email)
      .single();

    if (studentError || !existingStudent) {
      console.log(`Student email ${user.email} not found in database`, studentError?.message || "No record");
      return c.json({
        success: false,
        message: "Unauthorized: Student email not registered in the system",
        redirect: returnUrl || "/auth/student",
      }, HttpStatusCodes.UNAUTHORIZED);
    }
    console.log(`Student email ${user.email} found in database`);
  }

  if (intendedRole === "staff") {
    const { data: existingStaff, error: staffError } = await supabase
      .from("staff")
      .select("email")
      .eq("email", user.email)
      .single();

    if (staffError || !existingStaff) {
      console.log(`Staff email ${user.email} not found in database`, staffError?.message || "No record");
      return c.json({
        success: false,
        message: "Unauthorized: Staff email not registered in the system",
        redirect: returnUrl || "/auth/staff",
      }, HttpStatusCodes.UNAUTHORIZED);
    }
    console.log(`Staff email ${user.email} found in database`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, user_role: userRole, email: user.email }, { onConflict: "id" });

  if (profileError) {
    console.log("Error updating profile:", profileError);
    return c.json({ message: "Error updating user role", redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }

  let table: string | null = null;
  let idColumn: string | null = null;
  let upsertData: Record<string, any> = { user_id: user.id, name: user.user_metadata?.full_name, email: user.email };

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
        return c.json({ message: `Error adding ${userRole}`, redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
      generatedId = insertedUser ? insertedUser[idColumn] : null;
      console.log(`Generated ${idColumn || 'ID'}:`, generatedId);
    } else {
      const { error: roleError } = await query;
      if (roleError) {
        console.log(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}`, redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
    }
  }

  const SECRET_KEY = process.env.SECRET_KEY!;
  const sessionToken = await sign(
    {
      id: user.id,
      role: userRole,
      email: user.email, // Added email to JWT payload
      staff_id: userRole === "staff" ? generatedId : null,
      student_id: userRole === "student" ? generatedId : null,
    },
    SECRET_KEY
  );

  const cookieName = userRole === "student" ? "student_session" : userRole === "staff" ? "staff_session" : "oauth_session";
  setCookie(c, cookieName, sessionToken, {
    httpOnly: true,
    secure: false, // Set to true in production
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
    domain: "localhost",
  });

  console.log("Generated session token payload:", {
    id: user.id,
    role: userRole,
    email: user.email,
    staff_id: userRole === "staff" ? generatedId : null,
    student_id: userRole === "student" ? generatedId : null,
  });

  setCookie(c, "admin_session", "", { path: "/", maxAge: 0 });
  if (userRole !== "student") setCookie(c, "student_session", "", { path: "/", maxAge: 0 });
  if (userRole !== "staff") setCookie(c, "staff_session", "", { path: "/", maxAge: 0 });

  const redirectPath = userRole === "student" ? "/dashboard/student" : userRole === "staff" ? "/dashboard/staff" : "/dashboard/superadmin";
  return c.json({
    success: true,
    role: userRole,
    userId: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name,
    profile_pic: user.user_metadata?.avatar_url,
    metadata: user.user_metadata,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    identities: user.identities,
    message: "OAuth login successful",
    redirect: redirectPath,
  }, HttpStatusCodes.OK);
};

export const checkSession = async (c) => {
  const jwtToken = getCookie(c, "admin_session") || getCookie(c, "student_session") || getCookie(c, "oauth_session");

  if (!jwtToken) {
    return c.json({ success: false, message: "No session found" }, 401);
  }

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.role) {
      return c.json({ success: false, message: "Invalid session" }, 401);
    }

    return c.json({
      success: true,
      userId: decoded.id,
      role: decoded.role,
      email: decoded.email,
    }, 200);
  } catch (error) {
    console.error("Session verification error:", error);
    return c.json({ success: false, message: "Invalid or expired session" }, 401);
  }
};