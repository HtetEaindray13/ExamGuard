import { cookies } from "next/headers";
import { googleAuthConfig, safeReturnTo } from "../../../../auth";

function randomValue() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function challenge(verifier: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  const config = googleAuthConfig();
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
  if (!config) return Response.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}&setup=google`, request.url), 303);

  const state = randomValue();
  const verifier = randomValue();
  const cookieStore = await cookies();
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: requestUrl.protocol === "https:", path: "/", maxAge: 600 };
  cookieStore.set("examguard_oauth_state", state, cookieOptions);
  cookieStore.set("examguard_oauth_verifier", verifier, cookieOptions);
  cookieStore.set("examguard_oauth_return", returnTo, cookieOptions);

  const redirectUri = `${requestUrl.origin}/api/auth/google/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", redirectUri);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("code_challenge", await challenge(verifier));
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("prompt", "select_account");
  return Response.redirect(authorization, 302);
}
