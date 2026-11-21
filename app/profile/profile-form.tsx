"use client";

import { type FormEvent, useRef, useState } from "react";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: "student" | "teacher" | null;
  studentId: string | null;
  organization: string | null;
};

export default function ProfileForm({ initialProfile }: { initialProfile: Profile }) {
  const displayNameRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [studentId, setStudentId] = useState(initialProfile.studentId ?? "");
  const [organization, setOrganization] = useState(initialProfile.organization ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      setStatus("error");
      setMessage("Enter a display name before saving.");
      displayNameRef.current?.focus();
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, studentId, organization }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      setStatus("saved");
      setMessage("Your profile has been saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save your profile.");
    }
  }

  return <form className="profileForm" onSubmit={saveProfile}>
    <div className="profileFieldGrid">
      <label className="profileField profileFieldWide">
        <span>Display name</span>
        <input ref={displayNameRef} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus("idle"); }} maxLength={80} autoComplete="name" required />
        <small>This name will appear with your exams and submissions.</small>
      </label>

      <label className="profileField profileFieldWide">
        <span>Email address</span>
        <input value={initialProfile.email} readOnly aria-describedby="profile-email-help" />
        <small id="profile-email-help">Your email comes from your signed-in account and cannot be changed here.</small>
      </label>

      <div className="profileField profileRoleField">
        <span>Account role</span>
        <div className="profileRoleLocked">
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <strong>{initialProfile.role === "teacher" ? "Teacher" : "Student"}</strong>
          <span>Permanent</span>
        </div>
        <small>Your role was confirmed during account setup. Contact an administrator if it is incorrect.</small>
      </div>

      {initialProfile.role === "student" && <label className="profileField">
        <span>Student ID <em>Optional</em></span>
        <input value={studentId} onChange={(event) => { setStudentId(event.target.value); setStatus("idle"); }} maxLength={64} placeholder="e.g. STU-1042" autoComplete="off" />
      </label>}

      <label className={`profileField ${initialProfile.role === "teacher" ? "profileFieldWide" : ""}`}>
        <span>School or organization <em>Optional</em></span>
        <input value={organization} onChange={(event) => { setOrganization(event.target.value); setStatus("idle"); }} maxLength={120} placeholder="e.g. Northbridge College" autoComplete="organization" />
      </label>
    </div>

    <div className="profileFormFooter">
      <div className={`profileStatus ${status}`} role="status" aria-live="polite">
        {message || "Your profile is private and connected to your signed-in account."}
      </div>
      <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button>
    </div>
  </form>;
}
