import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  teacherKey: text("teacher_key").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  examCode: text("exam_code").notNull(),
  studentId: text("student_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
