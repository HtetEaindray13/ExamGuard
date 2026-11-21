import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

let initialization: Promise<unknown> | null = null;

export function ensureDatabase() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  initialization ??= (async () => {
    await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY NOT NULL,
      student_code TEXT NOT NULL UNIQUE,
      teacher_key TEXT NOT NULL,
      teacher_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'archived')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY NOT NULL,
      exam_code TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_user_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT CHECK(role IN ('student', 'teacher')),
      student_id TEXT,
      organization TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS submission_reviews (
      submission_id TEXT PRIMARY KEY NOT NULL,
      teacher_user_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('Valid concern', 'False detection', 'Technical issue', 'Acceptable')),
      feedback TEXT NOT NULL DEFAULT '',
      manual_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_exam_code ON submissions(exam_code)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_submission_reviews_teacher_user_id ON submission_reviews(teacher_user_id)"),
    ]);
    const examTableInfo = await env.DB.prepare("PRAGMA table_info(exams)").all<{ name: string }>();
    if (!examTableInfo.results.some((column) => column.name === "teacher_user_id")) {
      await env.DB.prepare("ALTER TABLE exams ADD COLUMN teacher_user_id TEXT").run();
    }
    if (!examTableInfo.results.some((column) => column.name === "status")) {
      await env.DB.prepare("ALTER TABLE exams ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run();
    }
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_exams_teacher_user_id ON exams(teacher_user_id)").run();
    const submissionTableInfo = await env.DB.prepare("PRAGMA table_info(submissions)").all<{ name: string }>();
    if (!submissionTableInfo.results.some((column) => column.name === "student_user_id")) {
      await env.DB.prepare("ALTER TABLE submissions ADD COLUMN student_user_id TEXT").run();
    }
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_student_user_id ON submissions(student_user_id)").run();
    const reviewTableInfo = await env.DB.prepare("PRAGMA table_info(submission_reviews)").all<{ name: string }>();
    if (!reviewTableInfo.results.some((column) => column.name === "reviewed_at")) {
      await env.DB.prepare("ALTER TABLE submission_reviews ADD COLUMN reviewed_at TEXT").run();
      await env.DB.prepare("UPDATE submission_reviews SET reviewed_at = updated_at WHERE reviewed_at IS NULL").run();
    }
    const tableInfo = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
    if (!tableInfo.results.some((column) => column.name === "avatar_url")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
    }
    if (!tableInfo.results.some((column) => column.name === "role")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN role TEXT CHECK(role IN ('student', 'teacher'))").run();
    }
  })();
  return initialization;
}
