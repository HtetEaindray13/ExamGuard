import { cookies } from "next/headers";
import { createAuthSession, googleAuthConfig, safeReturnTo, type AuthUser } from "../../../../auth";
import { ensureUserProfile } from "../../../../../db/user-profile";

type GoogleToken = { access_token?: string; error?: string };
type GoogleProfile = { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(request: Request) {
  const config = googleAuthConfig();
  if (!config) return Response.redirect(new URL("/login?setup=google", request.url), 303);
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expectedState = cookieStore.get("examguard_oauth_state")?.value;
  const verifier = cookieStore.get("examguard_oauth_verifier")?.value;
  const returnTo = safeReturnTo(cookieStore.get("examguard_oauth_return")?.value);
  for (const name of ["examguard_oauth_state", "examguard_oauth_verifier", "examguard_oauth_return"]) cookieStore.delete(name);
  if (!code || !state || !expectedState || state !== expectedState || !verifier) return Response.redirect(new URL("/login?error=oauth", request.url), 303);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier }),
    });
    const token = await tokenResponse.json() as GoogleToken;
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error || "Google token exchange failed.");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.sub || !profile.email || !profile.email_verified) throw new Error("Google did not return a verified profile.");
    const user: AuthUser = { userId: `google:${profile.sub}`, displayName: profile.name?.trim() || profile.email, email: profile.email, avatarUrl: profile.picture ?? null };
    const profileRecord = await ensureUserProfile(user);
    await createAuthSession(user);
    const destination = profileRecord.role ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
    return Response.redirect(new URL(destination, request.url), 303);
  } catch {
    return Response.redirect(new URL("/login?error=oauth", request.url), 303);
  }
}
