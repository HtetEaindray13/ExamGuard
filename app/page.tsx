"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    eye: <><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.2" /></>,
    tab: <><rect x="3" y="4" width="18" height="15" rx="2" /><path d="M3 8h18M8 4v4" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.2 2.5-5 6-5s5.4 1.8 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.3.3 3.7 1.9 4 4" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 16 .5 1.5L21 18l-1.5.5L19 20l-.5-1.5L17 18l1.5-.5L19 16Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems = [["How it works", "how-it-works"], ["Detection", "detection"], ["Trust & privacy", "trust"]];

type QuestionType = "multiple-choice" | "true-false";
type ExamQuestion = { id: string; type: QuestionType; prompt: string; options: string[]; answer: string; points: number };
type MonitoringSettings = { tabSwitch: boolean; fullscreen: boolean; clipboard: boolean; faceAbsence: boolean; multipleFaces: boolean; cameraStopped: boolean; headOrientation: boolean };
type StoredExam = { id: string; title: string; subject: string; instructions: string; duration: string; questions: ExamQuestion[]; monitoring: MonitoringSettings; studentCode: string; teacherKey: string; createdAt: string };
type RiskLevel = "Low" | "Medium" | "High";
type RiskFilter = "All" | RiskLevel;
type SortMode = "priority" | "latest";
type ReviewDecision = "Unreviewed" | "Valid concern" | "False detection" | "Technical issue" | "Acceptable";
type HeadDirection = "center" | "left" | "right" | "up" | "down";
type HeadPose = { yaw: number; pitch: number };
type DetectorFrame = { faces: unknown[]; pose: HeadPose | null; confidence: number };
type IntegrityEvent = { type?: string; label: string; detail: string; time: string; duration: string; level: RiskLevel; icon: string; confidence?: number; source?: "Browser" | "Camera" | "Demo"; direction?: Exclude<HeadDirection, "center">; startTime?: string; endTime?: string };
type FaceDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectorFrame>; close?: () => void };
type NativeFaceDetectorLike = { detect: (source: HTMLVideoElement) => Promise<unknown[]>; close?: () => void };
type FaceDetectorConstructor = new (options?: { maxDetectedFaces?: number; fastMode?: boolean }) => NativeFaceDetectorLike;
type Submission = {
  id: string;
  examCode?: string;
  studentId?: string;
  name: string;
  initials: string;
  status: "Submitted" | "In progress";
  score: number | null;
  total: number;
  events: number;
  risk: RiskLevel;
  submitted: string;
  duration: string;
  answers: { prompt: string; student: string; correct: string; result: "Correct" | "Incorrect" | "Not answered"; points: string }[];
  timeline: IntegrityEvent[];
};

const EXAMS_STORAGE_KEY = "examguard:exams";
const SUBMISSIONS_STORAGE_KEY = "examguard:submissions";
const REVIEWS_STORAGE_KEY = "examguard:reviews";
const LOCAL_MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";
const LOCAL_FACE_LANDMARKER_MODEL_PATH = "/mediapipe/models/face_landmarker.task";
const CDN_MEDIAPIPE_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const CDN_FACE_LANDMARKER_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HEAD_ORIENTATION_GRACE_MS = 20_000;

function readHeadPose(data?: number[]): HeadPose | null {
  if (!data || data.length < 11) return null;
  const yaw = Math.atan2(data[2], data[10]) * (180 / Math.PI);
  const pitch = Math.atan2(-data[6], Math.sqrt((data[2] ** 2) + (data[10] ** 2))) * (180 / Math.PI);
  return { yaw, pitch };
}

function classifyHeadDirection(pose: HeadPose, baseline: HeadPose): HeadDirection {
  const yaw = pose.yaw - baseline.yaw;
  const pitch = pose.pitch - baseline.pitch;
  const yawMagnitude = Math.abs(yaw);
  const pitchMagnitude = Math.abs(pitch);
  if (Math.max(yawMagnitude, pitchMagnitude) < 18) return "center";
  if (yawMagnitude >= pitchMagnitude) return yaw > 0 ? "right" : "left";
  // MediaPipe's transformation matrix uses the opposite vertical sign from
  // the direction a person experiences on screen: positive relative pitch
  // means the face has moved upward (the student is looking up).
  return pitch > 0 ? "up" : "down";
}

function formatHeadDirection(direction: HeadDirection): string {
  return direction === "center" ? "facing the camera" : `turned ${direction}`;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is optional for this no-account prototype.
  }
}

function makeIntegrityEvent(type: string, detail: string, overrides: Partial<IntegrityEvent> = {}): IntegrityEvent {
  const presets: Record<string, Pick<IntegrityEvent, "label" | "level" | "icon" | "confidence" | "source" | "duration">> = {
    "tab-hidden": { label: "Tab hidden", level: "Medium", icon: "tab", confidence: 94, source: "Browser", duration: "Recorded" },
    "fullscreen-exit": { label: "Full-screen exited", level: "Medium", icon: "eye", confidence: 91, source: "Browser", duration: "Recorded" },
    "copy-paste": { label: "Copy or paste attempt", level: "Low", icon: "chart", confidence: 98, source: "Browser", duration: "Recorded" },
    "camera-stopped": { label: "Camera interrupted", level: "High", icon: "lock", confidence: 99, source: "Camera", duration: "Until recovered" },
    "face-absent": { label: "Face absent", level: "Medium", icon: "eye", confidence: 85, source: "Camera", duration: "3+ seconds" },
    "multiple-faces": { label: "Multiple faces", level: "High", icon: "people", confidence: 90, source: "Camera", duration: "2+ seconds" },
    "head-turned": { label: "Head orientation", level: "Medium", icon: "eye", confidence: 82, source: "Camera", duration: "20+ seconds" },
    "demo-face-absent": { label: "Face absence (demo)", level: "High", icon: "eye", confidence: 86, source: "Demo", duration: "12 seconds" },
    "demo-multiple-faces": { label: "Multiple faces (demo)", level: "High", icon: "people", confidence: 89, source: "Demo", duration: "6 seconds" },
    "demo-camera-interruption": { label: "Camera interruption (demo)", level: "High", icon: "lock", confidence: 96, source: "Demo", duration: "8 seconds" },
  };
  const preset = presets[type] ?? { label: "Monitoring signal", level: "Low" as RiskLevel, icon: "shield", confidence: 70, source: "Browser" as const, duration: "Recorded" };
  return { type, detail, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }), ...preset, ...overrides };
}

const demoSubmissions: Submission[] = [
  {
    id: "alice-carter", name: "Alice Carter", initials: "AC", status: "Submitted", score: 18, total: 20, events: 1, risk: "Low", submitted: "Today, 10:52 AM", duration: "29m 14s",
    answers: [
      { prompt: "Which browser API reports when an exam page becomes hidden?", student: "Page Visibility API", correct: "Page Visibility API", result: "Correct", points: "1 / 1" },
      { prompt: "A single camera frame is proof that a student cheated.", student: "False", correct: "False", result: "Correct", points: "1 / 1" },
      { prompt: "What should happen before an event becomes high risk?", student: "It should persist and be reviewed with context", correct: "It should persist and be reviewed with context", result: "Correct", points: "1 / 1" },
    ],
    timeline: [{ label: "Tab briefly hidden", detail: "Browser focus changed while the exam was open.", time: "10:31:15 AM", duration: "2 seconds", level: "Low", icon: "tab" }],
  },
  {
    id: "john-lee", name: "John Lee", initials: "JL", status: "Submitted", score: 14, total: 20, events: 5, risk: "Medium", submitted: "Today, 10:47 AM", duration: "31m 08s",
    answers: [
      { prompt: "Which browser API reports when an exam page becomes hidden?", student: "Canvas API", correct: "Page Visibility API", result: "Incorrect", points: "0 / 1" },
      { prompt: "A single camera frame is proof that a student cheated.", student: "False", correct: "False", result: "Correct", points: "1 / 1" },
      { prompt: "What should happen before an event becomes high risk?", student: "It should be detected once", correct: "It should persist and be reviewed with context", result: "Incorrect", points: "0 / 1" },
    ],
    timeline: [
      { label: "Tab hidden", detail: "Exam page was not visible in the browser.", time: "10:28:04 AM", duration: "9 seconds", level: "Medium", icon: "tab" },
      { label: "Multiple faces detected", detail: "More than one face persisted in frame.", time: "10:42:09 AM", duration: "4 seconds", level: "Medium", icon: "people" },
      { label: "Copy attempt", detail: "Browser reported a copy action.", time: "10:43:26 AM", duration: "1 second", level: "Low", icon: "chart" },
      { label: "Head turned right", detail: "The student looked away for the full 20-second grace period.", time: "10:44:10 AM", duration: "20 seconds", level: "Medium", icon: "eye", confidence: 82, source: "Camera", direction: "right", startTime: "10:44:10 AM", endTime: "10:44:30 AM" },
      { label: "Camera briefly interrupted", detail: "The stream paused and recovered.", time: "10:45:02 AM", duration: "8 seconds", level: "High", icon: "lock" },
    ],
  },
  {
    id: "mary-wilson", name: "Mary Wilson", initials: "MW", status: "In progress", score: null, total: 20, events: 6, risk: "High", submitted: "Started 14m ago", duration: "14m 36s",
    answers: [
      { prompt: "Which browser API reports when an exam page becomes hidden?", student: "Page Visibility API", correct: "Page Visibility API", result: "Correct", points: "1 / 1" },
      { prompt: "A single camera frame is proof that a student cheated.", student: "Not answered", correct: "False", result: "Not answered", points: "—" },
      { prompt: "What should happen before an event becomes high risk?", student: "Not answered", correct: "It should persist and be reviewed with context", result: "Not answered", points: "—" },
    ],
    timeline: [
      { label: "Face absent", detail: "No face was visible for a sustained period.", time: "10:39:18 AM", duration: "22 seconds", level: "High", icon: "eye" },
      { label: "Full-screen exited", detail: "Student left the focused exam view.", time: "10:40:02 AM", duration: "11 seconds", level: "Medium", icon: "tab" },
      { label: "Camera interrupted", detail: "Camera stream is currently unavailable.", time: "10:41:29 AM", duration: "1m 04s", level: "High", icon: "lock" },
    ],
  },
];

function newQuestion(type: QuestionType = "multiple-choice"): ExamQuestion {
  return type === "true-false"
    ? { id: `q-${Date.now()}-${Math.random()}`, type, prompt: "", options: ["True", "False"], answer: "True", points: 1 }
    : { id: `q-${Date.now()}-${Math.random()}`, type, prompt: "", options: ["", "", ""], answer: "A", points: 1 };
}

