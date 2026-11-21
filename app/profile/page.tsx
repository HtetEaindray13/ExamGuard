import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthUser } from "../auth";
import { ensureUserProfile } from "../../db/user-profile";
import ProfileForm from "./profile-form";
import ThemeToggle from "../theme-toggle";
import "./profile.css";

export const dynamic = "force-dynamic";

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "EG";
}

export default async function ProfilePage() {
  const identity = await requireAuthUser("/profile");
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect("/onboarding?returnTo=/profile");

  return <main className="profilePage">
    <header className="profileHeader">
      <Link className="profileBrand" href="/" aria-label="ExamGuard home"><span>EXAM</span>GUARD</Link>
      <nav aria-label="Account navigation">
        <ThemeToggle />
        <Link href="/">Home</Link>
        <Link href="/dashboard">Dashboard</Link>
        <a className="profileSignOut" href="/api/auth/logout?returnTo=/">Log out</a>
      </nav>
    </header>

    <section className="profileShell">
      <aside className="profileSummary">
        <span className="profileEyebrow">ExamGuard account</span>
        <div className="profileAvatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${profile.displayName} profile`} referrerPolicy="no-referrer" /> : <span aria-hidden="true">{initials(profile.displayName)}</span>}</div>
        <h1>{profile.displayName}</h1>
        <p>{profile.email}</p>
        <div className="profileTrustNote">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
          <span><strong>{`${profile.role[0].toUpperCase()}${profile.role.slice(1)} account`}</strong>Your permanent role keeps your dashboard and permissions consistent.</span>
        </div>
      </aside>

      <section className="profileCard" aria-labelledby="profile-title">
        <div className="profileCardHeading">
          <div>
            <span>Personal information</span>
            <h2 id="profile-title">My profile</h2>
          </div>
          <p>Keep your details accurate so future exams and submissions can be connected to you.</p>
        </div>
        <ProfileForm initialProfile={profile} />
      </section>
    </section>
  </main>;
}
