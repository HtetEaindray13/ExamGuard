"use client";

import { useMemo, useState } from "react";

type Exam = {
  name: string;
  subject: string;
  date: string;
  students: string;
  status: "Live now" | "Scheduled" | "Completed";
  tone: "blue" | "violet" | "green";
};

const exams: Exam[] = [
  {
    name: "Web Development Fundamentals",
    subject: "Computer Science",
    date: "Today, 10:00 AM",
    students: "32 students",
    status: "Live now",
    tone: "blue",
  },
  {
    name: "Data Structures · Midterm",
    subject: "Computer Science",
    date: "Tomorrow, 9:30 AM",
    students: "28 students",
    status: "Scheduled",
    tone: "violet",
  },
  {
    name: "Digital Citizenship Quiz",
    subject: "Life Skills",
    date: "May 18, 2024",
    students: "36 students",
    status: "Completed",
    tone: "green",
  },
];

const alerts = [
  {
    initials: "JC",
    name: "Jasmine Carter",
    label: "Multiple faces detected",
    time: "2 min ago",
    tone: "amber",
  },
  {
    initials: "OM",
    name: "Oliver Martinez",
    label: "Exam tab left twice",
    time: "8 min ago",
    tone: "blue",
  },
  {
    initials: "SP",
    name: "Sophia Patel",
    label: "Camera disconnected",
    time: "14 min ago",
    tone: "rose",
  },
];

