import { ensureDatabase, getDb } from "../../../db";
import { submissions } from "../../../db/schema";

type Submission = { id: string; examCode?: string; studentId?: string } & Record<string, unknown>;

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const submission = await request.json() as Submission;
    const examCode = submission.examCode?.replace(/\D/g, "") ?? "";
    const studentId = submission.studentId?.trim() ?? "";
    if (!submission.id || examCode.length !== 6 || !studentId) {
      return Response.json({ error: "Invalid submission data." }, { status: 400 });
    }
    const db = getDb();
    await db.insert(submissions).values({
      id: `${submission.id}-${Date.now()}`,
      examCode,
      studentId,
      payload: JSON.stringify(submission),
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the submission." }, { status: 500 });
  }
}
