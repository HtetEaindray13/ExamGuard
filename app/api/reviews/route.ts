import { and, eq } from "drizzle-orm";
import { getAuthUser } from "../../auth";
import { ensureDatabase, getDb } from "../../../db";
import { ensureUserProfile } from "../../../db/user-profile";
import { exams, submissionReviews, submissions } from "../../../db/schema";

const reviewDecisions = ["Valid concern", "False detection", "Technical issue", "Acceptable"] as const;
type ReviewDecision = typeof reviewDecisions[number];

type ReviewRequest = {
  submissionId?: unknown;
  decision?: unknown;
  feedback?: unknown;
  manualScore?: unknown;
};

type SubmissionPayload = { manualPointsTotal?: unknown; manualReviewCount?: unknown };

function numericValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function PUT(request: Request) {
  try {
    await ensureDatabase();
    const identity = await getAuthUser();
    if (!identity) return Response.json({ error: "Log in with a teacher account to save a review." }, { status: 401 });
    const profile = await ensureUserProfile(identity);
    if (profile.role !== "teacher") return Response.json({ error: "A teacher account is required to review submissions." }, { status: 403 });

    const body = await request.json() as ReviewRequest;
    const submissionId = typeof body.submissionId === "string" ? body.submissionId.trim() : "";
    const decision = typeof body.decision === "string" && reviewDecisions.includes(body.decision as ReviewDecision) ? body.decision as ReviewDecision : null;
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    const manualScore = numericValue(body.manualScore, -1);
    if (!submissionId || !decision) return Response.json({ error: "Choose a review decision." }, { status: 400 });
    if (feedback.length > 2000) return Response.json({ error: "Feedback must be 2,000 characters or fewer." }, { status: 400 });

    const db = getDb();
    const [record] = await db.select({ submission: submissions, teacherUserId: exams.teacherUserId })
      .from(submissions)
      .innerJoin(exams, eq(exams.studentCode, submissions.examCode))
      .where(and(eq(submissions.id, submissionId), eq(exams.teacherUserId, identity.userId)))
      .limit(1);
    if (!record) return Response.json({ error: "Submission not found or you do not own this exam." }, { status: 404 });

    let payload: SubmissionPayload = {};
    try { payload = JSON.parse(record.submission.payload) as SubmissionPayload; } catch { /* Validation below uses safe fallbacks. */ }
    const manualPointsTotal = Math.max(0, Math.round(numericValue(payload.manualPointsTotal, numericValue(payload.manualReviewCount, 0))));
    if (!Number.isInteger(manualScore) || manualScore < 0 || manualScore > manualPointsTotal) {
      return Response.json({ error: `Manual score must be a whole number from 0 to ${manualPointsTotal}.` }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.insert(submissionReviews).values({ submissionId, teacherUserId: identity.userId, decision, feedback, manualScore, createdAt: now, updatedAt: now, reviewedAt: now })
      .onConflictDoUpdate({ target: submissionReviews.submissionId, set: { teacherUserId: identity.userId, decision, feedback, manualScore, updatedAt: now, reviewedAt: now } });

    return Response.json({ review: { decision, feedback, manualScore, reviewedAt: now } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the review." }, { status: 500 });
  }
}
