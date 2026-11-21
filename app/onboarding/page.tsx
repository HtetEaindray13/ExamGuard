import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthUser, safeReturnTo } from "../auth";
import { ensureUserProfile } from "../../db/user-profile";
import RoleSelector from "./role-selector";
import ThemeToggle from "../theme-toggle";
import "./onboarding.css";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo || "/dashboard");
  const identity = await requireAuthUser(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  const profile = await ensureUserProfile(identity);
  if (profile.role) redirect(returnTo);
  const suggestedRole = /teacherAction|\/dashboard\/teacher/.test(returnTo) ? "teacher" : /studentAction|\/dashboard\/student/.test(returnTo) ? "student" : null;

  return <main className="onboardingPage">
    <header className="onboardingHeader">
      <Link className="onboardingBrand" href="/" aria-label="ExamGuard home"><span>EXAM</span>GUARD</Link>
      <div className="onboardingHeaderActions"><span>Account setup</span><ThemeToggle /></div>
    </header>
    <section className="onboardingShell" aria-labelledby="onboarding-title">
      <div className="onboardingIntro">
        <span className="onboardingEyebrow">Welcome, {profile.displayName}</span>
        <h1 id="onboarding-title">How will you use ExamGuard?</h1>
        <p>Choose the role that matches how you will use ExamGuard. This choice controls your permissions and cannot be changed from your profile.</p>
      </div>
      <RoleSelector returnTo={returnTo} suggestedRole={suggestedRole} />
      <p className="onboardingPrivacy">Your Google account details stay private. An administrator can correct a role selected by mistake.</p>
    </section>
  </main>;
}
