"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TeacherExamDetail, TeacherExamQuestion } from "../../../../../db/teacher-exams";

type ExamStatus = TeacherExamDetail["status"];

function newQuestion(): TeacherExamQuestion {
  return { id: crypto.randomUUID(), type: "multiple-choice", prompt: "", options: ["", ""], answer: "A", points: 1 };
}

function statusLabel(status: ExamStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ExamManager({ initialExam }: { initialExam: TeacherExamDetail }) {
  const [exam, setExam] = useState(initialExam);
  const [draft, setDraft] = useState(initialExam);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [archiveDialog, setArchiveDialog] = useState(false);
  const archiveCancelRef = useRef<HTMLButtonElement>(null);
  const editable = exam.submissionCount === 0 && exam.status !== "archived";

  useEffect(() => {
    if (archiveDialog) archiveCancelRef.current?.focus();
  }, [archiveDialog]);

  function updateQuestion(index: number, changes: Partial<TeacherExamQuestion>) {
    setDraft((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question) }));
  }

  function changeQuestionType(index: number, type: TeacherExamQuestion["type"]) {
    if (type === "true-false") updateQuestion(index, { type, options: ["True", "False"], answer: "True", maxWords: undefined });
    else if (type === "short-answer") updateQuestion(index, { type, options: [], answer: "", maxWords: 100 });
    else updateQuestion(index, { type, options: ["", ""], answer: "A", maxWords: undefined });
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const options = [...draft.questions[questionIndex].options];
    options[optionIndex] = value;
    updateQuestion(questionIndex, { options });
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    const question = draft.questions[questionIndex];
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, index) => index !== optionIndex);
    const answerIndex = Math.min(question.answer.charCodeAt(0) - 65, options.length - 1);
    updateQuestion(questionIndex, { options, answer: String.fromCharCode(65 + Math.max(0, answerIndex)) });
  }

  async function saveExam() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exams/${encodeURIComponent(exam.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ exam: draft }) });
      const result = await response.json() as { exam?: TeacherExamDetail; error?: string };
      if (!response.ok || !result.exam) throw new Error(result.error || "The exam could not be saved.");
      const updated = { ...draft, ...result.exam, submissionCount: exam.submissionCount };
      setExam(updated);
      setDraft(updated);
      setEditing(false);
      setNotice("Exam changes saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The exam could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: ExamStatus) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exams/${encodeURIComponent(exam.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json() as { status?: ExamStatus; error?: string };
      if (!response.ok || !result.status) throw new Error(result.error || "The exam status could not be updated.");
      setExam((current) => ({ ...current, status: result.status! }));
      setDraft((current) => ({ ...current, status: result.status! }));
      setEditing(false);
      setArchiveDialog(false);
      setNotice(status === "archived" ? "Exam archived. Students can no longer join it." : status === "active" ? "Exam activated and ready for students." : "Exam moved to drafts.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The exam status could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="examManagerShell">
    <Link className="resultBack" href="/dashboard/teacher"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg> Back to exams</Link>
    <div className="examManagerHero">
      <div><span className="dashboardEyebrow">Exam details</span><div className="examTitleLine"><h1>{exam.title}</h1><span className={`examStatus ${exam.status}`}>{statusLabel(exam.status)}</span></div><p>{exam.subject} · Code {exam.studentCode} · {exam.submissionCount} submission{exam.submissionCount === 1 ? "" : "s"}</p></div>
      <div className="examManagerActions">
        <Link href={`/?teacherAction=manage&code=${encodeURIComponent(exam.studentCode)}`}>Review submissions</Link>
        {editable && !editing && <button type="button" className="primary" onClick={() => { setDraft(exam); setEditing(true); setNotice(""); setError(""); }}>Edit exam</button>}
      </div>
    </div>

    {exam.submissionCount > 0 && <div className="examLockNotice"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span><strong>Exam content is locked</strong>Questions and settings cannot be edited because students have already submitted. You can still review submissions or archive the exam.</span></div>}
    {exam.status === "archived" && <div className="examLockNotice archived"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg><span><strong>This exam is archived</strong>Students cannot join it. Restore it to active status before making other changes.</span></div>}
    {error && <div className="managerMessage error" role="alert">{error}</div>}
    {notice && <div className="managerMessage success" role="status">{notice}</div>}

    <div className="examManagerGrid">
      <section className="examEditorCard" aria-labelledby="exam-content-title">
        <div className="managerSectionHeading"><div><span className="dashboardEyebrow">Content</span><h2 id="exam-content-title">Exam setup</h2></div>{editing && <span>Editing</span>}</div>
        <fieldset disabled={!editing || saving}>
          <div className="examFieldGrid"><label htmlFor="manager-title">Exam title<input id="manager-title" value={draft.title} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label htmlFor="manager-subject">Subject<input id="manager-subject" value={draft.subject} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} /></label></div>
          <div className="examFieldGrid"><label htmlFor="manager-duration">Duration in minutes<input id="manager-duration" type="number" min="1" max="480" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} /></label><label htmlFor="manager-code">Student code<input id="manager-code" value={draft.studentCode} readOnly /></label></div>
          <label htmlFor="manager-instructions">Instructions<textarea id="manager-instructions" rows={4} maxLength={2000} value={draft.instructions} onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))} /></label>
        </fieldset>
      </section>

      <aside className="examStatusCard" aria-labelledby="exam-status-title"><span className="dashboardEyebrow">Availability</span><h2 id="exam-status-title">Exam status</h2><p>{exam.status === "active" ? "Students with the exam code can join now." : exam.status === "draft" ? "Only you can access this exam while it is in draft." : "The exam remains in your history but is closed to students."}</p><div className="statusActions">
        {exam.status === "draft" && <button type="button" className="primary" disabled={saving} onClick={() => void updateStatus("active")}>Activate exam</button>}
        {exam.status === "active" && exam.submissionCount === 0 && <button type="button" disabled={saving} onClick={() => void updateStatus("draft")}>Move to draft</button>}
        {exam.status !== "archived" ? <button type="button" className="danger" disabled={saving} onClick={() => setArchiveDialog(true)}>Archive exam</button> : <button type="button" className="primary" disabled={saving} onClick={() => void updateStatus("active")}>Restore as active</button>}
      </div></aside>
    </div>

    <section className="examEditorCard questionManager" aria-labelledby="question-manager-title">
      <div className="managerSectionHeading"><div><span className="dashboardEyebrow">Questions</span><h2 id="question-manager-title">{draft.questions.length} question{draft.questions.length === 1 ? "" : "s"}</h2></div>{editing && <button type="button" onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, newQuestion()] }))}>Add question</button>}</div>
      <fieldset disabled={!editing || saving} className="managerQuestions">
        {draft.questions.map((question, index) => <article key={question.id} className="managerQuestion">
          <div className="managerQuestionTop"><strong>Question {index + 1}</strong>{editing && draft.questions.length > 1 && <button type="button" onClick={() => setDraft((current) => ({ ...current, questions: current.questions.filter((_, questionIndex) => questionIndex !== index) }))}>Remove</button>}</div>
          <div className="examFieldGrid"><label htmlFor={`question-type-${question.id}`}>Type<select id={`question-type-${question.id}`} value={question.type} onChange={(event) => changeQuestionType(index, event.target.value as TeacherExamQuestion["type"])}><option value="multiple-choice">Multiple choice</option><option value="true-false">True or false</option><option value="short-answer">Short answer</option></select></label><label htmlFor={`question-points-${question.id}`}>Points<input id={`question-points-${question.id}`} type="number" min="1" max="100" value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} /></label></div>
          <label htmlFor={`question-prompt-${question.id}`}>Question prompt<textarea id={`question-prompt-${question.id}`} rows={3} maxLength={1000} value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} /></label>
          {question.type === "multiple-choice" && <div className="managerOptions"><span>Answer options</span>{question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`}><label htmlFor={`option-${question.id}-${optionIndex}`}><span>{String.fromCharCode(65 + optionIndex)}</span><input id={`option-${question.id}-${optionIndex}`} value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} /></label>{editing && question.options.length > 2 && <button type="button" aria-label={`Remove option ${String.fromCharCode(65 + optionIndex)}`} onClick={() => removeOption(index, optionIndex)}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>}</div>)}{editing && question.options.length < 4 && <button type="button" onClick={() => updateQuestion(index, { options: [...question.options, ""] })}>Add option</button>}<label htmlFor={`correct-${question.id}`}>Correct answer<select id={`correct-${question.id}`} value={question.answer} onChange={(event) => updateQuestion(index, { answer: event.target.value })}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={String.fromCharCode(65 + optionIndex)}>Option {String.fromCharCode(65 + optionIndex)}</option>)}</select></label></div>}
          {question.type === "true-false" && <label htmlFor={`correct-${question.id}`}>Correct answer<select id={`correct-${question.id}`} value={question.answer} onChange={(event) => updateQuestion(index, { answer: event.target.value })}><option>True</option><option>False</option></select></label>}
          {question.type === "short-answer" && <label htmlFor={`words-${question.id}`}>Maximum words<input id={`words-${question.id}`} type="number" min="1" max="2000" value={question.maxWords ?? 100} onChange={(event) => updateQuestion(index, { maxWords: Number(event.target.value) })} /></label>}
        </article>)}
      </fieldset>
    </section>

    <section className="examEditorCard monitoringManager" aria-labelledby="monitoring-title"><div className="managerSectionHeading"><div><span className="dashboardEyebrow">Integrity</span><h2 id="monitoring-title">Monitoring settings</h2></div></div><fieldset disabled={!editing || saving}>{Object.entries(draft.monitoring).map(([key, enabled]) => <label key={key}><input type="checkbox" checked={enabled} onChange={(event) => setDraft((current) => ({ ...current, monitoring: { ...current.monitoring, [key]: event.target.checked } }))} /><span>{({ tabSwitch: "Tab switching", fullscreen: "Fullscreen exits", clipboard: "Clipboard activity", faceAbsence: "Face absence", multipleFaces: "Multiple faces", cameraStopped: "Camera interruptions", headOrientation: "Head orientation" } as Record<string, string>)[key]}</span></label>)}</fieldset></section>

    {editing && <div className="managerSaveBar"><span>Review your changes before saving.</span><div><button type="button" disabled={saving} onClick={() => { setDraft(exam); setEditing(false); setError(""); }}>Cancel</button><button type="button" className="primary" disabled={saving} onClick={() => void saveExam()}>{saving ? "Saving…" : "Save changes"}</button></div></div>}

    {archiveDialog && <div className="archiveOverlay" role="presentation" onKeyDown={(event) => { if (event.key === "Escape" && !saving) setArchiveDialog(false); }} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setArchiveDialog(false); }}><section role="dialog" aria-modal="true" aria-labelledby="archive-title" aria-describedby="archive-description"><span className="archiveIcon"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg></span><h2 id="archive-title">Archive this exam?</h2><p id="archive-description">Students will no longer be able to join with code <strong>{exam.studentCode}</strong>. Existing submissions and reviews will remain available.</p><div><button ref={archiveCancelRef} type="button" disabled={saving} onClick={() => setArchiveDialog(false)}>Cancel</button><button type="button" className="danger" disabled={saving} onClick={() => void updateStatus("archived")}>{saving ? "Archiving…" : "Archive exam"}</button></div></section></div>}
  </section>;
}
