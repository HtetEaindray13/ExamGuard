import { env } from "cloudflare:workers";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthUser = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type AuthEnv = {
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

const SESSION_COOKIE = "examguard_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const LOCAL_SECRET = "examguard-local-development-session-secret";

type SessionPayload = AuthUser & { expiresAt: number };

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const secret = await sessionSecret();
  if (!secret) return null;
  const payload = await verifySession(token, secret);
  if (!payload || payload.expiresAt <= Date.now()) return null;
  return { userId: payload.userId, displayName: payload.displayName, email: payload.email, avatarUrl: payload.avatarUrl };
}

export async function requireAuthUser(returnTo: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
}

export async function createAuthSession(user: AuthUser) {
  const secret = await sessionSecret();
  if (!secret) throw new Error("AUTH_SECRET is required outside local development.");
  const cookieStore = await cookies();
  const local = await isLocalDevelopmentRequest();
  const token = await signSession({ ...user, expiresAt: Date.now() + (SESSION_DURATION_SECONDS * 1000) }, secret);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !local,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function googleAuthConfig() {
  const bindings = env as unknown as AuthEnv;
  const clientId = bindings.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = bindings.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function isLocalDevelopmentRequest() {
  if (process.env.NODE_ENV === "production") return false;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0].trim().toLowerCase();
  return host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:") || host === "[::1]" || host.startsWith("[::1]:");
}

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

async function sessionSecret() {
  const configured = (env as unknown as AuthEnv).AUTH_SECRET?.trim();
  if (configured) return configured;
  return await isLocalDevelopmentRequest() ? LOCAL_SECRET : null;
}

async function signSession(payload: SessionPayload, secret: string) {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature || signature !== await sign(body, secret)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload;
    if (!payload.userId || !payload.email || !payload.displayName || typeof payload.expiresAt !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
