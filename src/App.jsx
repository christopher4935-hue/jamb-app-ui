import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Moon,
  Sun,
  ChevronRight,
  ChevronLeft,
  Clock3,
  Trophy,
  Target,
  Bell,
  LayoutDashboard,
  Settings as SettingsIcon,
  Check,
  Users,
  Menu,
  X,
  Compass,
} from "lucide-react";

const API_BASE = "https://jamb-app-backend.onrender.com";

// How many questions per subject in a practice session. Real JAMB is 40 per
// subject (60 for English) - this is kept small because the mock question
// bank is thin right now, so a "40 question exam" would just repeat 2-3
// questions over and over. Bump this up once real content is loaded.
const CBT_QUESTIONS_PER_SUBJECT = 3;
const SINGLE_SUBJECT_QUESTION_COUNT = 5;
const TOPIC_PRACTICE_COUNT = 5;

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("jamb_dark_mode") === "true");
  const [view, setView] = useState("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [mySubjects, setMySubjects] = useState(() => {
    const saved = localStorage.getItem("jamb_subjects");
    return saved ? JSON.parse(saved) : null;
  });
  const [guestMode, setGuestMode] = useState(false);

  const [stats, setStats] = useState({ questions_attempted: 0, accuracy: 0 });
  const [mastery, setMastery] = useState({});
  const [dueReviews, setDueReviews] = useState([]);
  const [recommendation, setRecommendation] = useState(null);

  const [activeSubject, setActiveSubject] = useState(null);
  const [question, setQuestion] = useState(null);
  const [result, setResult] = useState(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const [sessionType, setSessionType] = useState("single"); // "single" | "cbt" | "topic"
  const [isSessionMode, setIsSessionMode] = useState(false);
  const [sessionPlan, setSessionPlan] = useState([]); // array of {subject, topic|null}
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState([]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("jamb_dark_mode", String(next));
  };

  const activeSubjectList = () => {
    if (guestMode || !mySubjects) return catalog.map((s) => s.name);
    return mySubjects;
  };

  const loadCatalog = () => fetch(`${API_BASE}/api/subjects/catalog`, { credentials: "include" }).then((r) => r.json()).then((d) => setCatalog(d.subjects));
  const loadMastery = () => fetch(`${API_BASE}/api/mastery`, { credentials: "include" }).then((r) => r.json()).then(setMastery);
  const loadDueReviews = () => fetch(`${API_BASE}/api/reviews/due`, { credentials: "include" }).then((r) => r.json()).then((d) => setDueReviews(d.reviews));
  const loadStats = () => fetch(`${API_BASE}/api/dashboard`, { credentials: "include" }).then((r) => r.json()).then((d) => setStats(d.stats));
  const loadRecommendation = () => fetch(`${API_BASE}/api/recommendation`, { credentials: "include" }).then((r) => r.json()).then(setRecommendation);

  useEffect(() => {
    loadCatalog().then(() => {
      const saved = localStorage.getItem("jamb_subjects");
      setView(saved ? "dashboard" : "onboarding");
    });
    loadStats();
    loadMastery();
    loadDueReviews();
    loadRecommendation();
  }, []);

  const saveSubjects = (subjects) => {
    localStorage.setItem("jamb_subjects", JSON.stringify(subjects));
    setMySubjects(subjects);
    setGuestMode(false);
    setView("dashboard");
  };

  const continueAsGuest = () => {
    setGuestMode(true);
    setView("dashboard");
  };

  const refreshHome = () => {
    setMenuOpen(false);
    setView("dashboard");
    loadStats();
    loadMastery();
    loadDueReviews();
    loadRecommendation();
  };

  const goTo = (v) => {
    setMenuOpen(false);
    if (v === "progress") loadMastery();
    setView(v);
  };

  // ---------- Practice sessions (no feedback until the whole set is done) ----------
  // Single subject, topic-targeted, and CBT all use this same engine - the
  // only difference is what's in the plan. Spaced-repetition reviews (below)
  // are the one place that still gives instant feedback, since that's a
  // quick fix-it loop, not a mock exam.

  const fetchPlanQuestion = (planItem) => {
    setQuestion(null);
    const url = planItem.topic
      ? `${API_BASE}/api/quiz/${planItem.subject}/${planItem.topic}`
      : `${API_BASE}/api/quiz/${planItem.subject}`;
    fetch(url, { credentials: "include" }).then((r) => r.json()).then(setQuestion);
  };

  const startSession = (plan, type) => {
    setSessionPlan(plan);
    setSessionIndex(0);
    setSessionAnswers([]);
    setSessionType(type);
    setIsSessionMode(true);
    setIsReviewMode(false);
    setActiveSubject(plan[0].subject);
    fetchPlanQuestion(plan[0]);
    setView("quiz");
  };

  const startSinglePractice = (subjectName) => {
    const plan = Array(SINGLE_SUBJECT_QUESTION_COUNT).fill({ subject: subjectName, topic: null });
    startSession(plan, "single");
  };

  const startCbt = (subjects) => {
    const plan = subjects.flatMap((s) => Array(CBT_QUESTIONS_PER_SUBJECT).fill({ subject: s, topic: null }));
    startSession(plan, "cbt");
  };

  const startTopicPractice = (subject, topic) => {
    const plan = Array(TOPIC_PRACTICE_COUNT).fill({ subject, topic });
    startSession(plan, "topic");
  };

  const startReviews = () => {
    if (dueReviews.length === 0) return;
    const next = dueReviews[0];
    setIsReviewMode(true);
    setIsSessionMode(false);
    setActiveSubject(next.subject);
    setQuestion(null);
    fetch(`${API_BASE}/api/quiz/review/${next.question_id}`, { credentials: "include" }).then((r) => r.json()).then(setQuestion);
    setView("quiz");
  };

  const submitAnswer = (selectedIndex) => {
    const askedQuestion = question; // capture before it's replaced
    fetch(`${API_BASE}/api/answer`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected: selectedIndex }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (isSessionMode) {
          const entry = {
            subject: askedQuestion.subject,
            topic: askedQuestion.topic,
            text: askedQuestion.text,
            options: askedQuestion.options,
            explanation: askedQuestion.explanation,
            selected: selectedIndex,
            correct_index: data.correct_index,
            correct: data.correct,
          };
          const updatedAnswers = [...sessionAnswers, entry];
          setSessionAnswers(updatedAnswers);
          const nextIndex = sessionIndex + 1;
          if (nextIndex < sessionPlan.length) {
            setSessionIndex(nextIndex);
            setActiveSubject(sessionPlan[nextIndex].subject);
            fetchPlanQuestion(sessionPlan[nextIndex]);
          } else {
            setIsSessionMode(false);
            setView("sessionReview");
            loadDueReviews();
            loadMastery();
            loadStats();
            loadRecommendation();
          }
        } else {
          // Review mode only - instant feedback for a single missed question
          setResult(data);
          setView("result");
          loadDueReviews();
        }
      });
  };

  const nextQuestion = () => {
    if (isReviewMode) {
      const remaining = dueReviews.slice(1);
      setDueReviews(remaining);
      if (remaining.length > 0) {
        setIsReviewMode(true);
        setActiveSubject(remaining[0].subject);
        setQuestion(null);
        fetch(`${API_BASE}/api/quiz/review/${remaining[0].question_id}`, { credentials: "include" }).then((r) => r.json()).then(setQuestion);
        setView("quiz");
      } else {
        refreshHome();
      }
    }
  };

  if (view === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>;
  }

  return (
    <div className={`mx-auto min-h-screen max-w-md pb-6 relative ${darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {view !== "onboarding" && (
        <header className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-xl ${darkMode ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-white/80"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Menu size={20} />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 font-black text-white">J</div>
              <span className="font-bold text-sm">JAMB Prep</span>
              {guestMode && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                  <Users size={10} /> Guest
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleDarkMode} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button onClick={() => (dueReviews.length > 0 ? startReviews() : refreshHome())} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Bell size={18} />
                {dueReviews.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-700" />}
              </button>
            </div>
          </div>
        </header>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 h-full bg-white dark:bg-slate-900 shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="font-black">JAMB Prep</span>
              <button onClick={() => setMenuOpen(false)} className="p-1"><X size={20} /></button>
            </div>
            <MenuLink icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={refreshHome} />
            <MenuLink icon={<Compass size={18} />} label="Practice" onClick={() => goTo("modeSelect")} />
            <MenuLink icon={<BarChart3 size={18} />} label="Progress" onClick={() => goTo("progress")} />
            <MenuLink icon={<Bell size={18} />} label={`Reviews Due (${dueReviews.length})`} onClick={() => { setMenuOpen(false); startReviews(); }} />
            <MenuLink icon={<SettingsIcon size={18} />} label="Settings" onClick={() => goTo("settings")} />
            <p className="text-[10px] text-slate-400 mt-auto">More sections (syllabus, notes, AI tutor) coming in later phases.</p>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <main className={view === "onboarding" || view === "quiz" ? "" : "px-4 pt-4 space-y-6"}>
        {view === "onboarding" && (
          <SubjectPicker
            catalog={catalog}
            darkMode={darkMode}
            onSave={saveSubjects}
            onGuest={continueAsGuest}
            title="Let's personalize your practice"
            subtitle="JAMB tests 4 subjects — English plus 3 others of your choice. Pick yours below so we only show you what's relevant. English is locked in since it's compulsory for everyone."
          />
        )}

        {view === "dashboard" && (
          <Dashboard
            stats={stats}
            darkMode={darkMode}
            dueReviews={dueReviews}
            onStartReviews={startReviews}
            onStartPractice={() => setView("modeSelect")}
            mySubjects={activeSubjectList()}
            recommendation={recommendation}
            onStartRecommended={() => recommendation?.has_data && startTopicPractice(recommendation.subject, recommendation.topic)}
          />
        )}

        {view === "modeSelect" && (
          <ModeSelect
            darkMode={darkMode}
            onBack={refreshHome}
            onSingle={() => setView("subjectPick")}
            onCbt={() => {
              if (guestMode || !mySubjects) {
                setView("cbtPick");
              } else {
                startCbt(mySubjects);
              }
            }}
          />
        )}

        {view === "subjectPick" && (
          <div>
            <BackRow onBack={() => setView("modeSelect")} label="Choose a subject" />
            <div className="space-y-3 mt-3">
              {activeSubjectList().map((name) => {
                const info = catalog.find((c) => c.name === name);
                return (
                  <button
                    key={name}
                    onClick={() => startSinglePractice(name)}
                    className={`w-full text-left rounded-xl border p-4 flex items-center justify-between ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}
                  >
                    <div>
                      <p className="font-bold text-sm">{name}</p>
                      <p className="text-xs text-slate-500">{info?.questions || 0} questions in bank</p>
                    </div>
                    <ChevronRight size={18} className="text-blue-700" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "cbtPick" && (
          <SubjectPicker
            catalog={catalog}
            darkMode={darkMode}
            onSave={(subjects) => startCbt(subjects)}
            saveLabel="Start CBT"
            title="Pick 4 subjects for this CBT"
            subtitle="English is compulsory. Choose 3 more for this session."
            hideGuestOption
          />
        )}

        {view === "quiz" && (
          <QuizView
            subject={activeSubject}
            question={question}
            darkMode={darkMode}
            onAnswer={submitAnswer}
            progress={isSessionMode ? { current: sessionIndex + 1, total: sessionPlan.length } : null}
          />
        )}

        {view === "result" && <ResultView result={result} darkMode={darkMode} onNext={nextQuestion} onDashboard={refreshHome} />}

        {view === "sessionReview" && <SessionReview answers={sessionAnswers} sessionType={sessionType} darkMode={darkMode} onDashboard={refreshHome} />}

        {view === "progress" && <ProgressView mastery={mastery} darkMode={darkMode} />}

        {view === "settings" && (
          <SettingsView
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            mySubjects={mySubjects}
            guestMode={guestMode}
            onEditSubjects={() => setView("onboarding")}
          />
        )}
      </main>

      {view !== "onboarding" && view !== "quiz" && (
        <nav className={`fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t px-6 py-2 backdrop-blur-lg ${darkMode ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white/90"}`}>
          <div className="flex items-center justify-around">
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === "dashboard"} onClick={refreshHome} />
            <NavItem icon={<BarChart3 size={20} />} label="Progress" active={view === "progress"} onClick={() => goTo("progress")} />
            <NavItem icon={<SettingsIcon size={20} />} label="Settings" active={view === "settings"} onClick={() => goTo("settings")} />
          </div>
        </nav>
      )}
      {view !== "onboarding" && view !== "quiz" && <div className="h-16" />}
    </div>
  );
}

