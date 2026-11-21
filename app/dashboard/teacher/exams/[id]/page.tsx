import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuthUser } from "../../../../auth";
import { ensureUserProfile } from "../../../../../db/user-profile";
import { getTeacherExam } from "../../../../../db/teacher-exams";
import ExamManager from "./exam-manager";
import ThemeToggle from "../../../../theme-toggle";
import "./exam-manager.css";
import "./exam-manager-accessibility.css";

export const dynamic = "force-dynamic";

export default async function TeacherExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/dashboard/teacher/exams/${encodeURIComponent(id)}`;
  const identity = await requireAuthUser(returnTo);
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  if (profile.role !== "teacher") redirect("/dashboard/student");
  const exam = await getTeacherExam(identity.userId, id);
  if (!exam) notFound();

  return <main className="accountDashboard examManagerPage">
    <header className="accountDashboardHeader">
      <Link className="dashboardBrand" href="/" aria-label="ExamGuard home"><span>EXAM</span>GUARD</Link>
      <nav aria-label="Exam management navigation"><ThemeToggle /><Link href="/dashboard/teacher">Dashboard</Link><Link href="/profile">My profile</Link></nav>
    </header>
    <ExamManager initialExam={exam} />
  </main>;
}
