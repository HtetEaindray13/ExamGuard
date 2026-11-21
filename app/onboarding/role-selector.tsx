"use client";

import { useState } from "react";

type Role = "student" | "teacher";

function RoleIcon({ role }: { role: Role }) {
  if (role === "student") return <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17c2.8 2.1 7.2 2.1 10 0v-4.5"/><path d="M21 10v6"/></svg>;
  return <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="3" width="16" height="13" rx="2"/><path d="M8 21c.8-2.2 2.1-3.3 4-3.3s3.2 1.1 4 3.3M8 8h8M8 11h5"/></svg>;
}

const options: Array<{ role: Role; title: string; description: string; details: string }> = [
  { role: "student", title: "I'm a student", description: "Take exams and keep every result connected to your account.", details: "Score history · Submission status · Teacher feedback" },
  { role: "teacher", title: "I'm a teacher", description: "Create assessments and return to your exam history anytime.", details: "Created exams · Student submissions · Integrity reviews" },
];

export default function RoleSelector({ returnTo, suggestedRole }: { returnTo: string; suggestedRole: Role | null }) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(suggestedRole);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function continueToDashboard() {
    if (!selectedRole) {
      setError("Choose student or teacher to continue.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save your role.");
      window.location.assign(returnTo === "/" ? "/dashboard" : returnTo);
    } catch (problem) {
      setStatus("error");
      setError(problem instanceof Error ? problem.message : "Could not save your role.");
    }
  }

  return <div className="roleSelection">
    <div className="roleOptions" role="radiogroup" aria-label="Choose your primary role">
      {options.map((option) => <button
        key={option.role}
        type="button"
        className={`roleOption ${selectedRole === option.role ? "selected" : ""}`}
        role="radio"
        aria-checked={selectedRole === option.role}
        onClick={() => { setSelectedRole(option.role); setConfirmed(false); setStatus("idle"); setError(""); }}
      >
        <span className="roleOptionTop"><span className="roleOptionIcon"><RoleIcon role={option.role} /></span><span className="roleCheck" aria-hidden="true">{selectedRole === option.role && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 4 4L19 6"/></svg>}</span></span>
        <strong>{option.title}</strong>
        <span className="roleDescription">{option.description}</span>
        <small>{option.details}</small>
      </button>)}
    </div>
    <label className={`roleCommitment ${selectedRole ? "ready" : ""}`}>
      <input type="checkbox" checked={confirmed} disabled={!selectedRole} onChange={(event) => { setConfirmed(event.target.checked); setStatus("idle"); setError(""); }} />
      <span><strong>Confirm permanent account role</strong>{selectedRole ? `I understand that my account will be registered as a ${selectedRole} and I cannot change this from my profile.` : "Choose Student or Teacher before confirming."}</span>
    </label>
    <div className="roleSelectionFooter">
      <p className={error ? "roleError" : ""} role="status" aria-live="polite">{error || (selectedRole ? `Continue with a permanent ${selectedRole} account.` : "Select one role to personalize your dashboard.")}</p>
      <button className="roleContinue" type="button" disabled={!selectedRole || !confirmed || status === "saving"} onClick={continueToDashboard}>
        {status === "saving" ? "Saving…" : "Continue to dashboard"}
        {status !== "saving" && <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
      </button>
    </div>
  </div>;
}