/* ---------------- Views ---------------- */

function BackRow({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-500 mb-1">
      <ChevronLeft size={16} /> {label}
    </button>
  );
}

function MenuLink({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
      {icon} {label}
    </button>
  );
}

function SubjectPicker({ catalog, darkMode, onSave, onGuest, title, subtitle, saveLabel, hideGuestOption }) {
  const [selected, setSelected] = useState(["English"]);

  const toggle = (name) => {
    if (name === "English") return; // compulsory, can't deselect
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      if (prev.length >= 4) return prev; // cap at 4
      return [...prev, name];
    });
  };

  const canSave = selected.length === 4;

  return (
    <div className="p-4">
      <h1 className="text-xl font-black mb-1">{title}</h1>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{subtitle}</p>
      <div className="space-y-2">
        {catalog.map((s) => {
          const isSelected = selected.includes(s.name);
          const isEnglish = s.name === "English";
          return (
            <button
              key={s.name}
              onClick={() => toggle(s.name)}
              disabled={isEnglish}
              className={`w-full flex items-center justify-between rounded-xl border-2 p-3 text-left ${
                isSelected ? "border-blue-700 bg-blue-50 dark:bg-blue-950/30" : darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
              } ${isEnglish ? "opacity-90" : ""}`}
            >
              <div>
                <p className="text-sm font-bold">{s.name} {isEnglish && <span className="text-[10px] text-blue-700 font-semibold">COMPULSORY</span>}</p>
                <p className="text-[11px] text-slate-500">{s.questions} questions in bank</p>
              </div>
              {isSelected && (
                <div className="h-6 w-6 rounded-full bg-blue-700 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <button
        disabled={!canSave}
        onClick={() => onSave(selected)}
        className={`w-full mt-5 rounded-xl py-3 text-sm font-bold ${canSave ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-400"}`}
      >
        {canSave ? (saveLabel || "Save & Continue") : `Select ${4 - selected.length} more`}
      </button>
      {onGuest && !hideGuestOption && (
        <button onClick={onGuest} className="w-full mt-2 text-xs font-semibold text-slate-500 py-2">
          Continue as guest instead (see all subjects, nothing saved)
        </button>
      )}
    </div>
  );
}

function Dashboard({ stats, darkMode, dueReviews, onStartReviews, onStartPractice, mySubjects, recommendation, onStartRecommended }) {
  return (
    <>
      {dueReviews.length > 0 && (
        <button onClick={onStartReviews} className="w-full flex items-center justify-between rounded-2xl border-2 border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-4 text-left">
          <div>
            <p className="text-sm font-bold text-blue-700">{dueReviews.length} question{dueReviews.length > 1 ? "s" : ""} due for review</p>
            <p className="text-xs text-slate-500 mt-0.5">You got these wrong before — let's lock them in</p>
          </div>
          <ChevronRight size={20} className="text-blue-700" />
        </button>
      )}

      <div>
        <p className="text-xs font-semibold text-blue-700 tracking-wider">WELCOME BACK</p>
        <h1 className="text-xl font-black">Ready to ace JAMB?</h1>
      </div>

      <div className={`rounded-2xl p-5 ${darkMode ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200 shadow-sm"}`}>
        <div className="inline-block rounded-full bg-blue-700/10 text-blue-700 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide mb-2">JAMB 2026 PREPARATION</div>
        <h2 className="text-lg font-bold leading-snug">Your next practice session is waiting.</h2>
        <p className="mt-1 text-xs text-slate-500 mb-4">Practice a single subject, or simulate a full CBT exam.</p>
        <button onClick={onStartPractice} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-white py-2.5 text-xs font-bold shadow transition active:scale-[0.98]">
          Start Practice
          <ChevronRight size={16} />
        </button>
      </div>

      {recommendation && recommendation.has_data && (
        <button onClick={onStartRecommended} className={`w-full text-left rounded-2xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
          <p className="text-[10px] font-bold text-blue-700 tracking-wide mb-1">WHAT TO STUDY TODAY</p>
          <p className="font-bold">{recommendation.subject} · {recommendation.topic}</p>
          <p className="text-xs text-slate-500 mt-1">You're at {recommendation.pct}% here — practicing this topic specifically will help most.</p>
          <p className="text-xs font-semibold text-blue-700 mt-2 flex items-center gap-1">Start Practice <ChevronRight size={14} /></p>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Target size={16} />} label="Questions Answered" value={stats.questions_attempted} />
        <StatCard icon={<Trophy size={16} />} label="Accuracy" value={`${stats.accuracy}%`} />
        <StatCard icon={<Clock3 size={16} />} label="Your Subjects" value={mySubjects.length} />
        <StatCard icon={<BarChart3 size={16} />} label="Reviews Due" value={dueReviews.length} />
      </div>
    </>
  );
}

function ModeSelect({ darkMode, onBack, onSingle, onCbt }) {
  return (
    <div>
      <BackRow onBack={onBack} label="Back" />
      <h1 className="text-xl font-black mb-4">Choose Practice Mode</h1>
      <button onClick={onSingle} className={`w-full text-left rounded-2xl border-2 p-4 mb-3 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className="font-bold">Single Subject Practice</p>
        <p className="text-xs text-slate-500 mt-1">Pick one subject. Answer straight through, review at the end — no answers shown mid-way, just like the real thing.</p>
      </button>
      <button onClick={onCbt} className="w-full text-left rounded-2xl border-2 border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="font-bold text-blue-700">CBT Mode</p>
        <p className="text-xs text-slate-500 mt-1">Simulate the real exam — 4 subjects back to back, full review with explanations once you're done.</p>
      </button>
    </div>
  );
}

function QuizView({ subject, question, darkMode, onAnswer, progress }) {
  if (!question) return <p className="text-sm text-slate-500 px-4 pt-4">Loading question...</p>;
  return (
    <div className="px-4 pt-4">
      {progress && (
        <p className="text-xs font-semibold text-slate-500 mb-2">Question {progress.current} of {progress.total}</p>
      )}
      <div className={`rounded-2xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className="text-xs font-semibold text-blue-700 mb-1">
          {question.is_review && <span className="bg-blue-700 text-white px-1.5 py-0.5 rounded mr-2 text-[10px]">REVIEW</span>}
          {subject} · {question.topic}
        </p>
        <p className="font-bold mb-4">{question.text}</p>
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`w-full text-left rounded-xl border-2 p-3 transition ${darkMode ? "border-slate-700 hover:border-blue-700" : "border-slate-200 hover:border-blue-700"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, darkMode, onNext, onDashboard }) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
      {result.correct ? <p className="text-lg font-black text-green-600 mb-2">Correct!</p> : <p className="text-lg font-black text-red-600 mb-2">Not quite.</p>}
      <p className="text-xs text-slate-500 mb-4">{result.correct ? "Well done." : "This one will come back to you in a couple of days so it sticks."}</p>
      <button onClick={onNext} className="w-full rounded-xl bg-blue-700 text-white font-bold py-2.5 mb-2">Next Question</button>
      <button onClick={onDashboard} className="w-full rounded-xl bg-slate-200 text-slate-800 font-bold py-2.5">Back to Dashboard</button>
    </div>
  );
}

function SessionReview({ answers, sessionType, darkMode, onDashboard }) {
  const correctCount = answers.filter((a) => a.correct).length;
  const labels = { cbt: "CBT Result", single: "Practice Result", topic: "Topic Practice Result" };
  return (
    <div>
      <div className={`rounded-2xl p-5 text-center mb-4 ${darkMode ? "bg-slate-900 border border-slate-800" : "bg-white shadow-sm border border-slate-200"}`}>
        <p className="text-xs text-slate-500 mb-1">{labels[sessionType] || "Practice Result"}</p>
        <p className="text-3xl font-black text-blue-700">{correctCount}/{answers.length}</p>
        <p className="text-xs text-slate-500 mt-1">{Math.round((correctCount / answers.length) * 100)}% correct</p>
      </div>

      <h2 className="font-bold mb-3">Question Review</h2>
      <div className="space-y-3">
        {answers.map((a, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
            <p className="text-xs font-semibold text-blue-700 mb-1">{a.subject} · {a.topic}</p>
            <p className="text-sm font-bold mb-2">{a.text}</p>
            <div className="space-y-1 mb-2">
              {a.options.map((opt, oi) => {
                let style = darkMode ? "border-slate-700" : "border-slate-200";
                if (oi === a.correct_index) style = "border-green-600 bg-green-50 dark:bg-green-950/30";
                else if (oi === a.selected && !a.correct) style = "border-red-600 bg-red-50 dark:bg-red-950/30";
                return (
                  <div key={oi} className={`text-xs rounded-lg border p-2 ${style}`}>
                    {opt}
                    {oi === a.correct_index && <span className="ml-2 text-green-600 font-semibold">Correct answer</span>}
                    {oi === a.selected && oi !== a.correct_index && <span className="ml-2 text-red-600 font-semibold">Your answer</span>}
                  </div>
                );
              })}
            </div>
            {a.explanation && <p className="text-xs text-slate-500 italic">{a.explanation}</p>}
          </div>
        ))}
      </div>

      <button onClick={onDashboard} className="w-full rounded-xl bg-blue-700 text-white font-bold py-3 mt-4">Back to Dashboard</button>
    </div>
  );
}

function ProgressView({ mastery, darkMode }) {
  const subjectNames = Object.keys(mastery);
  if (subjectNames.length === 0) {
    return (
      <div className={`rounded-2xl border p-5 text-center ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className="text-sm text-slate-500">No attempts yet. Answer a few questions and your topic-level progress will show up here.</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-xl font-black mb-4">Your Progress</h1>
      {subjectNames.map((subject) => (
        <div key={subject} className={`rounded-2xl border p-4 mb-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
          <h2 className="font-bold mb-3">{subject}</h2>
          {Object.entries(mastery[subject]).map(([topic, stat]) => (
            <div key={topic} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className={stat.pct < 50 ? "text-red-600 font-semibold" : "text-slate-500"}>{topic}</span>
                <span className="font-semibold">{stat.pct}% ({stat.correct}/{stat.total})</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${stat.pct < 50 ? "bg-red-600" : "bg-green-600"}`} style={{ width: `${stat.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SettingsView({ darkMode, toggleDarkMode, mySubjects, guestMode, onEditSubjects }) {
  return (
    <div>
      <h1 className="text-xl font-black mb-4">Settings</h1>
      <div className={`rounded-2xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-semibold">Dark mode</p>
            <p className="text-xs text-slate-500">Applies across the whole app</p>
          </div>
          <button onClick={toggleDarkMode} className={`w-12 h-7 rounded-full flex items-center px-1 transition ${darkMode ? "bg-blue-700 justify-end" : "bg-slate-300 justify-start"}`}>
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 mt-3 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className="text-sm font-semibold mb-1">Your Subjects</p>
        {guestMode ? (
          <p className="text-xs text-slate-500 mb-3">You're in guest mode — nothing is saved.</p>
        ) : (
          <p className="text-xs text-slate-500 mb-3">{mySubjects ? mySubjects.join(", ") : "Not set yet"}</p>
        )}
        <button onClick={onEditSubjects} className="w-full rounded-xl border border-blue-700 text-blue-700 font-bold py-2 text-sm">
          {guestMode ? "Save subjects for this device" : "Change subjects"}
        </button>
      </div>

      <div className={`rounded-2xl border p-4 mt-3 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className="text-sm text-slate-500">Account and notification settings aren't built yet — coming in a later phase.</p>
      </div>
    </div>
  );
}

/* ---------------- Small components ---------------- */

function StatCard({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700/10 text-blue-700">{icon}</div>
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition ${active ? "text-blue-700" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
