import { and, desc, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from ".";
import { exams, submissionReviews, submissions } from "./schema";

export type StudentAnswerSummary = {
  prompt: string;
  student: string;
  result: "Correct" | "Incorrect" | "Not answered" | "Manual review";
  points: string;
};

export type StudentSubmissionSummary = {
  id: string;
  examCode: string;
  title: string;
  subject: string;
  submittedAt: string;
  score: number | null;
  total: number;
  manualReviewCount: number;
  manualPointsTotal: number;
  finalScore: number | null;
  finalTotal: number;
  scoreStatus: "automatic" | "pending" | "reviewed";
  reviewStatus: "Awaiting review" | "Reviewed" | "Needs follow-up";
  reviewDecision: "Valid concern" | "False detection" | "Technical issue" | "Acceptable" | null;
  teacherFeedback: string;
  reviewedAt: string | null;
  risk: "Low" | "Medium" | "High";
  answers: StudentAnswerSummary[];
};

type SubmissionPayload = {
  score?: unknown;
  total?: unknown;
  manualReviewCount?: unknown;
  manualPointsTotal?: unknown;
  risk?: unknown;
  submitted?: unknown;
  answers?: unknown;
};

type ExamPayload = { title?: unknown; subject?: unknown };

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseAnswers(value: unknown): StudentAnswerSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const item = answer as Record<string, unknown>;
    const result = item.result;
    if (result !== "Correct" && result !== "Incorrect" && result !== "Not answered" && result !== "Manual review") return [];
    return [{ prompt: textValue(item.prompt, "Question"), student: textValue(item.student, "Not answered"), result, points: textValue(item.points, "—") }];
  });
}

function toSummary(row: { id: string; examCode: string; createdAt: string; submissionPayload: string; examPayload: string | null; reviewDecision: string | null; reviewFeedback: string | null; reviewManualScore: number | null; reviewedAt: string | null }): StudentSubmissionSummary {
  let submission: SubmissionPayload = {};
  let exam: ExamPayload = {};
  try { submission = JSON.parse(row.submissionPayload) as SubmissionPayload; } catch { /* Use safe fallbacks. */ }
  try { exam = row.examPayload ? JSON.parse(row.examPayload) as ExamPayload : {}; } catch { /* Use safe fallbacks. */ }
  const risk = submission.risk === "High" || submission.risk === "Medium" ? submission.risk : "Low";
  const automaticScore = typeof submission.score === "number" && Number.isFinite(submission.score) ? submission.score : null;
  const total = numberValue(submission.total, 0);
  const manualReviewCount = numberValue(submission.manualReviewCount, 0);
  const manualPointsTotal = numberValue(submission.manualPointsTotal, manualReviewCount);
  const decision = row.reviewDecision === "Valid concern" || row.reviewDecision === "False detection" || row.reviewDecision === "Technical issue" || row.reviewDecision === "Acceptable" ? row.reviewDecision : null;
  const reviewStatus = decision === "Valid concern" ? "Needs follow-up" : decision ? "Reviewed" : "Awaiting review";
  const requiresManualMarks = manualPointsTotal > 0 || manualReviewCount > 0;
  const scoreStatus = decision ? "reviewed" : requiresManualMarks ? "pending" : "automatic";
  return {
    id: row.id,
    examCode: row.examCode,
    title: textValue(exam.title, "Untitled exam"),
    subject: textValue(exam.subject, "General"),
    submittedAt: textValue(submission.submitted, row.createdAt),
    score: automaticScore,
    total,
    manualReviewCount,
    manualPointsTotal,
    finalScore: automaticScore !== null && (decision || !requiresManualMarks) ? automaticScore + (decision ? row.reviewManualScore ?? 0 : 0) : null,
    finalTotal: total + manualPointsTotal,
    scoreStatus,
    reviewStatus,
    reviewDecision: decision,
    teacherFeedback: row.reviewFeedback ?? "",
    reviewedAt: row.reviewedAt,
    risk,
    answers: parseAnswers(submission.answers),
  };
}

const historySelection = {
  id: submissions.id,
  examCode: submissions.examCode,
  createdAt: submissions.createdAt,
  submissionPayload: submissions.payload,
  examPayload: exams.payload,
  reviewDecision: submissionReviews.decision,
  reviewFeedback: submissionReviews.feedback,
  reviewManualScore: submissionReviews.manualScore,
  reviewedAt: submissionReviews.reviewedAt,
};

export async function getStudentSubmissionHistory(studentUserId: string): Promise<StudentSubmissionSummary[]> {
  await ensureDatabase();
  const db = getDb();
  const rows = await db.select(historySelection).from(submissions).leftJoin(exams, eq(exams.studentCode, submissions.examCode)).leftJoin(submissionReviews, eq(submissionReviews.submissionId, submissions.id)).where(eq(submissions.studentUserId, studentUserId)).orderBy(desc(submissions.createdAt));
  return rows.map(toSummary);
}

export async function getStudentSubmission(studentUserId: string, submissionId: string): Promise<StudentSubmissionSummary | null> {
  await ensureDatabase();
  const db = getDb();
  const [row] = await db.select(historySelection).from(submissions).leftJoin(exams, eq(exams.studentCode, submissions.examCode)).leftJoin(submissionReviews, eq(submissionReviews.submissionId, submissions.id)).where(and(eq(submissions.studentUserId, studentUserId), eq(submissions.id, submissionId))).limit(1);
  return row ? toSummary(row) : null;
}
