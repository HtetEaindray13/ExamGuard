"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../theme-toggle";

type ExamRow = { id: string; code: string; title: string; subject: string; createdAt: string };
type SubmissionRow = { id: string; examCode: string; studentId: string; name: string; score: unknown; total: unknown; risk: string; createdAt: string };
type UserRow = { id: string; displayName: string; email: string; role: "student" | "teacher" | null; createdAt: string };

export default function DatabaseAdmin({ displayName }: { displayName: string }) {
  const [data, setData] = useState<{ exams: ExamRow[]; submissions: SubmissionRow[]; users: UserRow[] }>({ exams: [], submissions: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");
  const [correcting, setCorrecting] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, "student" | "teacher" | "">>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/database", { cache: "no-store" });
      const result = await response.json() as { exams?: ExamRow[]; submissions?: SubmissionRow[]; users?: UserRow[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load database records.");
      const users = result.users ?? [];
      setData({ exams: result.exams ?? [], submissions: result.submissions ?? [], users });
      setRoleDrafts(Object.fromEntries(users.map((user) => [user.id, user.role ?? ""])));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load database records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(table: "exams" | "submissions", id: string, label: string) {
    const warning = table === "exams" ? `Delete ${label} and all of its submissions? This cannot be undone.` : `Delete the submission from ${label}? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setDeleting(id);
    setError("");
    try {
      const response = await fetch("/api/admin/database", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ table, id }) });
      if (!response.ok) throw new Error("The record could not be deleted.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The record could not be deleted.");
    } finally {
      setDeleting("");
    }
  }

  async function correctRole(user: UserRow) {
    const role = roleDrafts[user.id];
    if (!role || role === user.role) return;
    if (!window.confirm(`Change ${user.email} from ${user.role ?? "no role"} to ${role}? Use this only to correct a mistaken selection.`)) return;
    setCorrecting(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/database", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id, role }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The account role could not be corrected.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The account role could not be corrected.");
    } finally {
      setCorrecting("");
    }
  }

  return <main className="adminShell">
    <header className="adminHeader"><Link href="/" className="adminBrand">EXAM<span>GUARD</span></Link><div><small>Database administration</small><strong>{displayName}</strong></div><span className="adminHeaderSpacer" /><ThemeToggle /><a href="/api/auth/logout?returnTo=/" className="adminSignout">Log out</a></header>
    <section className="adminContent">
      <div className="adminIntro"><div><span>Live production data</span><h1>Database manager</h1><p>Review stored exams and submissions. Deletions take effect immediately across every device.</p></div><button onClick={() => void load()} disabled={loading}>Refresh data</button></div>
      {error && <div className="adminError" role="alert">{error}</div>}
      <div className="adminStats"><article><strong>{data.exams.length}</strong><span>Exams</span></article><article><strong>{data.submissions.length}</strong><span>Submissions</span></article><article><strong>{data.users.length}</strong><span>Accounts</span></article></div>

      <section className="adminPanel"><div className="adminPanelTitle"><div><span>Account administration</span><h2>users</h2></div><small>{data.users.length} records</small></div>
        <p className="adminPanelNote">Account roles are permanent for users. Use this control only to correct a role selected by mistake.</p>
        {loading ? <p className="adminEmpty">Loading accounts…</p> : data.users.length === 0 ? <p className="adminEmpty">No accounts have been created yet.</p> : <div className="adminTableWrap"><table><thead><tr><th>User</th><th>Current role</th><th>Correct role</th><th>Joined</th><th>Action</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong><small>{user.email}</small></td><td><span className="adminRole">{user.role ?? "Not selected"}</span></td><td><select aria-label={`Correct role for ${user.displayName}`} value={roleDrafts[user.id] ?? ""} onChange={(event) => setRoleDrafts((current) => ({ ...current, [user.id]: event.target.value as "student" | "teacher" | "" }))}><option value="">Choose role</option><option value="student">Student</option><option value="teacher">Teacher</option></select></td><td>{new Date(user.createdAt).toLocaleString()}</td><td><button className="adminCorrect" disabled={!roleDrafts[user.id] || roleDrafts[user.id] === user.role || correcting === user.id} onClick={() => void correctRole(user)}>{correcting === user.id ? "Updating…" : "Correct role"}</button></td></tr>)}</tbody></table></div>}
      </section>

      <section className="adminPanel"><div className="adminPanelTitle"><div><span>Table</span><h2>exams</h2></div><small>{data.exams.length} records</small></div>
        {loading ? <p className="adminEmpty">Loading database…</p> : data.exams.length === 0 ? <p className="adminEmpty">No exams have been published yet.</p> : <div className="adminTableWrap"><table><thead><tr><th>Exam</th><th>Code</th><th>Subject</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.exams.map((exam) => <tr key={exam.id}><td><strong>{exam.title}</strong><small>{exam.id}</small></td><td><code>{exam.code}</code></td><td>{exam.subject || "—"}</td><td>{new Date(exam.createdAt).toLocaleString()}</td><td><button className="adminDelete" disabled={deleting === exam.id} onClick={() => void remove("exams", exam.id, `exam “${exam.title}”`)}>{deleting === exam.id ? "Deleting…" : "Delete"}</button></td></tr>)}</tbody></table></div>}
      </section>

      <section className="adminPanel"><div className="adminPanelTitle"><div><span>Table</span><h2>submissions</h2></div><small>{data.submissions.length} records</small></div>
        {loading ? <p className="adminEmpty">Loading database…</p> : data.submissions.length === 0 ? <p className="adminEmpty">No student submissions have been saved yet.</p> : <div className="adminTableWrap"><table><thead><tr><th>Student</th><th>Exam code</th><th>Score</th><th>Risk</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.submissions.map((submission) => <tr key={submission.id}><td><strong>{submission.name}</strong><small>{submission.studentId}</small></td><td><code>{submission.examCode}</code></td><td>{submission.score === null ? "—" : `${String(submission.score)} / ${String(submission.total)}`}</td><td><span className={`adminRisk ${submission.risk.toLowerCase()}`}>{submission.risk}</span></td><td>{new Date(submission.createdAt).toLocaleString()}</td><td><button className="adminDelete" disabled={deleting === submission.id} onClick={() => void remove("submissions", submission.id, submission.name)}>{deleting === submission.id ? "Deleting…" : "Delete"}</button></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>;
}
