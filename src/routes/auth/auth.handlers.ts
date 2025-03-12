import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from 'hono/jwt';
import { OAuthRoute, OAuthSuccessRoute, OAuthStudentRoute, OAuthStaffRoute, SessionRoute } from "./auth.routes";
import db from "@/db";
import { staff, students, superAdmin } from "drizzle/schema";
import { eq } from "drizzle-orm"; // Add this import


type UserRoles = "student" | "admin" | "staff" | "super_admin";

declare module "@supabase/supabase-js" {
  interface UserAttributes {
    user_role?: UserRoles;
  }
}

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
    return c.json({
      message: "Invalid or expired OAuth code",
      error: error.message,
      redirect: returnUrl || '/auth/superadmin'
    }, HttpStatusCodes.BAD_REQUEST);
  }

  const { data: userData, error: err } = await supabase.auth.getUser();
  if (err || !userData?.user) {
    console.error("Error retrieving user:", err);
    return c.json({
      message: "User not found",
      redirect: returnUrl || '/auth/superadmin'
    }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  const user = userData.user;

  console.log('User Details (Backend):', {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name,
    profile_pic: user.user_metadata?.avatar_url,
    all_metadata: user.user_metadata,
  });

  let userRole: UserRoles | null = null;

  const staffCheck = await db.select({ email: staff.email }).from(staff).where(eq(staff.email, user.email)).limit(1).execute();
  const studentCheck = await db.select({ email: students.email }).from(students).where(eq(students.email, user.email)).limit(1).execute();
  const superAdminCheck = await db.select({ email: superAdmin.email }).from(superAdmin).where(eq(superAdmin.email, user.email)).limit(1).execute();

  if (staffCheck.length > 0 && intendedRole === "staff") {
    userRole = "staff";
    console.log(`Assigned staff role for ${user.email} based on staff table`);
  } else if (studentCheck.length > 0 && intendedRole === "student") {
    userRole = "student";
    console.log(`Assigned student role for ${user.email} based on students table`);
  } else if (superAdminCheck.length > 0 && intendedRole === "super_admin") {
    userRole = "super_admin";
    console.log(`Assigned super_admin role for ${user.email} based on super_admin table`);
  } else {
    if (staffCheck.length > 0) {
      userRole = "staff";
      console.log(`Existing staff found: ${user.email}`);
      return c.json({
        success: false,
        message: `Unauthorized: You are assigned as staff, not ${intendedRole}`,
        redirect: '/auth/staff',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    } else if (studentCheck.length > 0) {
      userRole = "student";
      console.log(`Existing student found: ${user.email}`);
      return c.json({
        success: false,
        message: `Unauthorized: You are assigned as student, not ${intendedRole}`,
        redirect: '/auth/student',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    } else if (superAdminCheck.length > 0) {
      userRole = "super_admin";
      console.log(`Existing super_admin found: ${user.email}`);
      return c.json({
        success: false,
        message: `Unauthorized: You are assigned as super_admin, not ${intendedRole}`,
        redirect: '/auth/superadmin',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    }

    const firstSeven = user?.email?.substring(0, 7);
    const checkingIfStudent = /^[0-9]{7}$/.test(firstSeven || "");

    if (/^\d{7}@saec\.ac\.in$/.test(user.email!)) {
      userRole = "student";
      console.log('Assigned student role based on email pattern');
    } else if (user.email!.endsWith("@saec.ac.in")) {
      userRole = checkingIfStudent ? "student" : "staff";
      console.log(`Assigned ${userRole} role based on SAEC domain and student check`);
    } else {
      console.log(`Unauthorized user ${user.email} - not in any table and not part of SAEC`);
      return c.json({
        success: false,
        message: "Unauthorized: You're not a part of SAEC",
        redirect: returnUrl || '/auth/superadmin',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    }
  }

  if (intendedRole && userRole !== intendedRole) {
    console.log(`Role mismatch detected - Intended: ${intendedRole}, Assigned: ${userRole}`);
    const redirectPath = returnUrl || (intendedRole === "student" ? "/auth/student" :
      intendedRole === "staff" ? "/auth/staff" :
        "/auth/superadmin");
    return c.json({
      success: false,
      message: `Unauthorized: Expected ${intendedRole} role, but user is ${userRole}`,
      redirect: redirectPath,
      intendedRole,
      assignedRole: userRole
    }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (intendedRole === "student" && studentCheck.length === 0) {
    return c.json({
      success: false,
      message: "Unauthorized: Student email not registered in the system",
      redirect: returnUrl || "/auth/student",
      email: user.email
    }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (intendedRole === "staff" && staffCheck.length === 0) {
    return c.json({
      success: false,
      message: "Unauthorized: Staff email not registered in the system",
      redirect: returnUrl || "/auth/staff",
      email: user.email
    }, HttpStatusCodes.UNAUTHORIZED);
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
      email: user.email,
      staff_id: userRole === "staff" ? generatedId : null,
      student_id: userRole === "student" ? generatedId : null,
    },
    SECRET_KEY
  );

  // Clear all existing session cookies before setting the new one
  deleteCookie(c, "student_session", { path: "/", maxAge: 0, domain: "localhost" });
  deleteCookie(c, "staff_session", { path: "/", maxAge: 0, domain: "localhost" });
  deleteCookie(c, "oauth_session", { path: "/", maxAge: 0, domain: "localhost" });
  deleteCookie(c, "admin_session", { path: "/", maxAge: 0, domain: "localhost" });

  // Set the new session cookie based on the user role
  const cookieName = userRole === "student" ? "student_session" :
                    userRole === "staff" ? "staff_session" :
                    "oauth_session"; // Used for super_admin
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

  const redirectPath = userRole === "student" ? "/dashboard/student" :
                      userRole === "staff" ? "/dashboard/staff" :
                      "/dashboard/superadmin";

                      //need to return staff_id,student_id
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

export const checkSession: AppRouteHandler<SessionRoute> = async (c) => {
  const jwtToken = getCookie(c, "student_session") ||
    getCookie(c, "staff_session") ||
    getCookie(c, "admin_session") ||
    getCookie(c, "oauth_session");

  if (!jwtToken) {
    console.log("No session cookie found");
    return c.json({ success: false, message: "No session found" }, 401);
  }

  try {
    const SECRET_KEY = process.env.SECRET_KEY!;
    const decoded = await verify(jwtToken, SECRET_KEY);
    if (!decoded || !decoded.role) {
      console.log("Invalid session token:", jwtToken);
      return c.json({ success: false, message: "Invalid session" }, 401);
    }

    console.log("Session validated:", decoded);
    return c.json({
      success: true,
      userId: decoded.staff_id || decoded.student_id || decoded.id || decoded.userId,
      role: decoded.role,
      email: decoded.email,
    }, 200);
  } catch (error) {
    console.error("Session verification error:", error);
    return c.json({ success: false, message: "Invalid or expired session" }, 401);
  }
};