import { redirect } from "next/navigation";
import { requireAuthUser } from "../../auth";
import { ensureUserProfile } from "../../../db/user-profile";
import { getTeacherExamHistory } from "../../../db/teacher-exams";
import DashboardView from "../dashboard-view";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const identity = await requireAuthUser("/dashboard/teacher");
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect("/onboarding?returnTo=/dashboard/teacher");
  if (profile.role !== "teacher") redirect("/dashboard/student");
  const teacherExams = await getTeacherExamHistory(identity.userId);
  const requestedStatus = (await searchParams).status;
  const examStatusFilter = requestedStatus === "draft" || requestedStatus === "archived" || requestedStatus === "all" ? requestedStatus : "active";
  return <DashboardView profile={profile} accountRole="teacher" teacherExams={teacherExams} examStatusFilter={examStatusFilter} />;
}
