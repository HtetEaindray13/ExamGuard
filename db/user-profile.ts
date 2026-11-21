import { eq, sql } from "drizzle-orm";
import type { AuthUser } from "../app/auth";
import { ensureDatabase, getDb } from ".";
import { users } from "./schema";

export type UserProfile = typeof users.$inferSelect;

export async function ensureUserProfile(identity: AuthUser): Promise<UserProfile> {
  await ensureDatabase();
  const db = getDb();
  await db.insert(users).values({
    id: identity.userId,
    email: identity.email,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
  }).onConflictDoUpdate({
    target: users.id,
    set: {
      email: identity.email,
      avatarUrl: identity.avatarUrl,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    },
  });

  const [profile] = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
  if (!profile) throw new Error("Could not create the user profile.");
  return profile;
}
