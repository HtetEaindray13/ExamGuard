# ExamGuard User Journey

## 1. Product purpose

ExamGuard helps teachers create and conduct monitored online exams while keeping the final integrity decision with a human. Students receive clear notice of what is monitored, complete a device check, take the exam in a focused workspace, and submit their answers. Teachers then review scores, short-answer responses, identity photos, and contextual integrity signals together.

The core journey is:

**Teacher creates exam → shares access code → student joins and consents → device is checked → student takes exam → ExamGuard records explainable signals → student submits → teacher reviews and classifies the attempt.**

---

## 2. Primary users

### Teacher / exam creator

- **Goal:** Create a fair online assessment, distribute it quickly, and review submissions efficiently.
- **Needs:** Simple exam setup, control over monitoring, secure access to results, clear risk prioritization, and enough context to make a human decision.
- **Concerns:** False accusations, missing evidence, difficult grading, losing access credentials, and spending too long reviewing every attempt.

### Student / exam taker

- **Goal:** Join the correct exam, understand the rules, complete it without technical disruption, and submit successfully.
- **Needs:** A low-friction entry path, transparent monitoring notice, actionable device guidance, automatic answer saving, visible time and progress, and confirmation that the submission was received.
- **Concerns:** Privacy, camera permissions, false flags, connection or browser problems, unanswered questions, and uncertainty after submission.

### Platform administrator (secondary user)

- **Goal:** Inspect production records and remove invalid or unwanted exam and submission data.
- **Needs:** Authentication, database status, record counts, refresh controls, and explicit confirmation before deletion.

---

## 3. Teacher journey: create, conduct, and review

| Stage | Teacher goal | Actions and touchpoints | System response | Likely feeling | Friction / opportunity |
|---|---|---|---|---|---|
| 1. Discover | Decide whether ExamGuard suits the assessment | Opens the landing page; reads how creation, monitoring, privacy, and human review work | Explains that signals provide context rather than an automatic cheating verdict | Curious, cautiously optimistic | Add a sample report and a concise data-retention statement to strengthen trust |
| 2. Start creation | Begin a new assessment | Selects **Create** or **Create new exam** | Opens the four-step exam builder | Focused | The draft lasts only for the current session; clearly warn before closing or leaving |
| 3. Add exam details | Define student expectations | Enters title, subject, duration, and optional instructions | Validates that title and subject are present; shows instructions to students before monitoring setup | In control | Autosave drafts and show persistent save status |
| 4. Build questions | Create and organize the assessment | Adds multiple-choice, True/False, or word-limited short-answer questions; sets points and correct answers; reorders or deletes questions | Prevents an empty question prompt and keeps at least one question | Productive | Validate empty answer options and missing correct answers before publishing |
| 5. Configure monitoring | Choose proportionate integrity signals | Enables or disables tab/window exit, full-screen exit, copy/paste, face absence, multiple faces, head orientation, and camera interruption | Explains each signal and emphasizes that one uncertain event is not proof | Responsible, reassured | Show the student-facing notice as a live preview and explain thresholds beside each setting |
| 6. Preview and publish | Verify the exam and make it available | Reviews title, duration, questions, points, grading method, and enabled signals; selects **Publish exam** | Saves the exam and generates a six-digit student code plus a private teacher key | Accomplished, alert | The key cannot be recovered without an account; offer download/print, copy confirmation, and a deliberate acknowledgement |
| 7. Distribute access | Get students into the correct exam | Shares the student code or student link; securely stores the private teacher key | Students can retrieve only the public exam data; the teacher key remains private | Ready | Add a share sheet, QR code, scheduled availability, and a copyable student instruction block |
| 8. Return to manage | Access the correct exam later | Selects **Manage**, enters the exam code and private teacher key | Verifies the pair and opens the teacher dashboard with matching submissions | Intent, possibly anxious | Provide clearer recovery guidance when the key is lost or invalid |
| 9. Triage submissions | Find attempts that need attention | Reviews student count, submitted count, average score, and needs-review count; filters by Low/Medium/High priority and sorts submissions | Combines score, status, event count, and risk priority in one table | Oriented, efficient | Clarify that priority is based on the highest recorded signal; add search and filters for status/review state |
| 10. Review an attempt | Understand the full context | Opens a submission; checks identity photo, objective answers, short answers, score, and the timestamped integrity timeline | Shows event type, duration, source, confidence/context, and whether manual marking is required | Analytical, careful | Let teachers add marks for short answers inside ExamGuard and show related events as grouped episodes |
| 11. Make a human decision | Record a fair outcome | Chooses **Valid concern**, **False detection**, **Technical issue**, **Acceptable**, or **Unreviewed**; adds a private note; saves | Marks the submission as reviewed and stores the review for the session | Decisive, accountable | Persist reviews to the shared database, add reviewer/time audit history, and clearly distinguish integrity classification from academic grading |
| 12. Continue or finish | Complete the review workload | Returns to all submissions, reviews remaining priority attempts, exits, or creates another exam | Retains the dashboard context for the current session | Satisfied | Add review progress, bulk export, and a clear “all priority attempts reviewed” completion state |

