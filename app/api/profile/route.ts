import { eq, sql } from "drizzle-orm";
import { getAuthUser } from "../../auth";
import { getDb } from "../../../db";
import { ensureUserProfile } from "../../../db/user-profile";
import { users } from "../../../db/schema";

type ProfileUpdate = {
  displayName?: unknown;
  role?: unknown;
  studentId?: unknown;
  organization?: unknown;
};

function cleanRole(value: unknown) {
  if (value === "student" || value === "teacher") return value;
  throw new Error("Choose either the student or teacher role.");
}

function cleanRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return cleaned;
}

function cleanOptionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return cleaned;
}

export async function GET() {
  const identity = await getAuthUser();
  if (!identity) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const profile = await ensureUserProfile(identity);
    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const identity = await getAuthUser();
  if (!identity) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const currentProfile = await ensureUserProfile(identity);
    const body = await request.json() as ProfileUpdate;
    const displayName = body.displayName === undefined ? currentProfile.displayName : cleanRequiredText(body.displayName, "Display name", 80);
    const requestedRole = body.role === undefined ? currentProfile.role : cleanRole(body.role);
    if (currentProfile.role && requestedRole !== currentProfile.role) {
      return Response.json({ error: "Your account role is permanent. Contact an administrator if it is incorrect." }, { status: 409 });
    }
    const role = requestedRole;
    const studentId = role === "student"
      ? body.studentId === undefined ? currentProfile.studentId : cleanOptionalText(body.studentId, "Student ID", 64)
      : null;
    const organization = body.organization === undefined ? currentProfile.organization : cleanOptionalText(body.organization, "School or organization", 120);
    const db = getDb();
    await db.update(users).set({
      displayName,
      role,
      studentId,
      organization,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(users.id, identity.userId));
    const [profile] = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
    return Response.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the profile.";
    const validationError = /required|invalid|characters or fewer|Choose either/.test(message);
    return Response.json({ error: message }, { status: validationError ? 400 : 500 });
  }
}