export default function Home() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const pageTitle = useMemo(() => {
    if (activeNav === "Exams") return "Exams";
    if (activeNav === "Question bank") return "Question bank";
    if (activeNav === "Reports") return "Reports";
    return "Overview";
  }, [activeNav]);

  function handleCreateExam() {
    setModalOpen(false);
    setNotice("Exam draft created. Add your first question to get started.");
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandLockup">
          <div className="brandMark" aria-hidden="true"><span /></div>
          <div>
            <div className="brandName">exam<span>guard</span></div>
            <div className="brandTag">Integrity, made clearer.</div>
          </div>
        </div>

        <div className="workspacePicker">
          <div className="workspaceAvatar">CS</div>
          <div className="workspaceText"><strong>Computer Science</strong><span>Teacher workspace</span></div>
          <span className="chevron">⌄</span>
        </div>

        <nav className="sideNav" aria-label="Main navigation">
          <div className="navLabel">Workspace</div>
          {[
            ["Overview", "⌂"],
            ["Exams", "▣"],
            ["Question bank", "◈"],
            ["Reports", "◒"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={`navItem ${activeNav === label ? "active" : ""}`}
              onClick={() => setActiveNav(label)}
            >
              <span className="navIcon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
              {label === "Exams" && <span className="navCount">3</span>}
            </button>
          ))}
          <div className="navLabel navLabelSpaced">Manage</div>
          <button className="navItem" onClick={() => setNotice("Class management is coming next.")}><span className="navIcon" aria-hidden="true">♧</span><span>Classes</span></button>
          <button className="navItem" onClick={() => setNotice("Settings are saved for this workspace.")}><span className="navIcon" aria-hidden="true">⚙</span><span>Settings</span></button>
        </nav>

        <div className="sidebarBottom">
          <div className="helpCard">
            <div className="helpOrb">?</div>
            <div><strong>Need a hand?</strong><span>See how ExamGuard works</span></div>
            <span className="arrow">↗</span>
          </div>
          <div className="profileRow">
            <div className="profileAvatar">AM</div>
            <div><strong>Alex Morgan</strong><span>Teacher</span></div>
            <button className="moreButton" aria-label="More profile options">•••</button>
          </div>
        </div>
      </aside>

      <section className="mainArea">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{pageTitle}</strong></div>
          <div className="topbarActions">
            <button className="iconButton" aria-label="Search">⌕</button>
            <button className="iconButton notificationButton" aria-label="Notifications"><span className="bell">♢</span><i /></button>
            <div className="topDivider" />
            <button className="modeButton" onClick={() => setPreviewOpen(true)}><span className="studentDot" />Student preview <span>↗</span></button>
          </div>
        </header>

        <div className="contentWrap">
          {notice && <button className="noticeBanner" onClick={() => setNotice("")}><span>✓</span>{notice}<b>×</b></button>}

          {activeNav === "Overview" ? (
            <>
              <section className="welcomeRow">
                <div>
                  <p className="eyebrow">Wednesday, May 15, 2024 <span className="eyebrowDot" /> Week 20</p>
                  <h1>Good morning, Alex <span className="wave">✦</span></h1>
                  <p className="subhead">Here&apos;s what&apos;s happening across your exams today.</p>
                </div>
                <button className="primaryButton" onClick={() => setModalOpen(true)}><span>＋</span> Create exam</button>
              </section>

              <section className="statsGrid" aria-label="Exam overview">
                <article className="statCard statCardAccent">
                  <div className="statTop"><span>Active students</span><span className="statIcon blueIcon">◉</span></div>
                  <div className="statValue">32<span className="trend up">↗ 12%</span></div>
                  <div className="statFoot"><span className="miniBars blueBars"><i /><i /><i /><i /><i /><i /><i /></span><span>vs. last week</span></div>
                </article>
                <article className="statCard">
                  <div className="statTop"><span>Exams this month</span><span className="statIcon purpleIcon">▣</span></div>
                  <div className="statValue">8<span className="trend up">↗ 25%</span></div>
                  <div className="statFoot"><span className="miniBars purpleBars"><i /><i /><i /><i /><i /><i /><i /></span><span>vs. last month</span></div>
                </article>
                <article className="statCard">
                  <div className="statTop"><span>Average score</span><span className="statIcon greenIcon">◒</span></div>
                  <div className="statValue">84.6%<span className="trend up">↗ 4.2%</span></div>
                  <div className="statFoot"><span className="miniBars greenBars"><i /><i /><i /><i /><i /><i /><i /></span><span>vs. last month</span></div>
                </article>
                <article className="statCard statCardAlert">
                  <div className="statTop"><span>Needs review</span><span className="statIcon amberIcon">!</span></div>
                  <div className="statValue">3<span className="trend neutral">This week</span></div>
                  <div className="statFoot"><span className="pulseDot" /><span>Integrity alerts</span><button onClick={() => setActiveNav("Reports")}>Review <b>→</b></button></div>
                </article>
              </section>

              <section className="dashboardGrid">
                <article className="panel examsPanel">
                  <div className="panelHeader"><div><h2>Recent exams</h2><p>Keep an eye on your latest activity.</p></div><button className="textButton" onClick={() => setActiveNav("Exams")}>View all <b>→</b></button></div>
                  <div className="examList">
                    {exams.map((exam) => <button className="examRow" key={exam.name} onClick={() => setNotice(`${exam.name} opened in preview mode.`)}>
                      <span className={`examSymbol ${exam.tone}`}>{exam.tone === "blue" ? "⌁" : exam.tone === "violet" ? "◫" : "✓"}</span>
                      <span className="examInfo"><strong>{exam.name}</strong><small>{exam.subject} <i /> {exam.date}</small></span>
                      <span className="examStudents">{exam.students}</span>
                      <span className={`statusPill ${exam.status.toLowerCase().replace(" ", "-")}`}><i />{exam.status}</span>
                      <span className="rowArrow">→</span>
                    </button>)}
                  </div>
                </article>

                <article className="panel integrityPanel">
                  <div className="panelHeader"><div><h2>Integrity pulse</h2><p>Live signals from your active exam.</p></div><span className="liveBadge"><i /> Live</span></div>
                  <div className="pulseChart">
                    <div className="chartYAxis"><span>12</span><span>8</span><span>4</span><span>0</span></div>
                    <div className="chartArea"><div className="chartGrid"><i /><i /><i /><i /></div><div className="chartLine lineBlue" /><div className="chartLine lineViolet" /><div className="chartLabels"><span>9:00</span><span>9:30</span><span>10:00</span><span>10:30</span><span>Now</span></div></div>
                  </div>
                  <div className="chartLegend"><span><i className="legendBlue" /> Clean sessions <b>28</b></span><span><i className="legendViolet" /> Review needed <b>4</b></span></div>
                </article>
              </section>

              <section className="bottomGrid">
                <article className="panel alertPanel">
                  <div className="panelHeader"><div><h2>Review queue</h2><p>Events that may need your attention.</p></div><button className="textButton" onClick={() => setActiveNav("Reports")}>Open queue <b>→</b></button></div>
                  <div className="alertList">{alerts.map((alert) => <button className="alertRow" key={alert.name} onClick={() => setNotice(`${alert.name}'s event is ready for review.`)}><span className={`alertAvatar ${alert.tone}`}>{alert.initials}</span><span className="alertInfo"><strong>{alert.name}</strong><small>{alert.label}</small></span><span className="alertTime">{alert.time}</span><span className="rowArrow">→</span></button>)}</div>
                </article>
                <article className="panel coveragePanel">
                  <div className="panelHeader"><div><h2>Detection coverage</h2><p>Your active exam is protected.</p></div><button className="roundAction" onClick={() => setNotice("Detection settings opened.")} aria-label="Open detection settings">⚙</button></div>
                  <div className="coverageBody"><div className="coverageRing"><div><strong>92</strong><span>/ 100</span></div></div><div className="coverageCopy"><strong>Strong coverage</strong><span>All recommended signals are enabled.</span><button onClick={() => setNotice("Camera, tab-switch, full-screen and multi-face checks are on.")}>View signals <b>→</b></button></div></div>
                  <div className="signalTags"><span><i className="signalOn" /> Camera</span><span><i className="signalOn" /> Tab focus</span><span><i className="signalOn" /> Full-screen</span><span><i className="signalSoft" /> Audio off</span></div>
                </article>
              </section>
            </>
          ) : (
            <section className="emptyPage panel">
              <div className="emptyIcon">{activeNav === "Exams" ? "▣" : activeNav === "Reports" ? "◒" : "◈"}</div>
              <p className="eyebrow">Workspace / {pageTitle}</p>
              <h1>{pageTitle}</h1>
              <p className="subhead">This view is ready for your next workflow. Create an exam to see it come to life.</p>
              <button className="primaryButton" onClick={() => setModalOpen(true)}><span>＋</span> Create exam</button>
            </section>
          )}
        </div>
      </section>

      {modalOpen && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modalCard" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modalHeader"><div><p className="eyebrow">New workspace activity</p><h2 id="modal-title">Create an exam</h2></div><button className="modalClose" onClick={() => setModalOpen(false)} aria-label="Close">×</button></div><label>Exam title<input defaultValue="" placeholder="e.g. Web Development Fundamentals" /></label><div className="formRow"><label>Subject<input placeholder="Computer Science" /></label><label>Duration<select defaultValue="45"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label></div><div className="typeChoice"><span>Question types</span><div><button className="selectedChoice">✓ Multiple choice</button><button className="selectedChoice">✓ True / False</button></div></div><div className="modalFooter"><button className="secondaryButton" onClick={() => setModalOpen(false)}>Cancel</button><button className="primaryButton" onClick={handleCreateExam}>Create draft <span>→</span></button></div></section></div>}

      {previewOpen && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="previewCard" role="dialog" aria-modal="true" aria-labelledby="preview-title"><div className="previewTop"><div className="brandName">exam<span>guard</span></div><button className="modalClose" onClick={() => setPreviewOpen(false)} aria-label="Close">×</button></div><div className="studentMock"><div className="studentMockTop"><span>Web Development Fundamentals</span><span className="timer">⏱ 42:18</span></div><div className="studentProgress"><span style={{ width: "42%" }} /></div><p className="eyebrow">Question 5 of 20</p><h2 id="preview-title">Which HTML element is used to define the largest heading?</h2><div className="answerChoices"><button><span>A</span>&lt;head&gt;</button><button className="choiceSelected"><span>B</span>&lt;h1&gt;<i>✓</i></button><button><span>C</span>&lt;title&gt;</button><button><span>D</span>&lt;header&gt;</button></div><div className="studentMockBottom"><span>● Camera check active</span><button className="primaryButton" onClick={() => setPreviewOpen(false)}>Exit preview <span>→</span></button></div></div></section></div>}
    </main>
  );
}
