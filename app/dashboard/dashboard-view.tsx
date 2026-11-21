import Link from "next/link";
import type { UserProfile } from "../../db/user-profile";
import type { TeacherExamSummary } from "../../db/teacher-exams";
import type { StudentSubmissionSummary } from "../../db/student-submissions";
import ThemeToggle from "../theme-toggle";

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function scoreLabel(submission: StudentSubmissionSummary) {
  return submission.finalScore === null ? "Pending" : `${submission.finalScore}/${submission.finalTotal}`;
}

function resultStatusLabel(submission: StudentSubmissionSummary) {
  if (submission.scoreStatus === "pending") return "Manual review pending";
  if (submission.scoreStatus === "automatic" && submission.reviewStatus === "Awaiting review") return "Auto-scored · Review pending";
  return submission.reviewStatus;
}

export default function DashboardView({ profile, accountRole, teacherExams = [], studentSubmissions = [], examStatusFilter = "active" }: { profile: UserProfile; accountRole: "student" | "teacher"; teacherExams?: TeacherExamSummary[]; studentSubmissions?: StudentSubmissionSummary[]; examStatusFilter?: "all" | "draft" | "active" | "archived" }) {
  const student = accountRole === "student";
  const totalSubmissions = teacherExams.reduce((total, exam) => total + exam.submissionCount, 0);
  const activeExams = teacherExams.filter((exam) => exam.status === "active");
  const visibleTeacherExams = examStatusFilter === "all" ? teacherExams : teacherExams.filter((exam) => exam.status === examStatusFilter);
  const scoredSubmissions = studentSubmissions.filter((submission) => submission.finalScore !== null && submission.finalTotal > 0);
  const averageScore = scoredSubmissions.length ? Math.round(scoredSubmissions.reduce((total, submission) => total + (((submission.finalScore ?? 0) / submission.finalTotal) * 100), 0) / scoredSubmissions.length) : null;
  const awaitingReview = studentSubmissions.filter((submission) => submission.reviewStatus === "Awaiting review").length;

  return <main className="accountDashboard">
    <header className="accountDashboardHeader">
      <Link className="dashboardBrand" href="/" aria-label="ExamGuard home"><span>EXAM</span>GUARD</Link>
      <nav aria-label="Dashboard navigation"><ThemeToggle /><Link href="/profile">My profile</Link><a href="/api/auth/logout?returnTo=/">Log out</a></nav>
    </header>
    <section className="accountDashboardShell">
      <div className="dashboardWelcome">
        <div><span className="dashboardEyebrow">{student ? "Student dashboard" : "Teacher dashboard"}</span><h1>Welcome back, {profile.displayName}</h1><p>{student ? "Your exam attempts and results stay organized here." : "Your created exams and student submissions stay organized here."}</p></div>
        <span className={`dashboardRoleBadge ${accountRole}`}>{student ? "Student" : "Teacher"}</span>
      </div>
      <div className="dashboardStatGrid">
        <article><span>{student ? "Completed exams" : "Created exams"}</span><strong>{student ? studentSubmissions.length : teacherExams.length}</strong><small>{student ? "Submissions connected to you" : "Assessments connected to you"}</small></article>
        <article><span>{student ? "Average score" : "Student submissions"}</span><strong>{student ? (averageScore === null ? "—" : `${averageScore}%`) : totalSubmissions}</strong><small>{student ? "Across automatically graded questions" : "Across all your exams"}</small></article>
        <article><span>{student ? "Awaiting review" : "Active exam codes"}</span><strong>{student ? awaitingReview : activeExams.length}</strong><small>{student ? "Teacher reviews not yet published" : "Codes ready to share with students"}</small></article>
      </div>
      <section className="dashboardHistory" aria-labelledby="history-title">
        <div><span className="dashboardEyebrow">History</span><h2 id="history-title">{student ? "Your exam results" : "Your created exams"}</h2></div>
        {!student && teacherExams.length > 0 && <nav className="examFilters" aria-label="Filter exams by status">{(["active", "draft", "archived", "all"] as const).map((status) => <Link key={status} className={examStatusFilter === status ? "active" : ""} href={status === "active" ? "/dashboard/teacher" : `/dashboard/teacher?status=${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}<span>{status === "all" ? teacherExams.length : teacherExams.filter((exam) => exam.status === status).length}</span></Link>)}</nav>}
        {student && studentSubmissions.length > 0 ? <div className="studentResultList">
          {studentSubmissions.map((submission) => <article key={submission.id} className="studentResultRow">
            <div className="teacherExamIdentity"><span>{submission.subject}</span><h3>{submission.title}</h3><small>Submitted {formatDate(submission.submittedAt)} · Code {submission.examCode}</small></div>
            <div className="studentResultStatus"><strong>{scoreLabel(submission)}</strong><span>{resultStatusLabel(submission)}</span></div>
            <span className={`resultRisk ${submission.risk.toLowerCase()}`}>{submission.risk} signals</span>
            <Link href={`/dashboard/student/submissions/${encodeURIComponent(submission.id)}`}>View result <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></Link>
          </article>)}
        </div> : !student && visibleTeacherExams.length > 0 ? <div className="teacherExamList">
          {visibleTeacherExams.map((exam) => <article key={exam.id} className="teacherExamRow">
            <div className="teacherExamIdentity"><span>{exam.subject}</span><h3>{exam.title}</h3><small>Created {formatDate(exam.createdAt)} · <b className={`dashboardExamStatus ${exam.status}`}>{exam.status}</b></small></div>
            <dl className="teacherExamMeta"><div><dt>Exam code</dt><dd>{exam.studentCode}</dd></div><div><dt>Submissions</dt><dd>{exam.submissionCount}</dd></div></dl>
            <Link href={`/dashboard/teacher/exams/${encodeURIComponent(exam.id)}`}>View details <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></Link>
          </article>)}
        </div> : !student && teacherExams.length > 0 ? <div className="dashboardEmptyState compact"><span className="dashboardEmptyIcon"><svg aria-hidden="true" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg></span><h3>No {examStatusFilter} exams</h3><p>Choose another status filter or create a new assessment.</p></div>
        : <div className="dashboardEmptyState">
          <span className="dashboardEmptyIcon"><svg aria-hidden="true" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span>
          <h3>{student ? "No exam results yet" : "No exams connected yet"}</h3>
          <p>{student ? "Complete a signed-in exam and its score and review status will appear here." : "Create your first signed-in exam and it will appear here automatically."}</p>
          <Link href={student ? "/#exam-code" : "/?teacherAction=create"}>{student ? "Join an exam" : "Create an exam"}</Link>
        </div>}
      </section>
    </section>
  </main>;
}
