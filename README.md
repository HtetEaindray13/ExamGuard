# ExamGuard

ExamGuard is a full-stack online examination platform for creating, conducting, and reviewing monitored assessments. It gives teachers useful integrity context while keeping the final decision with a human—not an automated cheating verdict.


## What it does

### For teachers

- Create exams with multiple-choice, True/False, and word-limited short-answer questions.
- Set instructions, duration, points, and monitoring signals.
- Publish an exam with a six-digit student code and a private teacher key.
- View submissions with scores, risk priority, identity photo, answers, and an integrity timeline.
- Classify integrity events as valid concern, false detection, technical issue, or acceptable.

### For students

- Join an exam with a teacher-provided code.
- Read the monitoring notice and give consent before the device check.
- Check camera, face visibility, lighting, browser, connection, and full-screen readiness.
- Complete the exam in a focused workspace with visible progress and time remaining.
- Receive neutral guidance when the camera or browser state needs attention.
- Submit answers and receive a completion confirmation.

## Monitoring approach

Teachers can enable or disable these signals for each exam:

- Exam tab becomes hidden
- Full-screen mode is exited
- Copy or paste is attempted
- Face is absent for a sustained period
- Multiple faces are visible
- Camera stream is interrupted
- Head orientation stays outside the expected direction after a grace period

ExamGuard records explainable events with timestamps, duration, priority, source, and confidence/context. A single uncertain frame is not treated as proof. Students are informed about monitoring before the exam begins, and the final integrity classification remains a teacher decision.

The browser performs face analysis with MediaPipe assets. The application stores one identity photo and contextual event metadata; it does not store continuous video.

## Tech stack

- React 19 and TypeScript
- vinext / Next.js-style App Router
- Vite
- Cloudflare Workers
- Cloudflare D1 with Drizzle ORM
- Cloudflare R2 for identity photos
- MediaPipe Tasks Vision for face landmarks and presence checks
- Google OAuth with signed HTTP-only sessions
- CSS-based responsive UI

## Project structure

```text
app/                  Pages, layouts, dashboards, and API routes
  api/                Authentication, exams, submissions, reviews, and profile APIs
  dashboard/          Teacher and student dashboards
  login/              Google OAuth login flow
db/                   Drizzle schema and database access helpers
drizzle/              Generated SQL migrations
public/mediapipe/     Local MediaPipe WASM and face landmark model assets
worker/               Cloudflare Worker entry point
tests/                Rendered HTML smoke test
.openai/hosting.json  Cloudflare D1 and R2 binding names
```

## Requirements

- Node.js `>=22.13.0`
- npm
- A Cloudflare D1 database for account-backed persistence
- A Cloudflare R2 bucket for identity photos when running with production bindings
- Google OAuth credentials for Google login

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment variables:

   ```bash
   copy .dev.vars.example .dev.vars
   ```

   Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a long random `AUTH_SECRET` in `.dev.vars`.

3. Add this callback URL to the Google OAuth web client:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open the local URL shown by vinext. In local development, the app has a development session fallback when `AUTH_SECRET` is not configured, but Google login still requires the OAuth variables above.

## Useful commands

```bash
npm run dev          # Start the local development server
npm run build        # Build the application
npm start            # Start the built application
npm test             # Build and run the rendered HTML smoke test
npm run lint         # Run ESLint
npm run db:generate  # Generate a Drizzle migration after schema changes
```

## Cloudflare bindings

The application expects these bindings:

| Binding | Service | Purpose |
| --- | --- | --- |
| `DB` | Cloudflare D1 | Users, exams, submissions, and review records |
| `PHOTOS` | Cloudflare R2 | Identity photo storage |

They are declared in `.openai/hosting.json` for the current project. Local development uses the Vite/Cloudflare configuration in `vite.config.ts` and the Worker entry point in `worker/index.ts`.

The database schema is defined in `db/schema.ts`. Generated migrations are stored in `drizzle/`. Apply migrations using the Cloudflare/Wrangler workflow configured for your environment before relying on account-backed data.

## Authentication and roles

ExamGuard uses Google OAuth and a signed `examguard_session` cookie. After login, a user chooses a role:

- `teacher`: create exams and review submissions
- `student`: join exams and view submission history

Teacher and student dashboard routes require authentication. The private teacher key is required to reopen a published exam and should be stored securely; the current MVP does not provide key recovery.

## Data model

The main D1 tables are:

- `users`: account profile, role, student ID, and organization
- `exams`: exam access credentials, lifecycle status, and serialized exam payload
- `submissions`: student answers, score, identity photo reference, and integrity events
- `submission_reviews`: teacher integrity classification, feedback, and manual score

## Current MVP boundaries

- Students and teachers use authenticated accounts for dashboards; the exam access flow still uses a student code and teacher key.
- Multiple-choice and True/False questions are auto-graded.
- Short answers are saved for teacher review and are not fully graded automatically.
- The teacher must retain the private teacher key; there is no recovery flow yet.
- Browser and camera signals are review context, not automatic failure decisions.
- Local browser storage can supplement account-backed records when the shared database is unavailable, but publishing requires the shared database.

## Privacy and fairness principles

1. Explain monitoring before it starts.
2. Use signals to provide context, not automatic accusations.
3. Give students neutral guidance and a chance to correct their setup.
4. Keep evidence proportional: one identity photo and contextual events instead of continuous video.
5. Keep the final integrity decision with a teacher.

## License

No license has been declared for this repository yet. Add a `LICENSE` file before distributing ExamGuard publicly.
