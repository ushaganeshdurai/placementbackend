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

/**
 * Handles OAuth authentication using Supabase with Google as the provider.
 * Redirects the user to the appropriate OAuth URL or returns an error response if the initiation fails.
 *
 * @param c - The application route context containing the Supabase client.
 * @returns A redirect to the OAuth URL or an error response.
 */
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

  if (error) {
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

/**
 * Handles OAuth authentication for students using Google as the provider.
 *
 * @param c - The context object containing the Supabase client and other request details.
 * @returns A JSON response with an error message if authentication fails, 
 *          or a redirect to the OAuth URL if successful.
 */
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
  if (error) {
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

/**
 * Handles OAuth authentication for staff using Google as the provider.
 *
 * @param c - The context object containing the Supabase client and other request details.
 * @returns A JSON response with an error message if authentication fails, 
 *          or a redirect to the OAuth URL if successful.
 */
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
  if (error) {
    return c.json({ message: "Something went wrong" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
  return c.redirect(oauthData!.url, HttpStatusCodes.MOVED_TEMPORARILY);
};

/**
 * Handles the OAuth success flow by exchanging the OAuth code for a session,
 * determining the user's role, and setting appropriate session cookies.
 *
 * @param c - The context object containing the request and response.
 * @returns A JSON response indicating the success or failure of the OAuth process,
 *          along with relevant user information and redirection paths.
 */
// @ts-ignore
export const oauthSuccess: AppRouteHandler<OAuthSuccessRoute> = async (c) => {
  const supabase = c.get("supabase");
  const { code, intendedRole, returnUrl } = c.req.valid("query");
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
  let userRole: UserRoles | null = null;
// @ts-ignore
  const staffCheck = await db.select({ email: staff.email }).from(staff).where(eq(staff.email, user.email)).limit(1).execute();
  // @ts-ignore
  const studentCheck = await db.select({ email: students.email }).from(students).where(eq(students.email, user.email)).limit(1).execute();
  // @ts-ignore
  const superAdminCheck = await db.select({ email: superAdmin.email }).from(superAdmin).where(eq(superAdmin.email, user.email)).limit(1).execute();

  if (staffCheck.length > 0 && intendedRole === "staff") {
    userRole = "staff";
  } else if (studentCheck.length > 0 && intendedRole === "student") {
    userRole = "student";
  } else if (superAdminCheck.length > 0 && intendedRole === "super_admin") {
    userRole = "super_admin";
  } else {
    if (staffCheck.length > 0) {
      userRole = "staff";
      return c.json({
        success: false,
        message: `Unauthorized: You are assigned as staff, not ${intendedRole}`,
        redirect: '/auth/staff',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    } else if (studentCheck.length > 0) {
      userRole = "student";
      return c.json({
        success: false,
        message: `Unauthorized: You are assigned as student, not ${intendedRole}`,
        redirect: '/auth/student',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    } else if (superAdminCheck.length > 0) {
      userRole = "super_admin";
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
    } else if (user.email!.endsWith("@saec.ac.in")) {
      userRole = checkingIfStudent ? "student" : "staff";
    } else {
      return c.json({
        success: false,
        message: "Unauthorized: You're not a part of SAEC",
        redirect: returnUrl || '/auth/superadmin',
        email: user.email
      }, HttpStatusCodes.UNAUTHORIZED);
    }
  }

  if (intendedRole && userRole !== intendedRole) {
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
    console.error("Error updating profile:", profileError);
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
        console.error(`Error adding to ${table} table:`, roleError);
        return c.json({ message: `Error adding ${userRole}`, redirect: returnUrl || '/auth/superadmin' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
      }
      generatedId = insertedUser ? insertedUser[idColumn] : null;
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
    secure: true, // Set to true in production
    sameSite: "None",
    path: "/",
    maxAge: 3600,
    domain: "localhost",
  });
  setCookie(c, cookieName, sessionToken, {
    httpOnly: true,
    secure: true, // Set to true in production
    sameSite: "None",
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

/**
 * Handles session verification by checking for a valid session cookie
 * and decoding the associated JWT token.
 *
 * @param c - The route handler context.
 * @returns A JSON response indicating the session status:
 * - Success: Returns user details (userId, role, email) if the session is valid.
 * - Failure: Returns an error message if no session is found, or if the session is invalid or expired.
 */
export const checkSession: AppRouteHandler<SessionRoute> = async (c) => {
  const jwtToken = getCookie(c, "student_session") ||
    getCookie(c, "staff_session") ||
    getCookie(c, "admin_session") ||
    getCookie(c, "oauth_session");
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
      userId: decoded.staff_id || decoded.student_id || decoded.id || decoded.userId,
      role: decoded.role,
      email: decoded.email,
    }, 200);
  } catch (error) {
    console.error("Session verification error:", error);
    return c.json({ success: false, message: "Invalid or expired session" }, 401);
  }
};