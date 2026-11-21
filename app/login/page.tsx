import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser, googleAuthConfig, safeReturnTo } from "../auth";
import { ensureUserProfile } from "../../db/user-profile";
import ThemeToggle from "../theme-toggle";
import "./login.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string; setup?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const identity = await getAuthUser();
  if (identity) {
    const profile = await ensureUserProfile(identity);
    redirect(profile.role ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const googleReady = Boolean(googleAuthConfig());

  return <main className="loginPage">
    <section className="loginCard" aria-labelledby="login-title">
      <div className="loginBrandRow"><Link className="loginBrand" href="/"><span>EXAM</span>GUARD</Link><ThemeToggle /></div>
      <span className="loginEyebrow">One account for every exam</span>
      <h1 id="login-title">Log in to ExamGuard</h1>
      <p>Keep your exam history, scores, created assessments, and teacher reviews connected to you.</p>
      {params.error && <div className="loginError" role="alert">Google sign-in could not be completed. Please try again.</div>}
      {params.setup && <div className="loginSetup" role="status">Google sign-in needs local credentials before it can be used.</div>}
      <a className={`googleLogin ${!googleReady ? "notReady" : ""}`} href={`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`} aria-disabled={!googleReady}>Continue with Google</a>
      {!googleReady && <small className="loginHelper">Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to <code>.dev.vars</code> to enable Google locally.</small>}
      <div className="loginPrivacy">By continuing, you agree to use one secure profile for student and teacher activity.</div>
      <Link className="loginBack" href="/">Back to home</Link>
    </section>
  </main>;
}
