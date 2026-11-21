import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  teacherKey: text("teacher_key").notNull(),
  teacherUserId: text("teacher_user_id"),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("active"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_exams_teacher_user_id").on(table.teacherUserId)]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  examCode: text("exam_code").notNull(),
  studentId: text("student_id").notNull(),
  studentUserId: text("student_user_id"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_submissions_student_user_id").on(table.studentUserId)]);

export const submissionReviews = sqliteTable("submission_reviews", {
  submissionId: text("submission_id").primaryKey(),
  teacherUserId: text("teacher_user_id").notNull(),
  decision: text("decision", { enum: ["Valid concern", "False detection", "Technical issue", "Acceptable"] }).notNull(),
  feedback: text("feedback").notNull().default(""),
  manualScore: integer("manual_score").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_submission_reviews_teacher_user_id").on(table.teacherUserId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["student", "teacher"] }),
  studentId: text("student_id"),
  organization: text("organization"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
