import { getAuthUser, googleAuthConfig, isLocalDevelopmentRequest } from "../../../auth";
import { ensureUserProfile } from "../../../../db/user-profile";

export async function GET() {
  const user = await getAuthUser();
  const profile = user ? await ensureUserProfile(user) : null;
  return Response.json({ user: user ? { ...user, role: profile?.role ?? null, studentId: profile?.studentId ?? null } : null, googleConfigured: Boolean(googleAuthConfig()), localDevelopment: await isLocalDevelopmentRequest() });
}
