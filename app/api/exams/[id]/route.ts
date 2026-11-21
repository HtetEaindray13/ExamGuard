import { and, eq } from "drizzle-orm";
import { getAuthUser } from "../../../auth";
import { ensureDatabase, getDb } from "../../../../db";
import { ensureUserProfile } from "../../../../db/user-profile";
import { exams, submissions } from "../../../../db/schema";

const examStatuses = ["draft", "active", "archived"] as const;
const monitoringKeys = ["tabSwitch", "fullscreen", "clipboard", "faceAbsence", "multipleFaces", "cameraStopped", "headOrientation"] as const;
type ExamStatus = typeof examStatuses[number];

type UpdateBody = { status?: unknown; exam?: unknown };
type StoredPayload = Record<string, unknown>;

class ValidationError extends Error {}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError(`${label} is required.`);
  if (value.trim().length > maxLength) throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`);
  return value.trim();
}

function validateQuestions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError("Add at least one question.");
  if (value.length > 100) throw new ValidationError("An exam can contain up to 100 questions.");
  return value.map((question, index) => {
    if (!question || typeof question !== "object") throw new ValidationError(`Question ${index + 1} is invalid.`);
    const item = question as Record<string, unknown>;
    const type = item.type === "true-false" || item.type === "short-answer" ? item.type : item.type === "multiple-choice" ? item.type : null;
    if (!type) throw new ValidationError(`Question ${index + 1} has an invalid type.`);
    const prompt = requiredText(item.prompt, `Question ${index + 1}`, 1000);
    const points = typeof item.points === "number" ? item.points : Number(item.points);
    if (!Number.isInteger(points) || points < 1 || points > 100) throw new ValidationError(`Question ${index + 1} points must be from 1 to 100.`);
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID();
    if (type === "short-answer") {
      const maxWords = typeof item.maxWords === "number" ? item.maxWords : Number(item.maxWords ?? 100);
      if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > 2000) throw new ValidationError(`Question ${index + 1} word limit must be from 1 to 2,000.`);
      return { id, type, prompt, points, maxWords, options: [], answer: "" };
    }
    if (type === "true-false") {
      const answer = item.answer === "False" ? "False" : "True";
      return { id, type, prompt, points, options: ["True", "False"], answer };
    }
    const options = Array.isArray(item.options) ? item.options.map((option) => typeof option === "string" ? option.trim() : "").filter(Boolean) : [];
    if (options.length < 2 || options.length > 4) throw new ValidationError(`Question ${index + 1} needs 2 to 4 answer options.`);
    const answer = typeof item.answer === "string" ? item.answer : "A";
    const answerIndex = answer.charCodeAt(0) - 65;
    if (answerIndex < 0 || answerIndex >= options.length) throw new ValidationError(`Choose a correct answer for question ${index + 1}.`);
    return { id, type, prompt, points, options, answer };
  });
}

function validateMonitoring(value: unknown) {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(monitoringKeys.map((key) => [key, typeof item[key] === "boolean" ? item[key] : true]));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase();
    const identity = await getAuthUser();
    if (!identity) return Response.json({ error: "Log in with a teacher account to update this exam." }, { status: 401 });
    const profile = await ensureUserProfile(identity);
    if (profile.role !== "teacher") return Response.json({ error: "A teacher account is required to update exams." }, { status: 403 });
    const { id } = await params;
    const db = getDb();
    const [row] = await db.select().from(exams).where(and(eq(exams.id, id), eq(exams.teacherUserId, identity.userId))).limit(1);
    if (!row) return Response.json({ error: "Exam not found or you do not own it." }, { status: 404 });
    const body = await request.json() as UpdateBody;
    const submissionRows = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.examCode, row.studentCode)).limit(1);
    let stored: StoredPayload = {};
    try { stored = JSON.parse(row.payload) as StoredPayload; } catch { /* Keep immutable database fields below. */ }

    if (body.exam !== undefined) {
      if (row.status === "archived") return Response.json({ error: "Restore this exam before editing it." }, { status: 409 });
      if (submissionRows.length) return Response.json({ error: "Exam content cannot be edited after a student has submitted." }, { status: 409 });
      if (!body.exam || typeof body.exam !== "object") return Response.json({ error: "Invalid exam data." }, { status: 400 });
      const input = body.exam as Record<string, unknown>;
      const title = requiredText(input.title, "Exam title", 120);
      const subject = requiredText(input.subject, "Subject", 80);
      const instructions = typeof input.instructions === "string" ? input.instructions.trim().slice(0, 2000) : "";
      const durationNumber = Number(input.duration);
      if (!Number.isInteger(durationNumber) || durationNumber < 1 || durationNumber > 480) return Response.json({ error: "Duration must be from 1 to 480 minutes." }, { status: 400 });
      const questions = validateQuestions(input.questions);
      const monitoring = validateMonitoring(input.monitoring);
      stored = { ...stored, title, subject, instructions, duration: String(durationNumber), questions, monitoring, status: row.status };
      await db.update(exams).set({ payload: JSON.stringify(stored) }).where(eq(exams.id, row.id));
      return Response.json({ exam: { ...stored, id: row.id, studentCode: row.studentCode, status: row.status } });
    }

    const nextStatus = typeof body.status === "string" && examStatuses.includes(body.status as ExamStatus) ? body.status as ExamStatus : null;
    if (!nextStatus) return Response.json({ error: "Choose a valid exam status." }, { status: 400 });
    if (nextStatus === "draft" && submissionRows.length) return Response.json({ error: "An exam with submissions cannot be returned to draft." }, { status: 409 });
    stored = { ...stored, status: nextStatus };
    await db.update(exams).set({ status: nextStatus, payload: JSON.stringify(stored) }).where(eq(exams.id, row.id));
    return Response.json({ status: nextStatus });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update the exam." }, { status: error instanceof ValidationError ? 400 : 500 });
  }
}