### Teacher happy path

1. Open ExamGuard and select **Create**.
2. Enter the exam title, subject, duration, and instructions.
3. Add questions, points, options, and correct answers.
4. Choose the monitoring signals appropriate for the assessment.
5. Preview and publish the exam.
6. Copy and share the six-digit student code; privately save the teacher key.
7. After students submit, select **Manage** and enter both credentials.
8. Filter the dashboard to higher-priority attempts first.
9. Review answers, identity photo, and the integrity-event timeline in context.
10. Record a classification and private note, then continue until the review queue is complete.

---

## 4. Student journey: join, prepare, take, and submit

| Stage | Student goal | Actions and touchpoints | System response | Likely feeling | Friction / opportunity |
|---|---|---|---|---|---|
| 1. Receive access | Know where and how to begin | Receives the six-digit exam code or link from the teacher | Provides a no-account entry path | Ready, slightly nervous | Include the expected browser, camera requirement, and preparation checklist in the teacher’s share message |
| 2. Find the exam | Open the correct assessment | Enters the six-digit code on the landing page and selects the join arrow | Validates the code and loads the public exam details; gives a clear error if it cannot be found | Hopeful or frustrated if invalid | Preserve the entered code, allow paste/auto-advance, and provide a direct route for code-based links |
| 3. Identify the attempt | Associate work with the correct student | Reviews exam title, subject, duration, and instructions; enters full name and student ID | Requires both fields before continuing | Oriented | Explain the required student-ID format and check for accidental duplicate attempts |
| 4. Understand monitoring | Make an informed choice | Reads the notice covering browser events, one identity photo, head-direction grace period when enabled, minimal evidence, and teacher review; checks consent | Prevents progress until consent is given | Cautious, then reassured | Link to retention/deletion details and clearly explain what happens if the student declines |
| 5. Prepare the device | Avoid technical issues during the exam | Allows camera access and runs the device check while facing the camera and holding still | Checks camera stream, stable identity photo, face/framing, lighting, browser, connection, and full-screen readiness; gives retry guidance | Anxious, then confident | Some checks currently resolve optimistically; use real connection/full-screen/browser diagnostics and offer a support route |
| 6. Start the exam | Enter a focused, ready state | Selects **Start exam** after every device check passes | Opens the exam workspace, starts the countdown, resets the answer state, and activates monitoring | Focused | Request full-screen explicitly at this transition and warn before accidental exit |
| 7. Answer questions | Complete work accurately | Selects MCQ/True-False answers or writes a word-limited short answer; moves with Previous/Next or the question navigator; marks questions for review | Saves answers in the current session, shows answered progress and word count, and distinguishes manual-review responses | Concentrated | Add durable autosave/recovery, a final unanswered/marked summary, and keyboard shortcuts |
| 8. Respond to guidance | Correct behavior before it becomes a review signal | Watches camera/status guidance and returns to the expected exam state when warned | Gives a ten-second head-orientation grace countdown; records sustained face absence, multiple faces, tab hiding, copy/paste, full-screen exit, or camera interruption as contextual events | Briefly concerned but informed | Use calm, non-accusatory wording; show recovery success and avoid repeated duplicate alerts for one episode |
| 9. Manage time and progress | Finish before time expires | Monitors time remaining, answered count, progress ring, and marked questions | Highlights urgent time below five minutes and automatically submits when time reaches zero | Focused, increasingly urgent | Add timed warnings and announce automatic submission accessibly |
| 10. Review and submit | Avoid accidental incomplete submission | Selects **Submit exam** and reviews the confirmation showing answered versus total questions | Offers **Keep reviewing** or **Submit now** | Careful, relieved | Include the specific unanswered and marked question numbers in the confirmation |
| 11. Receive confirmation | Know the attempt is safely finished | Confirms submission or reaches the time limit | Saves the attempt, auto-grades objective questions, queues short answers and signals for teacher review, and shows a receipt with answered count and event count | Relieved | Display a receipt/reference ID, distinguish local from server-confirmed save, and offer a downloadable receipt |
| 12. Leave | End the session confidently | Selects **Return home** | Returns to the landing page | Finished | Stop camera tracks immediately and clearly state that monitoring has ended |

