import { redirect } from "next/navigation";
import { requireAuthUser } from "../../auth";
import { ensureUserProfile } from "../../../db/user-profile";
import { getStudentSubmissionHistory } from "../../../db/student-submissions";
import DashboardView from "../dashboard-view";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const identity = await requireAuthUser("/dashboard/student");
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect("/onboarding?returnTo=/dashboard/student");
  if (profile.role !== "student") redirect("/dashboard/teacher");
  const studentSubmissions = await getStudentSubmissionHistory(identity.userId);
  return <DashboardView profile={profile} accountRole="student" studentSubmissions={studentSubmissions} />;
}