const demoExamQuestions: ExamQuestion[] = [
  { id: "demo-1", type: "multiple-choice", prompt: "Which browser API reports when an exam page becomes hidden?", options: ["Page Visibility API", "Canvas API", "History API", "Web Audio API"], answer: "A", points: 1 },
  { id: "demo-2", type: "true-false", prompt: "A single camera frame should be treated as proof that a student cheated.", options: ["True", "False"], answer: "False", points: 1 },
  { id: "demo-3", type: "multiple-choice", prompt: "What should happen before an integrity event becomes high risk?", options: ["It should persist and be reviewed with context", "It should be detected once", "It should be hidden from the teacher", "It should automatically fail the student"], answer: "A", points: 1 },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"create" | "manage" | null>(null);
  const [examCode, setExamCode] = useState("");
  const [studentNotice, setStudentNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardNotice, setWizardNotice] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [instructions, setInstructions] = useState("");
  const [duration, setDuration] = useState("45");
  const [questions, setQuestions] = useState<ExamQuestion[]>([newQuestion()]);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [monitoring, setMonitoring] = useState<MonitoringSettings>({ tabSwitch: true, fullscreen: true, clipboard: true, faceAbsence: true, multipleFaces: true, cameraStopped: true, headOrientation: true });
  const [publishedExam, setPublishedExam] = useState<{ studentCode: string; teacherKey: string } | null>(null);
  const [studentExam, setStudentExam] = useState<StoredExam | null>(null);
  const [teacherExam, setTeacherExam] = useState<StoredExam | null>(null);
  const [realSubmissions, setRealSubmissions] = useState<Submission[]>(() => readLocal<Submission[]>(SUBMISSIONS_STORAGE_KEY, []));
  const [manageExamCode, setManageExamCode] = useState("");
  const [manageTeacherKey, setManageTeacherKey] = useState("");
  const [manageError, setManageError] = useState("");
  const [studentFlow, setStudentFlow] = useState(false);
  const [studentStep, setStudentStep] = useState(0);
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentConsent, setStudentConsent] = useState(false);
  const [deviceChecking, setDeviceChecking] = useState(false);
  const [deviceChecks, setDeviceChecks] = useState({ camera: false, face: false, lighting: false, browser: false, connection: false, fullscreen: false });
  const [cameraStatus, setCameraStatus] = useState<"idle" | "checking" | "ready" | "blocked" | "unsupported">("idle");
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [faceStatus, setFaceStatus] = useState<"idle" | "checking" | "ready" | "absent" | "multiple" | "orientation" | "unsupported">("idle");
  const [faceMessage, setFaceMessage] = useState("");
  const [orientationDirection, setOrientationDirection] = useState<HeadDirection>("center");
  const [orientationCountdown, setOrientationCountdown] = useState<number | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const faceStateRef = useRef<{ kind: "ready" | "absent" | "multiple"; since: number; alerted: boolean }>({ kind: "ready", since: 0, alerted: false });
  const orientationBaselineRef = useRef<HeadPose | null>(null);
  const orientationStateRef = useRef<{ direction: Exclude<HeadDirection, "center"> | null; since: number; alerted: boolean; confidence: number }>({ direction: null, since: 0, alerted: false, confidence: 0 });
  const [examWorkspace, setExamWorkspace] = useState(false);
  const [examQuestionIndex, setExamQuestionIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examMarked, setExamMarked] = useState<Record<string, boolean>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState(45 * 60);
  const [examWarning, setExamWarning] = useState("");
  const [examEventCount, setExamEventCount] = useState(0);
  const [examEvents, setExamEvents] = useState<Submission["timeline"]>([]);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [teacherDashboard, setTeacherDashboard] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [dashboardRiskFilter, setDashboardRiskFilter] = useState<RiskFilter>("All");
  const [dashboardSort, setDashboardSort] = useState<SortMode>("priority");
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("Unreviewed");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewRecords, setReviewRecords] = useState<Record<string, { decision: ReviewDecision; note: string }>>(() => readLocal<Record<string, { decision: ReviewDecision; note: string }>>(REVIEWS_STORAGE_KEY, {}));
  const [reviewNotice, setReviewNotice] = useState("");
  const submissionSavedRef = useRef(false);

  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      revealItems.forEach((item) => item.classList.add("isRevealed"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("isRevealed", entry.isIntersecting);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -7% 0px" });

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const storedQuestions = studentExam?.questions.filter((question) => question.prompt.trim()) ?? [];
  const draftQuestions = questions.filter((question) => question.prompt.trim());
  const examQuestions = storedQuestions.length ? storedQuestions : draftQuestions.length ? draftQuestions : demoExamQuestions;
  const currentExamQuestion = examQuestions[examQuestionIndex] ?? examQuestions[0] ?? demoExamQuestions[0];
  const dashboardSubmissions = teacherExam ? realSubmissions.filter((submission) => submission.examCode === teacherExam.studentCode) : demoSubmissions;
  const dashboardSubmittedCount = dashboardSubmissions.filter((submission) => submission.status === "Submitted").length;
  const dashboardActiveCount = dashboardSubmissions.filter((submission) => submission.status === "In progress").length;
  const dashboardAverage = dashboardSubmittedCount ? Math.round(dashboardSubmissions.filter((submission) => submission.score !== null).reduce((sum, submission) => sum + ((submission.score ?? 0) / submission.total) * 100, 0) / dashboardSubmittedCount) : 0;
  const filteredDashboardSubmissions = [...dashboardSubmissions].filter((submission) => dashboardRiskFilter === "All" || submission.risk === dashboardRiskFilter).sort((first, second) => dashboardSort === "priority" ? ({ High: 0, Medium: 1, Low: 2 }[first.risk] - { High: 0, Medium: 1, Low: 2 }[second.risk]) || second.events - first.events : second.events - first.events);
  const dashboardEventTotal = dashboardSubmissions.reduce((sum, submission) => sum + submission.timeline.length, 0);
  const dashboardHighEvents = dashboardSubmissions.reduce((sum, submission) => sum + submission.timeline.filter((event) => event.level === "High").length, 0);
  const dashboardConfidence = dashboardEventTotal ? Math.round(dashboardSubmissions.reduce((sum, submission) => sum + submission.timeline.reduce((eventSum, event) => eventSum + (event.confidence ?? 0), 0), 0) / dashboardEventTotal) : 0;

  function formatExamTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  const buildStudentSubmission = useCallback((): Submission => {
    const total = examQuestions.reduce((sum, question) => sum + question.points, 0);
    const score = examQuestions.reduce((sum, question) => sum + (examAnswers[question.id] === question.answer ? question.points : 0), 0);
    const answers = examQuestions.map((question) => {
      const studentValue = examAnswers[question.id];
      const correctValue = question.answer;
      const displayAnswer = (value: string) => {
        if (!value) return "Not answered";
        if (question.type === "true-false") return value;
        const optionIndex = value.charCodeAt(0) - 65;
        return `${value}. ${question.options[optionIndex] || value}`;
      };
      const result: "Correct" | "Incorrect" | "Not answered" = !studentValue ? "Not answered" : studentValue === correctValue ? "Correct" : "Incorrect";
      return { prompt: question.prompt, student: displayAnswer(studentValue), correct: displayAnswer(correctValue), result, points: result === "Correct" ? `${question.points} / ${question.points}` : result === "Not answered" ? "—" : `0 / ${question.points}` };
    });
    const initials = studentName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
    const risk: RiskLevel = examEvents.some((event) => event.level === "High") ? "High" : examEvents.some((event) => event.level === "Medium") ? "Medium" : "Low";
    return { id: `${examCode}-${studentId.trim()}`, examCode, studentId, name: studentName.trim() || "Student", initials, status: "Submitted", score, total, events: examEvents.length, risk, submitted: "Just now", duration: formatExamTime(Math.max(0, (Math.max(1, Number(studentExam?.duration || duration) || 45) * 60) - examSecondsLeft)), answers, timeline: examEvents };
  }, [examQuestions, examAnswers, studentName, examEvents, examCode, studentId, studentExam?.duration, duration, examSecondsLeft]);

  const saveStudentSubmission = useCallback(() => {
    if (submissionSavedRef.current) return;
    const submission = buildStudentSubmission();
    const stored = readLocal<Submission[]>(SUBMISSIONS_STORAGE_KEY, []);
    writeLocal(SUBMISSIONS_STORAGE_KEY, [...stored, submission]);
    setRealSubmissions((current) => [...current, submission]);
    void fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
    }).catch(() => undefined);
    submissionSavedRef.current = true;
  }, [buildStudentSubmission]);

  const recordIntegrityEvent = useCallback((event: IntegrityEvent) => {
    setExamWarning(`${event.label}: ${event.detail}`);
    setExamEventCount((current) => current + 1);
    setExamEvents((current) => [...current, event]);
  }, []);


  useEffect(() => {
    if (!examWorkspace || examSubmitted) return;
    const timer = window.setInterval(() => setExamSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [examWorkspace, examSubmitted]);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      void video.play().catch(() => undefined);
    }
  }, [cameraStream, studentFlow, examWorkspace]);

  useEffect(() => {
    const detectionActive = Boolean(cameraStream) && (studentFlow || (examWorkspace && !examSubmitted));
    if (!detectionActive) {
      faceDetectorRef.current = null;
      faceStateRef.current = { kind: "ready", since: 0, alerted: false };
      orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
      return;
    }
    let cancelled = false;
    let checking = false;
    let detector: FaceDetectorLike | null = null;
    let interval: number | null = null;
    const inspectFrame = async () => {
      const video = cameraVideoRef.current;
      if (cancelled || checking || !detector || !video || video.readyState < 2) return;
      checking = true;
      try {
        const frame = await detector.detect(video);
        const faces = frame.faces;
        if (cancelled) return;
        const kind: "ready" | "absent" | "multiple" = faces.length === 0 ? "absent" : faces.length > 1 ? "multiple" : "ready";
        const now = performance.now();
        if (kind === "ready") {
          faceStateRef.current = { kind, since: now, alerted: false };
          if (frame.pose && !orientationBaselineRef.current) orientationBaselineRef.current = frame.pose;
          const orientationEnabled = studentExam?.monitoring?.headOrientation !== false;
          const orientationActive = examWorkspace && !examSubmitted && orientationEnabled && frame.pose;
          if (orientationActive) {
            const baseline = orientationBaselineRef.current ?? frame.pose;
            const direction = classifyHeadDirection(frame.pose, baseline);
            if (direction === "center") {
              orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
              setOrientationDirection("center");
              setOrientationCountdown(null);
              setFaceStatus("ready");
              setFaceMessage("One face detected. Analysis stays on this device.");
              return;
            }
            if (orientationStateRef.current.direction !== direction) {
              orientationStateRef.current = { direction, since: now, alerted: false, confidence: frame.confidence || 82 };
            }
            const elapsed = now - orientationStateRef.current.since;
            const remaining = Math.max(0, Math.ceil((HEAD_ORIENTATION_GRACE_MS - elapsed) / 1000));
            setOrientationDirection(direction);
            setOrientationCountdown(remaining || null);
            setFaceStatus("orientation");
            if (orientationStateRef.current.alerted) {
              setFaceMessage(`Head ${formatHeadDirection(direction)} recorded for teacher review.`);
            } else {
              setFaceMessage(`Please face the camera. ${remaining} seconds before a review signal.`);
            }
            if (elapsed >= HEAD_ORIENTATION_GRACE_MS && !orientationStateRef.current.alerted) {
              const startTimestamp = Date.now() - Math.round(elapsed);
              const startTime = new Date(startTimestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
              const endTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
              recordIntegrityEvent(makeIntegrityEvent("head-turned", `The student looked ${direction} for at least 20 seconds. Review the complete session context before deciding.`, {
                label: `Head turned ${direction}`,
                duration: `${Math.max(20, Math.round(elapsed / 1000))} seconds`,
                confidence: Math.round(orientationStateRef.current.confidence || frame.confidence || 82),
                direction,
                startTime,
                endTime,
              }));
              orientationStateRef.current.alerted = true;
              setOrientationCountdown(null);
            }
          } else {
            orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
            setOrientationDirection("center");
            setOrientationCountdown(null);
            setFaceStatus("ready");
            setFaceMessage("One face detected. Analysis stays on this device.");
          }
          return;
        }
        orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
        setOrientationDirection("center");
        setOrientationCountdown(null);
        if (faceStateRef.current.kind !== kind) faceStateRef.current = { kind, since: now, alerted: false };
        const threshold = kind === "absent" ? 3000 : 2000;
        const sustained = now - faceStateRef.current.since >= threshold;
        setFaceStatus(kind);
        setFaceMessage(kind === "absent" ? "Please stay centered in the camera frame." : "Only one student should be visible in the camera frame.");
        if (sustained && !faceStateRef.current.alerted) {
          const detail = kind === "absent" ? "No face was visible for at least 3 seconds. Please review the student context." : "More than one face was visible for at least 2 seconds. Please review the student context.";
          recordIntegrityEvent(makeIntegrityEvent(kind === "absent" ? "face-absent" : "multiple-faces", detail));
          faceStateRef.current.alerted = true;
        }
      } catch {
        if (!cancelled) {
          setFaceStatus("unsupported");
          setFaceMessage("Face analysis is unavailable in this browser. Camera status will still be monitored.");
        }
      } finally {
        checking = false;
      }
    };
    const startDetector = async () => {
      setFaceStatus("checking");
      setFaceMessage("Loading local camera analysis…");
      const createMediaPipeDetector = async (wasmPath: string, modelPath: string): Promise<FaceDetectorLike> => {
        const { FaceLandmarker: MediaPipeFaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        const mediaPipeLandmarker = await MediaPipeFaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath },
          runningMode: "VIDEO",
          numFaces: 4,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFacialTransformationMatrixes: true,
        });
        return {
          detect: async (video) => {
            const result = mediaPipeLandmarker.detectForVideo(video, performance.now());
            return { faces: result.faceLandmarks, pose: readHeadPose(result.facialTransformationMatrixes?.[0]?.data), confidence: 82 };
          },
          close: () => mediaPipeLandmarker.close(),
        };
      };
      try {
        detector = await createMediaPipeDetector(LOCAL_MEDIAPIPE_WASM_PATH, LOCAL_FACE_LANDMARKER_MODEL_PATH);
      } catch {
        setFaceMessage("Local analysis unavailable. Connecting to the camera analysis service…");
        try {
          detector = await createMediaPipeDetector(CDN_MEDIAPIPE_WASM_PATH, CDN_FACE_LANDMARKER_MODEL_PATH);
        } catch {
          const NativeDetector = (window as Window & { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
          if (NativeDetector) {
            const nativeDetector = new NativeDetector({ maxDetectedFaces: 4, fastMode: true });
            detector = { detect: async (video) => ({ faces: await nativeDetector.detect(video), pose: null, confidence: 0 }), close: () => nativeDetector.close?.() };
          }
        }
      }
      if (cancelled || !detector) {
        if (!cancelled) {
          setFaceStatus("unsupported");
          setFaceMessage("Face analysis is unavailable in this browser. Camera status will still be monitored.");
        }
        return;
      }
      faceDetectorRef.current = detector;
      interval = window.setInterval(() => { void inspectFrame(); }, 800);
      void inspectFrame();
    };
    void startDetector();
    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
      detector?.close?.();
      if (faceDetectorRef.current === detector) faceDetectorRef.current = null;
    };
  }, [cameraStream, examSubmitted, examWorkspace, recordIntegrityEvent, studentFlow, studentExam?.monitoring?.headOrientation]);

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => {
    if (examWorkspace && !examSubmitted && examSecondsLeft === 0) {
      const submitTimer = window.setTimeout(() => {
        saveStudentSubmission();
        setExamSubmitted(true);
        setSubmitConfirm(false);
        setOrientationDirection("center");
        setOrientationCountdown(null);
      }, 0);
      return () => window.clearTimeout(submitTimer);
    }
  }, [examSecondsLeft, examSubmitted, examWorkspace, saveStudentSubmission]);

  useEffect(() => {
    if (!examWorkspace || examSubmitted || !cameraStream) return;
    const handleCameraInactive = () => recordIntegrityEvent(makeIntegrityEvent("camera-stopped", "The camera stream ended or became unavailable."));
    cameraStream.addEventListener("inactive", handleCameraInactive);
    return () => cameraStream.removeEventListener("inactive", handleCameraInactive);
  }, [cameraStream, examSubmitted, examWorkspace, recordIntegrityEvent]);

  useEffect(() => {
    if (!examWorkspace || examSubmitted) return;
    const handleVisibility = () => { if (document.hidden) recordIntegrityEvent(makeIntegrityEvent("tab-hidden", "The exam page was hidden. Review duration and context before deciding.")); };
    const handleCopy = () => recordIntegrityEvent(makeIntegrityEvent("copy-paste", "The browser reported a copy or paste attempt. The student could continue the exam."));
    const handleFullscreen = () => { if (!document.fullscreenElement) recordIntegrityEvent(makeIntegrityEvent("fullscreen-exit", "The student left full-screen mode while the exam was active.")); };
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handleCopy);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handleCopy);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, [examWorkspace, examSubmitted, recordIntegrityEvent]);

  async function joinExam() {
    if (examCode.replace(/\D/g, "").length !== 6) {
      setStudentNotice("Enter the six-digit code provided by your teacher.");
      return;
    }
    let storedExam = readLocal<Record<string, StoredExam>>(EXAMS_STORAGE_KEY, {})[examCode];
    try {
      const response = await fetch(`/api/exams?code=${encodeURIComponent(examCode)}`);
      const result = await response.json() as { exam?: StoredExam; error?: string };
      if (response.ok && result.exam) storedExam = result.exam;
      else if (!storedExam) {
        setStudentNotice(result.error || "We could not find that exam.");
        return;
      }
    } catch {
      if (!storedExam) {
        setStudentNotice("The exam database is temporarily unavailable.");
        return;
      }
    }
    setStudentExam(storedExam ?? null);
    setStudentNotice("");
    setStudentFlow(true);
    setStudentStep(0);
    setStudentName("");
    setStudentId("");
    setStudentConsent(false);
    setDeviceChecking(false);
    setDeviceChecks({ camera: false, face: false, lighting: false, browser: false, connection: false, fullscreen: false });
    orientationBaselineRef.current = null;
    orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
    setOrientationDirection("center");
    setOrientationCountdown(null);
  }

  function nextStudentStep() {
    if (studentStep === 0 && (!studentName.trim() || !studentId.trim())) {
      setStudentNotice("Enter your full name and student ID to continue.");
      return;
    }
    if (studentStep === 1 && !studentConsent) {
      setStudentNotice("Please read and accept the monitoring notice before continuing.");
      return;
    }
    if (studentStep === 2 && !Object.values(deviceChecks).every(Boolean)) {
      setStudentNotice("Run the device check and complete every item before starting.");
      return;
    }
    setStudentNotice("");
    setStudentStep((current) => Math.min(2, current + 1));
  }

  async function requestCamera() {
    setCameraStatus("checking");
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      setCameraError("Camera access is not available in this browser. Try the latest Chrome, Edge, or Safari.");
      return false;
    }
    if (cameraStream) {
      setCameraStatus("ready");
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCameraStream(stream);
      setCameraStatus("ready");
      return true;
    } catch {
      setCameraStatus("blocked");
      setCameraError("Allow camera access in your browser, then run the check again. Your camera is not recorded continuously.");
      return false;
    }
  }

  async function runDeviceCheck() {
    if (deviceChecking) return;
    setDeviceChecking(true);
    setStudentNotice("");
    const cameraReady = await requestCamera();
    window.setTimeout(() => {
      setDeviceChecks({ camera: cameraReady, face: cameraReady, lighting: cameraReady, browser: true, connection: true, fullscreen: true });
      setDeviceChecking(false);
    }, 900);
  }

  function finishStudentFlow() {
    startExamWorkspace();
  }

  function startExamWorkspace() {
    setStudentFlow(false);
    setExamWorkspace(true);
    setExamQuestionIndex(0);
    setExamAnswers({});
    setExamMarked({});
    setExamSecondsLeft(Math.max(1, Number(studentExam?.duration || duration) || 45) * 60);
    setExamWarning("");
    setExamEventCount(0);
    setExamEvents([]);
    setSubmitConfirm(false);
    setExamSubmitted(false);
    submissionSavedRef.current = false;
    orientationStateRef.current = { direction: null, since: 0, alerted: false, confidence: 0 };
    setOrientationDirection("center");
    setOrientationCountdown(null);
  }

  function chooseExamAnswer(answer: string) {
    setExamAnswers((current) => ({ ...current, [currentExamQuestion.id]: answer }));
    setExamWarning("");
  }

  function toggleExamMark() {
    setExamMarked((current) => ({ ...current, [currentExamQuestion.id]: !current[currentExamQuestion.id] }));
  }

  function submitExam() {
    saveStudentSubmission();
    setExamSubmitted(true);
    setSubmitConfirm(false);
    setExamWarning("");
    setOrientationDirection("center");
    setOrientationCountdown(null);
  }

  function closeMenu() { setMenuOpen(false); }

  async function openTeacherDashboard() {
    const code = manageExamCode.replace(/\D/g, "");
    const key = manageTeacherKey.trim();
    if (code && key) {
      try {
        const response = await fetch(`/api/exams?code=${encodeURIComponent(code)}`, { headers: { "x-teacher-key": key } });
        const result = await response.json() as { exam?: StoredExam; submissions?: Submission[]; error?: string };
        if (!response.ok || !result.exam) {
          const localExam = readLocal<Record<string, StoredExam>>(EXAMS_STORAGE_KEY, {})[code];
          if (!localExam || localExam.teacherKey !== key) {
            setManageError(result.error || "We could not find that exam and teacher key.");
            return;
          }
          setTeacherExam(localExam);
        } else {
          setTeacherExam(result.exam);
          setRealSubmissions(result.submissions ?? []);
        }
      } catch {
        setManageError("The exam database is temporarily unavailable.");
        return;
      }
    } else {
      setTeacherExam(null);
    }
    setManageError("");
    setModal(null);
    setTeacherDashboard(true);
    setSelectedSubmissionId(null);
    setReviewNotice("");
  }

  function openSubmission(id: string) {
    const record = reviewRecords[id];
    setSelectedSubmissionId(id);
    setReviewDecision(record?.decision ?? "Unreviewed");
    setReviewNote(record?.note ?? "");
    setReviewNotice("");
  }

  function saveReview() {
    if (!selectedSubmissionId) return;
    const nextRecords = { ...reviewRecords, [selectedSubmissionId]: { decision: reviewDecision, note: reviewNote } };
    setReviewRecords(nextRecords);
    writeLocal(REVIEWS_STORAGE_KEY, nextRecords);
    setReviewNotice("Review saved for this session.");
  }

  function startCreateWizard() {
    setModal("create");
    setWizardStep(0);
    setWizardNotice("");
    setPublishedExam(null);
    setExamTitle("");
    setSubject("");
    setInstructions("");
    setDuration("45");
    setQuestions([newQuestion()]);
    setActiveQuestion(0);
    setMonitoring({ tabSwitch: true, fullscreen: true, clipboard: true, faceAbsence: true, multipleFaces: true, cameraStopped: true, headOrientation: true });
    setStudentExam(null);
  }

  function updateQuestion(id: string, changes: Partial<ExamQuestion>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...changes } : question));
  }

  function changeQuestionType(type: QuestionType) {
    const question = questions[activeQuestion];
    if (!question) return;
    updateQuestion(question.id, type === "true-false" ? { type, options: ["True", "False"], answer: "True" } : { type, options: ["", "", ""], answer: "A" });
  }

  function addQuestion(type: QuestionType = "multiple-choice") {
    const nextQuestion = newQuestion(type);
    setQuestions((current) => [...current, nextQuestion]);
    setActiveQuestion(questions.length);
    setWizardNotice("");
  }

  function removeQuestion() {
    if (questions.length === 1) {
      setWizardNotice("Keep at least one question in your exam.");
      return;
    }
    setQuestions((current) => current.filter((_, index) => index !== activeQuestion));
    setActiveQuestion((current) => Math.max(0, current - 1));
  }

  function moveQuestion(direction: -1 | 1) {
    const target = activeQuestion + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[activeQuestion], next[target]] = [next[target], next[activeQuestion]];
      return next;
    });
    setActiveQuestion(target);
  }

  function nextWizardStep() {
    if (wizardStep === 0 && (!examTitle.trim() || !subject.trim())) {
      setWizardNotice("Add an exam title and subject before continuing.");
      return;
    }
    if (wizardStep === 1 && questions.some((question) => !question.prompt.trim())) {
      setWizardNotice("Add question text before continuing.");
      return;
    }
    setWizardNotice("");
    setWizardStep((current) => Math.min(3, current + 1));
  }

  async function publishExam() {
    const studentCode = String(Math.floor(100000 + Math.random() * 900000));
    const teacherKey = `K${Math.floor(10 + Math.random() * 90)}P${Math.floor(10 + Math.random() * 90)}-X${Math.floor(10 + Math.random() * 90)}RM`;
    const storedExam: StoredExam = { id: `exam-${Date.now()}`, title: examTitle.trim() || "Untitled exam", subject: subject.trim() || "General", instructions: instructions.trim(), duration, questions: questions.map((question) => ({ ...question, options: [...question.options] })), monitoring: { ...monitoring }, studentCode, teacherKey, createdAt: new Date().toISOString() };
    const exams = readLocal<Record<string, StoredExam>>(EXAMS_STORAGE_KEY, {});
    writeLocal(EXAMS_STORAGE_KEY, { ...exams, [studentCode]: storedExam });
    try {
      const response = await fetch("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(storedExam) });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        setWizardNotice(result.error || "The exam could not be saved to the shared database.");
        return;
      }
    } catch {
      setWizardNotice("The shared database is unavailable. Please try publishing again.");
      return;
    }
    setTeacherExam(storedExam);
    setPublishedExam({ studentCode, teacherKey });
    setWizardNotice("");
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`${label}: ${value}`);
    }
  }

  function addOption() {
    const question = questions[activeQuestion];
    if (!question || question.type !== "multiple-choice" || question.options.length >= 4) return;
    updateQuestion(question.id, { options: [...question.options, ""] });
  }

  function removeOption(index: number) {
    const question = questions[activeQuestion];
    if (!question || question.type !== "multiple-choice" || question.options.length <= 2) return;
    const options = question.options.filter((_, optionIndex) => optionIndex !== index);
    const removedLetter = String.fromCharCode(65 + index);
    updateQuestion(question.id, { options, answer: question.answer === removedLetter ? "A" : question.answer });
  }

  function toggleMonitoring(key: keyof MonitoringSettings) {
    setMonitoring((current) => ({ ...current, [key]: !current[key] }));
  }

  const currentQuestion = questions[activeQuestion] ?? questions[0] ?? newQuestion();
  const selectedSubmission = dashboardSubmissions.find((submission) => submission.id === selectedSubmissionId) ?? null;
  const reviewedCount = Object.values(reviewRecords).filter((record) => record.decision !== "Unreviewed").length;
  const needsReviewCount = dashboardSubmissions.filter((submission) => submission.risk !== "Low" && !reviewRecords[submission.id]).length;

  return (
    <main className="homePage">
      <header className="homeHeader">
        <a className="homeLogo" href="#top" aria-label="ExamGuard home"><span className="wordmarkText"><span className="wordmarkExam">EXAM</span><span className="wordmarkGuard">GUARD</span></span></a>
        <nav className={`homeNav ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
          {navItems.map(([label, href]) => <a key={href} href={`#${href}`} onClick={closeMenu}>{label}</a>)}
          <button className="mobileAction" onClick={() => { setModal("manage"); closeMenu(); }}>Manage existing exam</button>
          <button className="mobileAction mobilePrimary" onClick={() => { startCreateWizard(); closeMenu(); }}>Create new exam</button>
        </nav>
        <div className="homeActions"><button className="headerLink" onClick={() => setModal("manage")}>Manage</button><button className="headerButton" onClick={startCreateWizard}>Create</button></div>
        <button className="menuButton" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}><Icon name={menuOpen ? "close" : "menu"} size={21} /></button>
      </header>

      {teacherDashboard && (
        <div className="teacherDashboardBackdrop" role="presentation">
          <section className="teacherDashboard" role="dialog" aria-modal="true" aria-labelledby="teacher-dashboard-title">
            <header className="teacherDashboardHeader">
              <a className="dashboardBrand" href="#top" onClick={() => setTeacherDashboard(false)} aria-label="Exit teacher dashboard"><span>EXAM</span>GUARD</a>
              <div className="dashboardHeaderCopy"><span>Teacher review</span><strong id="teacher-dashboard-title">{teacherExam?.title || "Web Development Fundamentals"}</strong></div>
              <div className="dashboardHeaderActions"><span className="dashboardSession"><Icon name="lock" size={13} /> Demo session</span><button type="button" className="dashboardExit" onClick={() => setTeacherDashboard(false)}>Exit <Icon name="close" size={14} /></button></div>
            </header>
            {!selectedSubmission ? <main className="dashboardMain">
              <div className="dashboardIntro"><div><span className="sectionKicker">Exam overview</span><h1>Review with context.</h1><p>Scores and integrity signals are kept together so you can make the final call.</p></div><div className="dashboardIntroActions"><button type="button" className="dashboardSecondary" onClick={() => setTeacherDashboard(false)}>Back to home</button><button type="button" className="dashboardPrimary" onClick={startCreateWizard}>Create another exam <Icon name="arrow" size={14} /></button></div></div>
              <div className="dashboardStats"><article><span className="dashboardStatIcon blue"><Icon name="people" size={17} /></span><div><strong>{dashboardSubmissions.length}</strong><small>{teacherExam ? "Students joined" : "Demo students"}</small></div></article><article><span className="dashboardStatIcon green"><Icon name="check" size={17} /></span><div><strong>{dashboardSubmittedCount}</strong><small>Submitted</small></div></article><article><span className="dashboardStatIcon gold"><Icon name="chart" size={17} /></span><div><strong>{dashboardAverage ? `${dashboardAverage}%` : "—"}</strong><small>Average score</small></div></article><article><span className="dashboardStatIcon rose"><Icon name="shield" size={17} /></span><div><strong>{needsReviewCount}</strong><small>{dashboardActiveCount ? `${dashboardActiveCount} active · ` : ""}Need review</small></div></article></div>
              <div className="dashboardSignalStrip"><div><span className="dashboardSignalIcon"><Icon name="shield" size={15} /></span><span><strong>{dashboardEventTotal} integrity signals</strong><small>{dashboardHighEvents} high-priority · {dashboardConfidence ? `${dashboardConfidence}% average confidence` : "Confidence appears after events are recorded"}</small></span></div><span className="signalStripNote">Evidence over verdicts</span></div>
              <section className="submissionSection"><div className="dashboardSectionHeading"><div><span className="sectionKicker">Student submissions</span><h2>One place for every answer.</h2></div><span className="dashboardReviewCount">{reviewedCount} reviewed this session</span></div><div className="dashboardFilters"><div className="filterGroup" role="group" aria-label="Filter by priority"><span>Show</span>{(["All", "High", "Medium", "Low"] as RiskFilter[]).map((filter) => <button type="button" key={filter} className={dashboardRiskFilter === filter ? "active" : ""} onClick={() => setDashboardRiskFilter(filter)}>{filter}</button>)}</div><label className="sortControl">Sort by<select value={dashboardSort} onChange={(event) => setDashboardSort(event.target.value as SortMode)}><option value="priority">Priority</option><option value="latest">Most signals</option></select></label></div>{dashboardSubmissions.length ? filteredDashboardSubmissions.length ? <div className="submissionTable" role="table" aria-label="Student submissions"><div className="submissionTableHead" role="row"><span>Student</span><span>Status</span><span>Score</span><span>Signals</span><span>Priority</span><span /></div>{filteredDashboardSubmissions.map((submission) => { const record = reviewRecords[submission.id]; return <div className="submissionRow" role="row" key={submission.id}><div className="submissionStudent"><span className="studentAvatar">{submission.initials}</span><span><strong>{submission.name}</strong><small>{submission.submitted}</small></span></div><span className={`submissionStatus ${submission.status === "Submitted" ? "submitted" : "progress"}`}><i />{submission.status}</span><strong className="submissionScore">{submission.score === null ? "—" : `${submission.score}/${submission.total}`}</strong><span className="submissionSignals"><Icon name="shield" size={13} /> {submission.events} event{submission.events === 1 ? "" : "s"}</span><span className={`riskChip ${submission.risk.toLowerCase()}`}>{record?.decision !== "Unreviewed" ? "Reviewed" : submission.risk} </span><button type="button" className="reviewRowButton" onClick={() => openSubmission(submission.id)}>{record?.decision !== "Unreviewed" ? "View review" : "Review submission"}<Icon name="arrow" size={13} /></button></div>; })}</div> : <div className="dashboardEmpty compact"><span className="dashboardEmptyIcon"><Icon name="shield" size={20} /></span><strong>No students match this filter</strong><p>Try showing all priority levels to see every submission.</p></div> : <div className="dashboardEmpty"><span className="dashboardEmptyIcon"><Icon name="people" size={20} /></span><strong>No submissions yet</strong><p>Share the six-digit student code. Completed student attempts will appear here automatically.</p></div>}<div className="dashboardTableNote"><Icon name="shield" size={14} /><span>Signals are evidence for review, not an automatic verdict. Events show duration and context before a teacher decides.</span></div></section>
            </main> : <main className="reviewMain">
              <div className="reviewToolbar"><button type="button" className="reviewBack" onClick={() => { setSelectedSubmissionId(null); setReviewNotice(""); }}><Icon name="arrow" size={15} /> All submissions</button><span className="reviewToolbarHint">Teacher review · {selectedSubmission.name}</span></div>
              <div className="reviewHero"><div className="reviewStudentIdentity"><span className="reviewAvatar">{selectedSubmission.initials}</span><div><span className="sectionKicker">Student submission</span><h1>{selectedSubmission.name}</h1><p>{selectedSubmission.status} · {selectedSubmission.duration} · {selectedSubmission.submitted}</p></div></div><div className="reviewHeroScore"><span className={`riskChip ${selectedSubmission.risk.toLowerCase()}`}>{selectedSubmission.risk} priority</span><strong>{selectedSubmission.score === null ? "—" : `${Math.round((selectedSubmission.score / selectedSubmission.total) * 100)}%`}</strong><small>{selectedSubmission.score === null ? "Score in progress" : `${selectedSubmission.score}/${selectedSubmission.total} points`}</small></div></div>
              {reviewNotice && <div className="reviewNotice" role="status"><Icon name="check" size={14} />{reviewNotice}</div>}
              <div className="reviewGrid"><section className="reviewCard answerReviewCard"><div className="reviewCardHeading"><div><span className="sectionKicker">Answer review</span><h2>Automatic grading</h2></div><span>{selectedSubmission.answers.filter((answer) => answer.result === "Correct").length} correct</span></div><div className="answerReviewList">{selectedSubmission.answers.map((answer, index) => <article key={`${selectedSubmission.id}-${index}`} className="answerReviewItem"><div className="answerReviewTop"><span>Question {String(index + 1).padStart(2, "0")}</span><b className={`answerResult ${answer.result.toLowerCase().replace(" ", "-")}`}>{answer.result}<em>{answer.points}</em></b></div><strong>{answer.prompt}</strong><div className="answerComparison"><div><small>Student answer</small><span>{answer.student}</span></div><div><small>Correct answer</small><span>{answer.correct}</span></div></div></article>)}</div></section><aside className="reviewSide"><section className="reviewCard timelineCard"><div className="reviewCardHeading"><div><span className="sectionKicker">Integrity timeline</span><h2>What happened?</h2></div><span>{selectedSubmission.events} signals</span></div>{selectedSubmission.timeline.length ? <div className="timelineList">{selectedSubmission.timeline.map((event, index) => <article className="timelineItem" key={`${selectedSubmission.id}-${event.time}`}><span className={`timelineIcon ${event.level.toLowerCase()}`}><Icon name={event.icon} size={14} /></span><div><div className="timelineTitle"><strong>{event.label}</strong><span className={`riskText ${event.level.toLowerCase()}`}>{event.level}</span></div><p>{event.detail}</p><small>{event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : event.time} · {event.duration} · {event.confidence ? `${event.confidence}% confidence` : "Context signal"} · {event.source || "Review metadata"}</small></div>{index < selectedSubmission.timeline.length - 1 && <i className="timelineLine" />}</article>)}</div> : <div className="timelineEmpty"><Icon name="check" size={16} /><span>No integrity signals recorded for this submission.</span></div>}<div className="evidenceNote"><Icon name="lock" size={13} /><span>Metadata only in this MVP. Evidence is minimized and shown for teacher review.</span></div></section><section className="reviewCard decisionCard"><div className="reviewCardHeading"><div><span className="sectionKicker">Human decision</span><h2>Classify this review</h2></div></div><p>Choose the outcome that best explains the complete session. This does not change the student score automatically.</p><label className="decisionLabel" htmlFor="review-decision">Decision<select id="review-decision" value={reviewDecision} onChange={(event) => setReviewDecision(event.target.value as ReviewDecision)}><option>Unreviewed</option><option>Valid concern</option><option>False detection</option><option>Technical issue</option><option>Acceptable</option></select></label><label className="decisionLabel" htmlFor="review-note">Private note<textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Add context for your records..." rows={3} /></label><button type="button" className="dashboardPrimary decisionSave" onClick={saveReview}>Save teacher review <Icon name="check" size={14} /></button></section></aside></div>
            </main>}
          </section>
        </div>
      )}

      {examWorkspace && (
        <div className="examBackdrop" role="presentation">
          <section className="examWorkspace" role="dialog" aria-modal="true" aria-labelledby="exam-workspace-title">
            <header className="examTopbar"><a className="examBrand" href="#top" onClick={() => setExamWorkspace(false)} aria-label="Exit exam workspace"><span>EXAM</span>GUARD</a><div className="examTitleBlock"><span>EXAM IN PROGRESS</span><strong id="exam-workspace-title">{studentExam?.title || "Web Development Fundamentals"}</strong></div><div className="examTopStatus"><span><i /> Monitoring active</span><span><Icon name="people" size={13} /> {studentName || "Student"}</span></div><div className={`examTimer ${examSecondsLeft < 300 ? "urgent" : ""}`}><small>Time left</small><strong>{formatExamTime(examSecondsLeft)}</strong></div><button className="examExit" type="button" onClick={() => setExamWorkspace(false)}>Exit</button></header>
            {examWarning && <div className="examWarning" role="status"><span className="examWarningIcon"><Icon name="shield" size={15} /></span><div><strong>Monitoring notice</strong><span>{examWarning}</span></div><button type="button" onClick={() => setExamWarning("")} aria-label="Dismiss warning">×</button></div>}
            {orientationCountdown !== null && orientationDirection !== "center" && <div className="examOrientationBanner" role="status"><span><Icon name="eye" size={15} /></span><div><strong>Camera guidance</strong><small>Please face the camera · {orientationCountdown}s remaining</small></div></div>}
            <div className="examBody">{!examSubmitted ? <main className="examMain"><div className="examQuestionHeader"><div><span className="sectionKicker">Question {String(examQuestionIndex + 1).padStart(2, "0")} of {String(examQuestions.length).padStart(2, "0")}</span><strong>{currentExamQuestion.type === "true-false" ? "True / False" : "Multiple choice"}</strong></div><button type="button" className={`examMarkButton ${examMarked[currentExamQuestion.id] ? "marked" : ""}`} onClick={toggleExamMark}><Icon name="spark" size={14} /> {examMarked[currentExamQuestion.id] ? "Marked for review" : "Mark for review"}</button></div><article className="examQuestionCard"><span className="examQuestionNumber">{currentExamQuestion.type === "true-false" ? "TRUE / FALSE" : "MULTIPLE CHOICE"} · {currentExamQuestion.points} point{currentExamQuestion.points === 1 ? "" : "s"}</span><h1>{currentExamQuestion.prompt || "Your question will appear here."}</h1><div className="examAnswerList">{currentExamQuestion.options.map((option, index) => { const value = option || `Option ${String.fromCharCode(65 + index)}`; const answerValue = currentExamQuestion.type === "true-false" ? value : String.fromCharCode(65 + index); return <button type="button" key={`${currentExamQuestion.id}-${answerValue}`} className={`examAnswerOption ${examAnswers[currentExamQuestion.id] === answerValue ? "selected" : ""}`} onClick={() => chooseExamAnswer(answerValue)}><span className="examAnswerMarker">{currentExamQuestion.type === "true-false" ? value[0] : String.fromCharCode(65 + index)}</span><span>{value}</span>{examAnswers[currentExamQuestion.id] === answerValue && <Icon name="check" size={16} />}</button>; })}</div></article><div className="examQuestionFooter"><button type="button" className="examNavButton" onClick={() => setExamQuestionIndex((current) => Math.max(0, current - 1))} disabled={examQuestionIndex === 0}><Icon name="arrow" size={15} /> Previous</button><span><Icon name="check" size={13} /> {examAnswers[currentExamQuestion.id] ? "Answer saved" : "Select an answer to save"}</span><button type="button" className="examNavButton next" onClick={() => setExamQuestionIndex((current) => Math.min(examQuestions.length - 1, current + 1))} disabled={examQuestionIndex === examQuestions.length - 1}>Next <Icon name="arrow" size={15} /></button></div></main> : <main className="submissionReceipt"><span className="submissionIcon"><Icon name="check" size={28} /></span><span className="sectionKicker">Submission received</span><h1>Your exam is complete.</h1><p>Your answers were saved for teacher review. The integrity timeline stays explainable: events are shown with context, not automatic accusations.</p><div className="receiptStats"><div><strong>{Object.keys(examAnswers).length}/{examQuestions.length}</strong><span>Answered</span></div><div><strong>{examEventCount}</strong><span>Review events</span></div><div><strong>Pending</strong><span>Teacher review</span></div></div><button type="button" className="receiptButton" onClick={() => { setExamWorkspace(false); setNotice("Submission receipt saved for this demo."); }}>Return home <Icon name="arrow" size={15} /></button></main>}<aside className="examSidebar"><div className="examProgressCard"><div><span className="sectionKicker">Your progress</span><strong>{Object.keys(examAnswers).length} of {examQuestions.length}</strong><small>questions answered</small></div><div className="examProgressRing" style={{ background: `conic-gradient(var(--blue) 0 ${Math.round((Object.keys(examAnswers).length / examQuestions.length) * 100)}%, #e7eef5 ${Math.round((Object.keys(examAnswers).length / examQuestions.length) * 100)}% 100%)` }}><span>{Math.round((Object.keys(examAnswers).length / examQuestions.length) * 100)}%</span></div></div><div className="examQuestionNav"><div className="examSidebarHeading"><strong>Question navigator</strong><small>Blue = answered</small></div><div>{examQuestions.map((question, index) => <button type="button" key={question.id} className={`${examQuestionIndex === index ? "current" : ""} ${examAnswers[question.id] ? "answered" : ""} ${examMarked[question.id] ? "marked" : ""}`} onClick={() => setExamQuestionIndex(index)}>{index + 1}{examMarked[question.id] && <i />}</button>)}</div></div><div className="examCameraCard"><div className="examCameraHead"><strong>Your camera</strong><span><i /> Live</span></div><div className="examMiniCamera"><video ref={cameraVideoRef} className={`cameraVideo ${cameraStream ? "live" : ""}`} autoPlay muted playsInline aria-label="Your live camera preview" />{!cameraStream && <span><Icon name="people" size={24} /> </span>}{orientationDirection !== "center" && orientationCountdown !== null && <span className="cameraOrientationNotice"><Icon name="eye" size={14} /><span><strong>Face camera</strong><small>{formatHeadDirection(orientationDirection)} · {orientationCountdown}s</small></span></span>}</div><small>{orientationCountdown !== null ? "You have time to correct your position." : "Check your framing while you answer."}</small></div><div className="examMonitorStatus"><span className="monitorStatusDot" /><div><strong>Monitoring active</strong><small>Camera connected · {examEventCount} event{examEventCount === 1 ? "" : "s"} recorded</small></div></div><button type="button" className="examSubmitButton" onClick={() => setSubmitConfirm(true)}>Submit exam <Icon name="arrow" size={15} /></button></aside></div>
            {submitConfirm && <div className="submitConfirmBackdrop"><div className="submitConfirm" role="dialog" aria-modal="true" aria-labelledby="submit-title"><span className="submitConfirmIcon"><Icon name="shield" size={20} /></span><h2 id="submit-title">Submit your exam?</h2><p>You answered {Object.keys(examAnswers).length} of {examQuestions.length} questions. You can return to review unanswered questions before submitting.</p><div><button type="button" className="submitCancel" onClick={() => setSubmitConfirm(false)}>Keep reviewing</button><button type="button" className="submitConfirmButton" onClick={submitExam}>Submit now <Icon name="arrow" size={14} /></button></div></div></div>}
          </section>
        </div>
      )}

      {studentFlow && (
        <div className="studentBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStudentFlow(false); }}>
          <section className="studentFlow" role="dialog" aria-modal="true" aria-labelledby="student-flow-title">
            <header className="studentHeader"><a className="studentLogo" href="#top" onClick={() => setStudentFlow(false)} aria-label="Return to ExamGuard home"><span>EXAM</span>GUARD</a><div className="studentHeaderCopy"><span>Student mode</span><strong id="student-flow-title">{studentExam?.title || "Web Development Fundamentals"}</strong></div><span className="studentExamCode">Exam {examCode}</span><button className="studentExit" type="button" onClick={() => setStudentFlow(false)}>Exit <Icon name="close" size={15} /></button></header>
            <div className="studentSteps">{["Join exam", "Monitoring notice", "Device check"].map((label, index) => <div className={`studentStepMarker ${studentStep === index ? "current" : ""} ${studentStep > index ? "complete" : ""}`} key={label}><span>{studentStep > index ? <Icon name="check" size={13} /> : String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}</div>
            <div className="studentBody"><aside className="studentAside"><span className="studentAsideIcon"><Icon name={studentStep === 0 ? "people" : studentStep === 1 ? "lock" : "shield"} size={22} /></span><span className="sectionKicker">{studentStep === 0 ? "Welcome" : studentStep === 1 ? "Your privacy matters" : "Almost ready"}</span><h2>{studentStep === 0 ? "Start with your exam details." : studentStep === 1 ? "Know what is monitored before you begin." : "Make sure your device is ready."}</h2><p>{studentStep === 0 ? "You do not need an account. Use the code from your teacher to join." : studentStep === 1 ? "ExamGuard shows objective signals to your teacher. It does not decide whether you cheated." : "A short check helps reduce false alerts caused by camera, browser, or connection problems."}</p><div className="studentAsideNote"><Icon name="lock" size={14} /><span>Your session is connected to this exam code only.</span></div></aside><main className="studentMain">{studentNotice && <div className="studentNotice" role="status"><Icon name="spark" size={14} />{studentNotice}</div>}
              {studentStep === 0 && <div className="studentPanel"><div className="studentPanelHeading"><div><span className="sectionKicker">Step 01</span><h2>Join your exam</h2></div><span className="studentPanelMeta">No account required</span></div><div className="studentExamSummary"><span className="summaryIcon"><Icon name="chart" size={18} /></span><div><strong>{studentExam?.title || "Web Development Fundamentals"}</strong><small>{studentExam?.subject || "Computer Science"} · {studentExam?.duration || "45"} minutes · Multiple-choice + True/False</small></div><span className="summaryLive">Open</span></div>{studentExam?.instructions && <p className="studentExamInstructions">{studentExam.instructions}</p>}<div className="studentForm"><label>Full name<input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="e.g. Alex Carter" /></label><label>Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="e.g. STU-1042" /></label></div><div className="studentHint"><Icon name="check" size={14} /><span>Your teacher will see this name with your answers and integrity timeline.</span></div></div>}
              {studentStep === 1 && <div className="studentPanel"><div className="studentPanelHeading"><div><span className="sectionKicker">Step 02</span><h2>Read before you start</h2></div><span className="studentPanelMeta">About 1 minute</span></div><p className="studentLead">During the exam, ExamGuard records a small set of objective events so your teacher can review the session fairly.</p><div className="consentGrid"><div><span className="consentIcon"><Icon name="tab" size={17} /></span><div><strong>Browser events</strong><small>Tab hidden, full-screen exit, copy/paste, and connection changes.</small></div></div><div><span className="consentIcon green"><Icon name="people" size={17} /></span><div><strong>Camera status</strong><small>Face presence, multiple faces, and camera interruptions.</small></div></div>{studentExam?.monitoring?.headOrientation !== false && <div><span className="consentIcon gold"><Icon name="eye" size={17} /></span><div><strong>Head direction</strong><small>A visible 20-second grace countdown appears before a sustained turn is added to the teacher timeline.</small></div></div>}<div><span className="consentIcon gold"><Icon name="lock" size={17} /></span><div><strong>Teacher review</strong><small>Events are signals with context. A teacher makes the final decision.</small></div></div><div><span className="consentIcon"><Icon name="shield" size={17} /></span><div><strong>Minimal evidence</strong><small>This prototype stores event metadata and optional snapshots, not continuous video.</small></div></div></div><label className="consentCheck"><input type="checkbox" checked={studentConsent} onChange={(event) => setStudentConsent(event.target.checked)} /><span>I understand what is monitored and consent to continue with this exam.</span></label></div>}
              {studentStep === 2 && <div className="studentPanel"><div className="studentPanelHeading"><div><span className="sectionKicker">Step 03</span><h2>Check your device</h2></div><span className="studentPanelMeta">5–10 seconds</span></div><div className="deviceCheckTop"><p>Run the quick calibration before entering the exam workspace.</p><button type="button" className="deviceRunButton" onClick={runDeviceCheck} disabled={deviceChecking}>{deviceChecking ? "Checking..." : Object.values(deviceChecks).every(Boolean) ? "Check complete" : cameraStatus === "blocked" ? "Try camera again" : "Allow camera & run check"} <Icon name={deviceChecking ? "spark" : "arrow"} size={14} /></button></div><div className="deviceCheckLayout"><div className="devicePreview"><div className="deviceCameraFrame"><video ref={cameraVideoRef} className={`cameraVideo ${cameraStream ? "live" : ""}`} autoPlay muted playsInline aria-label="Your live camera preview" /><span className="cameraCorner topLeft" /><span className="cameraCorner topRight" /><span className="cameraCorner bottomLeft" /><span className="cameraCorner bottomRight" />{!cameraStream && <span className="cameraSilhouette"><Icon name="people" size={30} /></span>}<span className="cameraLabel">Camera preview</span><small>{deviceChecking ? "Calibrating your view..." : cameraStream ? "Your camera is live" : "Allow access to check your framing"}</small></div><span className="previewPrivacy"><Icon name="lock" size={12} /> Camera status only</span>{cameraError && <span className="cameraError"><Icon name="spark" size={12} /> {cameraError}</span>}</div><div className="deviceCheckList">{[{ key: "camera", icon: "people", label: "Camera connected", copy: "Permission and stream" }, { key: "face", icon: "eye", label: "One face detected", copy: "Visible and centered" }, { key: "lighting", icon: "spark", label: "Lighting acceptable", copy: "Enough light for detection" }, { key: "browser", icon: "tab", label: "Browser supported", copy: "Visibility API available" }, { key: "connection", icon: "chart", label: "Connection stable", copy: "Heartbeat can start" }, { key: "fullscreen", icon: "shield", label: "Full-screen available", copy: "Ready when exam starts" }].map((item) => { const passed = deviceChecks[item.key as keyof typeof deviceChecks]; return <div className={`deviceCheckItem ${passed ? "passed" : ""}`} key={item.key}><span className="deviceCheckIcon"><Icon name={item.icon} size={15} /></span><span><strong>{item.label}</strong><small>{item.copy}</small></span><b>{deviceChecking ? "..." : passed ? "Ready" : "Waiting"}</b></div>; })}</div></div><div className="studentHint"><Icon name="shield" size={14} /><span>Calibration creates a normal baseline for this device. It does not identify you.</span></div></div>}
            </main></div>
            {studentStep === 2 && faceMessage && <div className={"studentFaceStatus " + faceStatus} role="status"><Icon name={faceStatus === "ready" ? "check" : faceStatus === "unsupported" ? "spark" : "eye"} size={13} /><span>{faceMessage}</span></div>}
            <footer className="studentFooter"><button type="button" className="studentBack" onClick={() => studentStep === 0 ? setStudentFlow(false) : setStudentStep((current) => current - 1)}>{studentStep === 0 ? "Cancel" : <><Icon name="arrow" size={14} /> Back</>}</button><div><span className="studentSaveHint">Session starts after the device check</span>{studentStep === 2 ? Object.values(deviceChecks).every(Boolean) ? <button type="button" className="studentPrimary" onClick={finishStudentFlow}>Start exam <Icon name="arrow" size={15} /></button> : <button type="button" className="studentPrimary" onClick={runDeviceCheck} disabled={deviceChecking}>{deviceChecking ? "Checking..." : "Run device check"} <Icon name="spark" size={15} /></button> : <button type="button" className="studentPrimary" onClick={nextStudentStep}>Continue <Icon name="arrow" size={15} /></button>}</div></footer>
          </section>
        </div>
      )}

      {modal === "create" && (
        <div className="wizardBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className="examWizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <header className="wizardHeader">
              <a className="wizardLogo" href="#top" onClick={() => setModal(null)} aria-label="Return to ExamGuard home"><span>EXAM</span>GUARD</a>
              <div className="wizardHeaderCopy"><span className="wizardEyebrow">Teacher mode</span><strong id="wizard-title">Create a new exam</strong></div>
              <button className="wizardExit" type="button" onClick={() => setModal(null)}>Exit <Icon name="close" size={15} /></button>
            </header>
            <div className="wizardProgress"><div className="wizardProgressIntro"><div><span className="sectionKicker">Exam setup</span><strong>Build your assessment</strong></div><small>Step {wizardStep + 1} of 4</small></div><div className="wizardSteps">{["Exam details", "Questions", "Monitoring", "Publish"].map((label, index) => <button type="button" key={label} className={`wizardStepMarker ${wizardStep === index ? "current" : ""} ${wizardStep > index ? "complete" : ""}`} onClick={() => index <= wizardStep && setWizardStep(index)} disabled={index > wizardStep}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></button>)}</div></div>
            <div className="wizardBody">
              <aside className="wizardAside"><span className="wizardAsideIcon"><Icon name={wizardStep === 1 ? "chart" : wizardStep === 2 ? "shield" : "lock"} size={21} /></span><span className="sectionKicker">{wizardStep === 0 ? "Start with the basics" : wizardStep === 1 ? "Make it yours" : wizardStep === 2 ? "Protect the experience" : "Ready to share"}</span><h2>{wizardStep === 0 ? "A clear beginning makes every exam easier to review." : wizardStep === 1 ? "Keep each question focused and fair." : wizardStep === 2 ? "Use signals as context, never as a verdict." : "Give students a simple path in and teachers a private path back."}</h2><p>{wizardStep === 0 ? "Set the expectations students will see before they begin." : wizardStep === 1 ? "Use multiple-choice and True/False questions for this MVP." : wizardStep === 2 ? "These settings create explainable events for the teacher timeline." : "Review the details once, then publish both access codes."}</p><div className="wizardAsideNote"><Icon name="check" size={14} /><span>No account is needed for this prototype.</span></div></aside>
              <div className="wizardMain">{wizardNotice && <div className="wizardNotice" role="status"><Icon name="spark" size={14} />{wizardNotice}</div>}
                {wizardStep === 0 && <div className="wizardPanel"><div className="wizardPanelHeading"><div><span className="sectionKicker">Step 01</span><h2>Tell us about the exam</h2></div><span className="wizardPanelMeta">About 2 minutes</span></div><div className="wizardFormGrid"><label className="wizardField wizardFieldWide">Exam title<input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="e.g. Web Development Fundamentals" /></label><label className="wizardField">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Computer Science" /></label><label className="wizardField">Duration<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label><label className="wizardField wizardFieldWide">Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Tell students what they should know before they start..." rows={5} /></label></div><div className="wizardHint"><Icon name="lock" size={15} /><span>Students will see these instructions before the monitoring notice and device check.</span></div></div>}
                {wizardStep === 1 && <div className="wizardPanel questionPanel"><div className="wizardPanelHeading"><div><span className="sectionKicker">Step 02</span><h2>Add your questions</h2></div><span className="wizardPanelMeta">{questions.length} question{questions.length === 1 ? "" : "s"}</span></div><div className="questionBuilder"><aside className="questionList"><div className="questionListHeader"><strong>Question list</strong><button type="button" className="smallAction" onClick={() => addQuestion("multiple-choice")}>+ Add</button></div>{questions.map((question, index) => <button type="button" key={question.id} className={`questionListItem ${activeQuestion === index ? "selected" : ""}`} onClick={() => setActiveQuestion(index)}><span>Q{String(index + 1).padStart(2, "0")}</span><strong>{question.prompt || "Untitled question"}</strong><small>{question.type === "true-false" ? "True / False" : "Multiple choice"}</small></button>)}<div className="questionListFooter"><button type="button" onClick={() => addQuestion("multiple-choice")}>+ Multiple choice</button><button type="button" onClick={() => addQuestion("true-false")}>+ True / False</button></div></aside><div className="questionEditor"><div className="questionEditorTop"><div><span className="sectionKicker">Editing Q{String(activeQuestion + 1).padStart(2, "0")}</span><strong>Question content</strong></div><div className="questionMove"><button type="button" onClick={() => moveQuestion(-1)} disabled={activeQuestion === 0} aria-label="Move question up">↑</button><button type="button" onClick={() => moveQuestion(1)} disabled={activeQuestion === questions.length - 1} aria-label="Move question down">↓</button><button type="button" className="dangerAction" onClick={removeQuestion} aria-label="Delete question">Delete</button></div></div><label className="wizardField">Question text<textarea value={currentQuestion.prompt} onChange={(event) => updateQuestion(currentQuestion.id, { prompt: event.target.value })} placeholder={currentQuestion.type === "true-false" ? "Write a statement students can judge..." : "Write a clear question..."} rows={4} /></label><div className="questionTypeRow"><label className="wizardField">Question type<select value={currentQuestion.type} onChange={(event) => changeQuestionType(event.target.value as QuestionType)}><option value="multiple-choice">Multiple choice</option><option value="true-false">True / False</option></select></label><label className="wizardField pointsField">Points<input type="number" min={1} max={10} value={currentQuestion.points} onChange={(event) => updateQuestion(currentQuestion.id, { points: Math.max(1, Number(event.target.value) || 1) })} /></label></div>{currentQuestion.type === "multiple-choice" ? <div className="optionEditor"><div className="optionEditorHeading"><span className="sectionKicker">Answer options</span><small>Select the correct answer</small></div>{currentQuestion.options.map((option, index) => { const letter = String.fromCharCode(65 + index); return <div className="optionRow" key={`${currentQuestion.id}-${letter}`}><span className="optionLetter">{letter}</span><input value={option} onChange={(event) => updateQuestion(currentQuestion.id, { options: currentQuestion.options.map((item, optionIndex) => optionIndex === index ? event.target.value : item) })} placeholder={`Option ${letter}`} aria-label={`Option ${letter}`} /><label className="correctChoice"><input type="radio" name={`correct-${currentQuestion.id}`} checked={currentQuestion.answer === letter} onChange={() => updateQuestion(currentQuestion.id, { answer: letter })} /> Correct</label>{currentQuestion.options.length > 2 && <button type="button" onClick={() => removeOption(index)} aria-label={`Remove option ${letter}`}>×</button>}</div>; })}<button type="button" className="addOption" onClick={addOption} disabled={currentQuestion.options.length >= 4}>+ Add option</button></div> : <div className="trueFalseChoices"><div className="optionEditorHeading"><span className="sectionKicker">Correct answer</span><small>Choose one</small></div><div>{["True", "False"].map((answer) => <button type="button" key={answer} className={currentQuestion.answer === answer ? "selected" : ""} onClick={() => updateQuestion(currentQuestion.id, { answer })}>{answer}<Icon name={currentQuestion.answer === answer ? "check" : "arrow"} size={15} /></button>)}</div></div>}</div></div></div>}
                {wizardStep === 2 && <div className="wizardPanel"><div className="wizardPanelHeading"><div><span className="sectionKicker">Step 03</span><h2>Choose monitoring signals</h2></div><span className="wizardPanelMeta">{Object.values(monitoring).filter(Boolean).length} enabled</span></div><p className="wizardLead">ExamGuard records objective events with duration and context. A teacher reviews the final timeline.</p><div className="monitoringGrid">{[{ key: "tabSwitch", icon: "tab", label: "Tab or window exit", copy: "Record when the exam page becomes hidden." }, { key: "fullscreen", icon: "eye", label: "Full-screen exit", copy: "Notice when a student leaves full-screen mode." }, { key: "clipboard", icon: "chart", label: "Copy or paste", copy: "Record browser-reported copy and paste attempts." }, { key: "faceAbsence", icon: "people", label: "Face absence", copy: "Confirm when no face is visible for a sustained period." }, { key: "multipleFaces", icon: "shield", label: "Multiple faces", copy: "Confirm when more than one face persists in frame." }, { key: "headOrientation", icon: "eye", label: "Head orientation", copy: "Show a 20-second warning before recording a sustained left, right, up, or down turn." }, { key: "cameraStopped", icon: "lock", label: "Camera stopped", copy: "Record when the camera stream ends or is blocked." }].map((item) => <label className={`monitorCard ${monitoring[item.key as keyof MonitoringSettings] ? "enabled" : ""}`} key={item.key}><input type="checkbox" checked={monitoring[item.key as keyof MonitoringSettings]} onChange={() => toggleMonitoring(item.key as keyof MonitoringSettings)} /><span className="monitorIcon"><Icon name={item.icon} size={18} /></span><span className="monitorCopy"><strong>{item.label}</strong><small>{item.copy}</small></span><span className="monitorToggle" aria-hidden="true" /></label>)}</div><div className="wizardHint"><Icon name="shield" size={15} /><span>One uncertain frame is never enough to create a high-risk event. Signals are combined before teacher review.</span></div></div>}
                {wizardStep === 3 && <div className="wizardPanel publishPanel">{!publishedExam ? <><div className="wizardPanelHeading"><div><span className="sectionKicker">Step 04</span><h2>Preview and publish</h2></div><span className="wizardPanelMeta">Final check</span></div><div className="publishPreview"><div className="publishPreviewTop"><div><span className="sectionKicker">Student preview</span><h3>{examTitle || "Untitled exam"}</h3><p>{subject || "No subject"} · {duration} minutes · {questions.length} question{questions.length === 1 ? "" : "s"} · {questions.reduce((total, question) => total + question.points, 0)} total points</p></div><span className="previewBadge"><Icon name="lock" size={13} /> Monitoring ready</span></div>{questions.map((question, index) => <div className="publishPreviewQuestion" key={question.id}><span>Question {String(index + 1).padStart(2, "0")}</span><strong>{question.prompt || "Untitled question"}</strong><div><span>{question.type === "true-false" ? "True / False" : "Multiple choice"}</span><span>{question.points} point{question.points === 1 ? "" : "s"}</span></div></div>)}</div><div className="publishChecklist"><div><Icon name="check" size={14} /><span>Automatic grading for {questions.length} question{questions.length === 1 ? "" : "s"}</span></div><div><Icon name="check" size={14} /><span>{Object.values(monitoring).filter(Boolean).length} integrity signals enabled</span></div><div><Icon name="check" size={14} /><span>Teacher review required for flagged events</span></div></div></> : <div className="publishSuccess"><span className="publishSuccessIcon"><Icon name="check" size={25} /></span><span className="sectionKicker">Exam published</span><h2>Share the student code.</h2><p>Save the private teacher key somewhere safe. It cannot be recovered without an account.</p><div className="accessCards"><div><span>Student exam code</span><strong>{publishedExam.studentCode}</strong><button type="button" onClick={() => copyValue(publishedExam.studentCode, "Student code")}>Copy code</button></div><div><span>Private teacher key</span><strong>{publishedExam.teacherKey}</strong><button type="button" onClick={() => copyValue(publishedExam.teacherKey, "Teacher key")}>Copy key</button></div></div><div className="publishLinks"><span><Icon name="people" size={14} /> Student link: examguard.local/exam/{publishedExam.studentCode}</span><span><Icon name="lock" size={14} /> Teacher link: examguard.local/manage</span></div></div>}</div>}
              </div>
            </div>
            <footer className="wizardFooter"><button type="button" className="wizardBack" onClick={() => wizardStep === 0 ? setModal(null) : setWizardStep((current) => current - 1)}>{wizardStep === 0 ? "Cancel" : <><Icon name="arrow" size={14} /> Back</>}</button><div><span className="wizardSaveHint">Draft stays in this session</span>{publishedExam ? <button type="button" className="wizardPrimary" onClick={() => setModal(null)}>Finish <Icon name="check" size={15} /></button> : wizardStep === 3 ? <button type="button" className="wizardPrimary" onClick={publishExam}>Publish exam <Icon name="arrow" size={15} /></button> : <button type="button" className="wizardPrimary" onClick={nextWizardStep}>Continue <Icon name="arrow" size={15} /></button>}</div></footer>
          </section>
        </div>
      )}

      {notice && <button className="toast" onClick={() => setNotice("")}><span><Icon name="check" size={13} /></span>{notice}<b>×</b></button>}

      <section className="homeHero" id="top">
        <div className="heroLight heroLightOne" /><div className="heroLight heroLightTwo" />
        <div className="heroMessage" data-reveal="left">
          <span className="heroEyebrow"><Icon name="spark" size={13} /> Explainable online exam monitoring</span>
          <h1>Fair online exams.<br /><em>Clearer decisions.</em></h1>
          <p>Create multiple-choice and True/False exams, automatically grade student answers, and review suspicious events with context.</p>
          <div className="heroProof"><span><Icon name="shield" size={14} /> Signals, not accusations.</span><span><Icon name="lock" size={14} /> No account needed for the MVP.</span></div>
        </div>

        <div className="entryPanel" data-reveal="right" aria-label="Choose how to start">
          <div className="entryHeader"><div><span className="sectionKicker">Start here</span><h2>What brings you to ExamGuard?</h2></div></div>
          <div className="entryCards">
            <article className="roleCard teacherCard" data-reveal><div className="roleTop"><span className="roleIcon"><Icon name="chart" size={20} /></span><span className="roleLabel">For teachers</span></div><h3>Run your next exam</h3><p>Create a new assessment or return to an exam you already published.</p><div className="roleActions"><button onClick={startCreateWizard}>Create new exam <Icon name="arrow" size={14} /></button><button className="softAction" onClick={() => setModal("manage")}>Manage existing <Icon name="arrow" size={14} /></button></div></article>
            <article className="roleCard studentCard" data-reveal><div className="roleTop"><span className="roleIcon"><Icon name="people" size={20} /></span><span className="roleLabel">For students</span></div><h3>Join an exam</h3><p>Enter the six-digit code provided by your teacher. No account required.</p><label className="codeLabel" htmlFor="exam-code">Exam code</label><div className="joinRow"><input id="exam-code" inputMode="numeric" maxLength={6} value={examCode} onChange={(event) => { setExamCode(event.target.value.replace(/\D/g, "")); setStudentNotice(""); }} placeholder="_ _ _ _ _ _" aria-describedby="join-help" /><button onClick={joinExam} aria-label="Join exam"><Icon name="arrow" size={16} /></button></div><small id="join-help" className={studentNotice ? "joinHelp error" : "joinHelp"}>{studentNotice || "You can enter the code now or come back later."}</small></article>
          </div>
        </div>
      </section>

      <section className="previewStrip">
        <div className="previewCopy" data-reveal="left">
          <span className="sectionKicker">Made for real classrooms</span>
          <h2>A calmer experience,<br /><em>for everyone.</em></h2>
          <p>Students get a friendly, focused exam experience while teachers keep the context they need to review fairly.</p>
          <a href="#how-it-works">Explore the flow <Icon name="arrow" size={14} /></a>
        </div>
        <div className="previewWindow previewArtwork" data-reveal="right">
          <div
            className="previewArtworkImage"
            role="img"
            aria-label="A friendly teacher supporting three students taking an online exam on laptops"
          />
        </div>
      </section>

      <section className="stepsSection" id="how-it-works"><div className="sectionHeading" data-reveal><div><span className="sectionKicker">How ExamGuard works</span><h2>From first click<br /><em>to final review.</em></h2></div><p>Designed around the moments teachers and students actually experience.</p></div><div className="stepGrid"><article data-reveal><span className="stepNumber">01</span><span className="stepIcon blueStep"><Icon name="chart" size={19} /></span><h3>Create</h3><p>Add exam details, multiple-choice questions, and True/False questions.</p><a href="#top" onClick={startCreateWizard}>Create an exam <Icon name="arrow" size={13} /></a></article><article data-reveal><span className="stepNumber">02</span><span className="stepIcon navyStep"><Icon name="eye" size={19} /></span><h3>Conduct</h3><p>Students join with a code, complete a device check, and take the exam.</p><a href="#top">See student flow <Icon name="arrow" size={13} /></a></article><article data-reveal><span className="stepNumber">03</span><span className="stepIcon goldStep"><Icon name="shield" size={19} /></span><h3>Review</h3><p>See automatic scores and understandable integrity events in one timeline.</p><a href="#detection">Explore detection <Icon name="arrow" size={13} /></a></article></div></section>

      <section className="detectionSection" id="detection"><div className="sectionHeading detectionHeading" data-reveal><div><span className="sectionKicker">Built for meaningful signals</span><h2>Notice the moment.<br /><em>Keep the context.</em></h2></div><p>ExamGuard never treats one uncertain event as proof. It combines duration, confidence, and related signals for teacher review.</p></div><div className="detectionGrid"><article data-reveal><span className="detectIcon"><Icon name="tab" size={20} /></span><h3>Browser focus</h3><p>Know when the exam tab becomes hidden or the student leaves full-screen mode.</p></article><article data-reveal><span className="detectIcon detectGreen"><Icon name="eye" size={20} /></span><h3>Camera presence</h3><p>Detect sustained face absence, multiple faces, and camera interruptions.</p></article><article data-reveal><span className="detectIcon detectGold"><Icon name="chart" size={20} /></span><h3>Review priority</h3><p>See low, medium, or high priority events with timestamps and durations.</p></article><article data-reveal><span className="detectIcon detectNavy"><Icon name="lock" size={20} /></span><h3>Human decision</h3><p>Classify events as valid concern, false detection, technical issue, or acceptable.</p></article></div></section>

      <section className="trustSection" id="trust">
        <div className="trustCard" data-reveal="scale">
          <div className="trustIntro" data-reveal="left">
            <span className="trustIcon"><Icon name="lock" size={21} /></span>
            <div className="trustCopy">
              <span className="sectionKicker">Trust & privacy</span>
              <h2>Visibility without<br /><em>unnecessary surveillance.</em></h2>
              <p>Students see what is monitored before they begin. Teachers receive evidence and context, not automatic accusations.</p>
            </div>
          </div>
          <div className="trustPoints" data-reveal="right" aria-label="ExamGuard privacy principles">
            <article><span className="trustPointIcon"><Icon name="check" size={15} /></span><div><strong>Clear consent</strong><small>Students know what is monitored before the exam begins.</small></div></article>
            <article><span className="trustPointIcon"><Icon name="check" size={15} /></span><div><strong>Minimal evidence</strong><small>Only useful review context is kept and presented.</small></div></article>
            <article><span className="trustPointIcon"><Icon name="check" size={15} /></span><div><strong>Teacher review</strong><small>A person—not an automated score—makes the final decision.</small></div></article>
          </div>
        </div>
      </section>

      <section className="finalSection"><span className="sectionKicker" data-reveal>Start with one exam</span><h2 data-reveal>Make your next assessment<br /><em>feel a little clearer.</em></h2><p data-reveal>Create an exam, share a code, and see the complete flow end to end.</p><div data-reveal><button className="primaryCta" onClick={startCreateWizard}>Create new exam <Icon name="arrow" size={15} /></button><button className="secondaryCta" onClick={() => document.getElementById("exam-code")?.focus()}>Join with a code <Icon name="arrow" size={15} /></button></div></section>

      <footer className="homeFooter"><div><a className="homeLogo" href="#top"><span className="wordmarkText"><span className="wordmarkExam">EXAM</span><span className="wordmarkGuard">GUARD</span></span></a><p>Integrity, made clearer.<br />For teachers and students.</p></div><div className="footerLinks"><a href="#how-it-works">How it works</a><a href="#detection">Detection</a><a href="#trust">Trust & privacy</a><a href="#top">Teacher guide</a></div><div className="footerBottom"><span>© 2024 ExamGuard prototype</span><span>Evidence over verdicts.</span></div></footer>

      {modal && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="startModal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modalClose" onClick={() => setModal(null)} aria-label="Close"><Icon name="close" size={17} /></button><span className="modalIcon"><Icon name={modal === "create" ? "chart" : "lock"} size={23} /></span><span className="sectionKicker">{modal === "create" ? "Teacher mode" : "Returning teacher"}</span><h2 id="modal-title">{modal === "create" ? "Create a new exam" : "Manage an existing exam"}</h2><p>{modal === "create" ? "Start with the basics. You can add your questions and monitoring settings next." : "Use the exam code and private teacher key from when you published the exam."}</p>{modal === "create" ? <div className="modalFields"><label>Exam title<input placeholder="e.g. Web Development Fundamentals" /></label><label>Subject<input placeholder="e.g. Computer Science" /></label><button className="modalPrimary" onClick={() => { setModal(null); setNotice("Exam draft created. Next step: add your questions."); }}>Continue to exam details <Icon name="arrow" size={15} /></button></div> : <div className="modalFields"><label>Exam code<input inputMode="numeric" maxLength={6} value={manageExamCode} onChange={(event) => { setManageExamCode(event.target.value.replace(/\D/g, "")); setManageError(""); }} placeholder="6-digit code" /></label><label>Private teacher key<input value={manageTeacherKey} onChange={(event) => { setManageTeacherKey(event.target.value.toUpperCase()); setManageError(""); }} placeholder="e.g. K7P9-X2RM" /></label>{manageError && <span className="modalError" role="alert"><Icon name="spark" size={13} /> {manageError}</span>}<button className="modalPrimary" onClick={openTeacherDashboard}>Open teacher dashboard <Icon name="arrow" size={15} /></button></div>}</section></div>}
    </main>
  );
}
