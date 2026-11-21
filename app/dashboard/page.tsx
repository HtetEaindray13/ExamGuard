import { redirect } from "next/navigation";
import { requireAuthUser } from "../auth";
import { ensureUserProfile } from "../../db/user-profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const identity = await requireAuthUser("/dashboard");
  const profile = await ensureUserProfile(identity);
  if (!profile.role) redirect("/onboarding?returnTo=/dashboard");
  redirect(`/dashboard/${profile.role}`);
}
