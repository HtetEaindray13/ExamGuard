import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuthUser } from "../../../../auth";
import { ensureUserProfile } from "../../../../../db/user-profile";
import { getStudentSubmission } from "../../../../../db/student-submissions";
import ThemeToggle from "../../../../theme-toggle";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function StudentSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/dashboard/student/submissions/${encodeURIComponent(id)}`;
  const identity = await requireAuthUser(returnTo);
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  if (profile.role !== "student") redirect("/dashboard/teacher");
  const submission = await getStudentSubmission(identity.userId, id);
  if (!submission) notFound();
  const automaticReviewPending = submission.scoreStatus === "automatic" && !submission.reviewedAt;
  const scoreHeading = submission.scoreStatus === "reviewed" ? "Reviewed final score" : submission.scoreStatus === "automatic" ? "Automatic score" : "Final score";

  return <main className="accountDashboard resultDetailPage">
    <header className="accountDashboardHeader">
      <Link className="dashboardBrand" href="/" aria-label="ExamGuard home"><span>EXAM</span>GUARD</Link>
      <nav aria-label="Result navigation"><ThemeToggle /><Link href="/dashboard/student">Dashboard</Link><Link href="/profile">My profile</Link></nav>
    </header>
    <section className="resultDetailShell">
      <Link className="resultBack" href="/dashboard/student"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg> Back to results</Link>
      <section className="resultHero">
        <div><span className="dashboardEyebrow">{submission.subject}</span><h1>{submission.title}</h1><p>Submitted {formatDate(submission.submittedAt)} · Exam code {submission.examCode}</p></div>
        <div className="resultScore"><span>{scoreHeading}</span><strong>{submission.finalScore === null ? "Pending" : `${submission.finalScore}/${submission.finalTotal}`}</strong></div>
      </section>
      <div className={`resultNotice ${submission.reviewStatus === "Needs follow-up" ? "followUp" : ""}`}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><span><strong>{automaticReviewPending ? "Automatic score available" : submission.reviewStatus}</strong>{submission.reviewedAt ? `Teacher review updated ${formatDate(submission.reviewedAt)}.${submission.reviewDecision ? ` Decision: ${submission.reviewDecision}.` : ""}` : automaticReviewPending ? "All scored questions were graded automatically. Your teacher can still review the recorded integrity signals." : "Your teacher must mark the short-answer questions before the final score is available."}</span></div>
      {submission.reviewedAt && <section className="teacherFeedback" aria-labelledby="feedback-title"><span className="dashboardEyebrow">Teacher feedback</span><h2 id="feedback-title">Review notes</h2><p>{submission.teacherFeedback || "Your teacher completed the review without adding a written note."}</p><small>Automatic score: {submission.score ?? 0}/{submission.total} · Manual marks: {(submission.finalScore ?? 0) - (submission.score ?? 0)}/{submission.manualPointsTotal}</small></section>}
      <section className="resultAnswers" aria-labelledby="answers-title">
        <div><span className="dashboardEyebrow">Answer review</span><h2 id="answers-title">Your responses</h2></div>
        {submission.answers.length ? <div>{submission.answers.map((answer, index) => <article key={`${answer.prompt}-${index}`}>
          <div><span>Question {index + 1}</span><span className={`answerState ${answer.result.toLowerCase().replace(" ", "-")}`}>{answer.result}</span></div>
          <h3>{answer.prompt}</h3><p><strong>Your answer</strong>{answer.student}</p><small>{answer.points}</small>
        </article>)}</div> : <p className="resultNoAnswers">Detailed answers are unavailable for this submission.</p>}
      </section>
    </section>
  </main>;
}