### Student happy path

1. Receive the exam code from the teacher.
2. Enter the code and open the exam.
3. Confirm the exam details and provide full name and student ID.
4. Read and accept the monitoring notice.
5. Allow camera access and pass the device check.
6. Start the exam and answer questions while watching time and progress.
7. Correct position or browser state if ExamGuard displays guidance.
8. Review unanswered or marked questions.
9. Submit and wait for the submission receipt.
10. Return home knowing that the teacher—not the software—makes the final integrity decision.

---

## 5. Key recovery and exception journeys

### Invalid or unavailable exam code

1. Student enters fewer than six digits or an unknown code.
2. ExamGuard keeps the student on the landing page and explains what is wrong.
3. Student corrects the code or requests a new code from the teacher.

### Camera denied, unsupported, or blurry

1. The device check cannot access the camera or capture a stable identity photo.
2. ExamGuard explains how to allow permission, recommends a supported browser, or asks the student to improve framing and hold still.
3. Student retries the check.
4. The exam remains unavailable until all required checks pass.

### Monitoring event during the exam

1. The browser or camera detects a configured condition.
2. ExamGuard gives the student visible, neutral guidance where correction is possible.
3. A sustained or browser-reported event is added to the timeline with time, duration, level, source, and context.
4. The student continues the exam; the software does not automatically fail or accuse them.
5. The teacher later classifies the event after reviewing the full attempt.

### Time expires

1. The countdown reaches zero.
2. ExamGuard automatically saves and submits the current answers and timeline.
3. The student receives the completion screen without needing another action.

### Invalid teacher credentials

1. Teacher enters an exam code and private teacher key.
2. ExamGuard rejects a missing or incorrect pair and leaves the dashboard closed.
3. Teacher checks the saved credentials and retries.
4. If the private key was lost, the current prototype has no recovery path.

### Shared database unavailable

- Student exam lookup may fall back to an exam stored in the same browser session.
- Publishing does not complete unless the exam reaches the shared database.
- Student submission is stored locally first and then sent to the server, but the receipt does not currently distinguish local storage from confirmed server persistence.

---

## 6. Experience principles

1. **Human judgment over automatic accusation.** Every signal is review context, never a final verdict.
2. **Transparency before monitoring.** Students see what is collected and must consent before the device check.
3. **Correction before escalation.** When possible, students receive calm guidance and a grace period before a signal is recorded.
4. **Minimal evidence.** Store one identity photo and event metadata rather than continuous video.
5. **Review by priority, decide with context.** Risk levels help teachers triage; answers, timing, identity, and event details support the decision.
6. **Clear completion states.** Both publishing and submission end with unambiguous access details or receipts.

---

## 7. Recommended success metrics

### Teacher funnel

- Exam creation completion rate
- Median time from **Create** to **Publish**
- Publish failure rate
- Percentage of teachers who securely copy/save the private key
- Time from first submission to completed review
- Percentage of non-low-risk attempts given a human classification

### Student funnel

- Code-entry success rate
- Drop-off by onboarding step
- Camera permission denial and device-check retry rates
- Median time to complete device setup
- Exam completion and automatic-timeout rates
- Submission persistence success rate

### Fairness and trust

- Percentage of signals classified as false detections or technical issues
- Signal rate by browser/device type
- Average number of repeated signals per incident
- Student support requests related to monitoring or privacy
- Teacher agreement between initial risk priority and final human classification

---

## 8. Current MVP boundaries

- Students and regular teachers do not need accounts.
- The teacher must retain the private key; it is not recoverable through the current interface.
- Multiple-choice and True/False questions are auto-graded.
- Short answers are saved for review, but teachers return their marks outside ExamGuard.
- Teacher review decisions and notes are currently stored for the browser session rather than as a shared audit record.
- The platform stores one identity photo with the server submission and contextual event metadata; it does not store continuous video.
- Database administration is a separate authenticated journey for viewing and deleting exam and submission records.
