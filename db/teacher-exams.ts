import { and, desc, eq, inArray } from "drizzle-orm";
import { ensureDatabase, getDb } from ".";
import { exams, submissions } from "./schema";

export type TeacherExamSummary = {
  id: string;
  title: string;
  subject: string;
  studentCode: string;
  createdAt: string;
  submissionCount: number;
  status: "draft" | "active" | "archived";
};

export type TeacherExamQuestion = {
  id: string;
  type: "multiple-choice" | "true-false" | "short-answer";
  prompt: string;
  options: string[];
  answer: string;
  points: number;
  maxWords?: number;
};

export type TeacherExamMonitoring = {
  tabSwitch: boolean;
  fullscreen: boolean;
  clipboard: boolean;
  faceAbsence: boolean;
  multipleFaces: boolean;
  cameraStopped: boolean;
  headOrientation: boolean;
};

export type TeacherExamDetail = TeacherExamSummary & {
  instructions: string;
  duration: string;
  questions: TeacherExamQuestion[];
  monitoring: TeacherExamMonitoring;
};

type ExamPayload = { title?: unknown; subject?: unknown; instructions?: unknown; duration?: unknown; questions?: unknown; monitoring?: unknown };

const defaultMonitoring: TeacherExamMonitoring = { tabSwitch: true, fullscreen: true, clipboard: true, faceAbsence: true, multipleFaces: true, cameraStopped: true, headOrientation: true };

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseQuestions(value: unknown): TeacherExamQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((question, index) => {
    if (!question || typeof question !== "object") return [];
    const item = question as Record<string, unknown>;
    const type = item.type === "true-false" || item.type === "short-answer" ? item.type : "multiple-choice";
    return [{
      id: textValue(item.id, `question-${index + 1}`),
      type,
      prompt: textValue(item.prompt, "Untitled question"),
      options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : [],
      answer: typeof item.answer === "string" ? item.answer : "",
      points: typeof item.points === "number" && Number.isFinite(item.points) ? Math.max(1, Math.round(item.points)) : 1,
      maxWords: typeof item.maxWords === "number" && Number.isFinite(item.maxWords) ? Math.max(1, Math.round(item.maxWords)) : undefined,
    }];
  });
}

function parseMonitoring(value: unknown): TeacherExamMonitoring {
  if (!value || typeof value !== "object") return defaultMonitoring;
  const item = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(defaultMonitoring).map(([key, fallback]) => [key, typeof item[key] === "boolean" ? item[key] : fallback])) as TeacherExamMonitoring;
}

export async function getTeacherExamHistory(teacherUserId: string): Promise<TeacherExamSummary[]> {
  await ensureDatabase();
  const db = getDb();
  const rows = await db.select().from(exams).where(eq(exams.teacherUserId, teacherUserId)).orderBy(desc(exams.createdAt));
  if (!rows.length) return [];

  const codes = rows.map((row) => row.studentCode);
  const submissionRows = await db.select({ examCode: submissions.examCode }).from(submissions).where(inArray(submissions.examCode, codes));
  const counts = new Map<string, number>();
  for (const row of submissionRows) counts.set(row.examCode, (counts.get(row.examCode) ?? 0) + 1);

  return rows.map((row) => {
    let payload: ExamPayload = {};
    try { payload = JSON.parse(row.payload) as ExamPayload; } catch { /* Keep database fallbacks for malformed legacy payloads. */ }
    return {
      id: row.id,
      title: textValue(payload.title, "Untitled exam"),
      subject: textValue(payload.subject, "General"),
      studentCode: row.studentCode,
      createdAt: row.createdAt,
      submissionCount: counts.get(row.studentCode) ?? 0,
      status: row.status,
    };
  });
}

export async function getTeacherExam(teacherUserId: string, examId: string): Promise<TeacherExamDetail | null> {
  await ensureDatabase();
  const db = getDb();
  const [row] = await db.select().from(exams).where(and(eq(exams.id, examId), eq(exams.teacherUserId, teacherUserId))).limit(1);
  if (!row) return null;
  const submissionRows = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.examCode, row.studentCode));
  let payload: ExamPayload = {};
  try { payload = JSON.parse(row.payload) as ExamPayload; } catch { /* Use safe fallbacks for malformed legacy payloads. */ }
  return {
    id: row.id,
    title: textValue(payload.title, "Untitled exam"),
    subject: textValue(payload.subject, "General"),
    instructions: typeof payload.instructions === "string" ? payload.instructions : "",
    duration: textValue(payload.duration, "45"),
    questions: parseQuestions(payload.questions),
    monitoring: parseMonitoring(payload.monitoring),
    studentCode: row.studentCode,
    createdAt: row.createdAt,
    submissionCount: submissionRows.length,
    status: row.status,
  };
}
