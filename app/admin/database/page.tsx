import { env } from "cloudflare:workers";
import { requireAuthUser } from "../../auth";
import DatabaseAdmin from "./database-admin";
import "./admin.css";

export const dynamic = "force-dynamic";

type AdminEnv = { ADMIN_EMAIL?: string };

export default async function DatabaseAdminPage() {
  const user = await requireAuthUser("/admin/database");
  const adminEmail = (env as unknown as AdminEnv).ADMIN_EMAIL?.trim().toLowerCase();
  const authorized = Boolean(adminEmail && user.email.toLowerCase() === adminEmail);

  if (!authorized) {
    return <main className="adminShell"><section className="adminDenied"><span>ExamGuard administration</span><h1>Access denied</h1><p>This database area is available only to the site owner.</p><a href="/">Return to ExamGuard</a></section></main>;
  }

  return <DatabaseAdmin displayName={user.displayName} />;
}
