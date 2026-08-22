import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Bot,
  Sparkles,
  Edit3,
} from 'lucide-react';
import Header, { MainTab } from './components/Header';
import BottomNav from './components/BottomNav';
import MingleScreen from './components/MingleScreen';
import RoomDirectory from './components/RoomDirectory';
import MatchesFeed from './components/MatchesFeed';
import VoiceInput from './components/VoiceInput';
import SelfieCapture from './components/SelfieCapture';
import { Profile, AgentTone, AgentChatSession } from './types';

type OnboardingStep = 'landing' | 'form' | 'confirmed';

const TONES: Array<{ id: AgentTone; label: string; description: string; emoji: string }> = [
  { id: 'cool', label: 'Cool', emoji: '🕶️', description: 'Calm & sharp' },
  { id: 'warm', label: 'Warm', emoji: '🤝', description: 'Welcoming & helpful' },
  { id: 'quirky', label: 'Quirky', emoji: '✨', description: 'Witty & creative' },
  { id: 'direct', label: 'Direct', emoji: '🎯', description: 'Zero fluff, focused' },
  { id: 'curious', label: 'Curious', emoji: '🔍', description: 'Deep tech curiosity' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('agent');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('landing');

  // Form fields
  const [name, setName] = useState('');
  const [workingOn, setWorkingOn] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [agentTone, setAgentTone] = useState<AgentTone>('cool');
  const [openToTalk, setOpenToTalk] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isGeneratingName, setIsGeneratingName] = useState(false);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  // Attendees & Matches count for header
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [matchesCount, setMatchesCount] = useState(0);

  // Persistent Live Mingle State across tabs and page reloads
  const [liveSessions, setLiveSessions] = useState<AgentChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('smalltalk_live_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [numChatsToRun, setNumChatsToRun] = useState<number>(3);
  const [isMinglingRunning, setIsMinglingRunning] = useState<boolean>(false);
  const [activeViewingSessionId, setActiveViewingSessionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('smalltalk_live_sessions', JSON.stringify(liveSessions));
    } catch (e) {
      console.warn('Could not save live sessions:', e);
    }
  }, [liveSessions]);

  // Initial pair to pass to MingleScreen when jumping from Directory/Feed
  const [minglePair, setMinglePair] = useState<{ aId?: string; bId?: string }>({});

  const loadEventData = async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/profiles').then((r) => r.json()).catch(() => ({})),
        fetch('/api/matches').then((r) => r.json()).catch(() => ({})),
      ]);
      if (pRes.profiles && Array.isArray(pRes.profiles)) {
        setProfilesList(pRes.profiles);

        // Stale session check: if the locally saved agent no longer exists on
        // the server (e.g. after a data reset), wipe local state and start fresh.
        try {
          const saved = localStorage.getItem('smalltalk_current_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.id && !pRes.profiles.some((p: Profile) => p.id === parsed.id)) {
              localStorage.removeItem('smalltalk_current_profile');
              localStorage.removeItem('smalltalk_live_sessions');
              setActiveProfile(null);
              setLiveSessions([]);
              setName('');
              setWorkingOn('');
              setLookingFor('');
              setAgentTone('cool');
              setOpenToTalk(true);
              setPhoto(null);
              setOnboardingStep('landing');
            }
          }
        } catch (_) {}
      }
      if (mRes.matches && Array.isArray(mRes.matches)) {
        setMatchesCount(mRes.matches.length);
      }
    } catch (e) {
      console.warn('Failed loading event counts:', e);
    }
  };

  useEffect(() => {
    loadEventData();
    try {
      const saved = localStorage.getItem('smalltalk_current_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setActiveProfile(parsed);
          setName(parsed.name || '');
          setWorkingOn(parsed.working_on || '');
          setLookingFor(parsed.looking_for || '');
          setAgentTone(parsed.agent_tone || 'cool');
          setOpenToTalk(parsed.open_to_talk !== false);
          setPhoto(parsed.photo || null);
          // One agent per attendee: returning users land on their active agent, not onboarding
          setOnboardingStep('confirmed');
        }
      }
    } catch (e) {
      console.warn('Could not read saved profile:', e);
    }
  }, []);

  const handleStartEditAgent = (profileToEdit?: Profile | null) => {
    const p = profileToEdit || activeProfile;
    if (p) {
      setName(p.name || '');
      setWorkingOn(p.working_on || '');
      setLookingFor(p.looking_for || '');
      setAgentTone(p.agent_tone || 'cool');
      setOpenToTalk(p.open_to_talk !== false);
      setPhoto(p.photo || null);
    }
    setError(null);
    setOnboardingStep('form');
    setActiveTab('agent');
  };

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      let updateRes: Response | null = null;
      if (activeProfile && activeProfile.id) {
        // Update existing agent profile directly on the build form
        updateRes = await fetch(`/api/profiles/${activeProfile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || 'You',
            working_on: workingOn.trim(),
            looking_for: lookingFor.trim(),
            open_to_talk: openToTalk,
            agent_tone: agentTone,
            photo: photo,
          }),
        });

        // Stale session: the stored agent no longer exists on the server.
        // Fall through to creating a fresh one instead of erroring.
        if (updateRes.status === 404) {
          setActiveProfile(null);
          try {
            localStorage.removeItem('smalltalk_current_profile');
          } catch (_) {}
          updateRes = null;
        }
      }

      if (updateRes) {
        const res = updateRes;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update agent');
        }

        const data = await res.json();
        const updated = data.profile || {
          ...activeProfile,
          name: name.trim() || 'You',
          working_on: workingOn.trim(),
          looking_for: lookingFor.trim(),
          open_to_talk: openToTalk,
          agent_tone: agentTone,
        };

        setActiveProfile(updated);
        try {
          localStorage.setItem('smalltalk_current_profile', JSON.stringify(updated));
        } catch (_) {}
      } else {
        // Create new agent profile
        const res = await fetch('/api/capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim() || 'You',
            working_on_raw: workingOn.trim(),
            looking_for_raw: lookingFor.trim(),
            open_to_talk: openToTalk,
            agent_tone: agentTone,
            photo: photo || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create agent');
        }

        const data = await res.json();
        if (data.profile) {
          setActiveProfile(data.profile);
          try {
            localStorage.setItem('smalltalk_current_profile', JSON.stringify(data.profile));
          } catch (_) {}
        }
      }

      setOnboardingStep('confirmed');
      loadEventData();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateName = async () => {
    setIsGeneratingName(true);
    try {
      const res = await fetch('/api/generate-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          working_on: workingOn.trim(),
          looking_for: lookingFor.trim(),
          tone: agentTone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setName(data.name);
        }
      }
    } catch (e) {
      console.error('Failed generating name:', e);
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleMingleWithAttendee = (targetId: string) => {
    const myId = activeProfile?.id || (profilesList[0]?.id !== targetId ? profilesList[0]?.id : profilesList[1]?.id);
    setMinglePair({ aId: myId, bId: targetId });
    setActiveTab('mingle');
  };

  const handleReplayMatchPair = (aId: string, bId: string) => {
    setMinglePair({ aId, bId });
    setActiveTab('mingle');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/90 text-stone-900 selection:bg-stone-200">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        attendeesCount={profilesList.length}
        matchesCount={matchesCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-8">
        {/* TAB 1: MY AGENT / CHECK-IN */}
        {activeTab === 'agent' && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            {/* Active Attendee Profile Card (if one exists) */}
            {activeProfile && onboardingStep !== 'form' && (
              <div className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  {activeProfile.photo ? (
                    <img
                      src={activeProfile.photo}
                      alt={activeProfile.name}
                      className="w-10 h-10 rounded-xl object-cover border border-stone-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-bold text-sm shrink-0">
                      {activeProfile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-stone-900 text-sm truncate">
                        {activeProfile.name}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                        {activeProfile.agent_tone || 'cool'} agent
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                        <span>Active</span>
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {activeProfile.working_on || 'No project description'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartEditAgent(activeProfile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold border border-stone-200 transition shrink-0 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            )}

            {/* STEP 1: Landing Screen */}
            {onboardingStep === 'landing' && (
              <section
                id="landing-screen"
                className="bg-white border border-stone-200/80 rounded-3xl p-4 sm:p-6 shadow-xs text-center space-y-4 animate-in fade-in duration-300"
              >
                <div className="space-y-1.5 pt-0.5">
                  <h1
                    id="landing-title"
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900"
                  >
                    Skip the small talk.
                  </h1>
                  <p
                    id="landing-tagline"
                    className="text-stone-600 text-xs sm:text-sm max-w-md mx-auto leading-relaxed"
                  >
                    Set up your agent in 30 seconds. It talks to other attendees' agents in the background helping you find people you should meet.
                  </p>
                </div>

                {/* 3 Compact Feature Cards */}
                <div className="grid grid-cols-1 gap-2 text-left pt-0.5">
                  {/* Feature Card 1 */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-3">
                    <span className="text-lg shrink-0 select-none">🤝</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-stone-900 leading-tight">Live Agent Conversations</h4>
                      <p className="text-[11px] text-stone-600 leading-snug">
                        Your agent runs a real 4-turn conversation with theirs, digging into specifics
                      </p>
                    </div>
                  </div>

                  {/* Feature Card 2 */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-3">
                    <span className="text-lg shrink-0 select-none">💡</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-stone-900 leading-tight">A Reason, Not Just a Name</h4>
                      <p className="text-[11px] text-stone-600 leading-snug">
                        Every introduction comes with talking points, based on the conversations
                      </p>
                    </div>
                  </div>

                  {/* Feature Card 3 */}
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex items-start gap-3">
                    <span className="text-lg shrink-0 select-none">🛡️</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-stone-900 leading-tight">Opt out anytime</h4>
                      <p className="text-[11px] text-stone-600 leading-snug">
                        Toggle 'open to talk' anytime if you'd prefer not to be matched
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="pt-1">
                  <button
                    id="join-mingle-btn"
                    type="button"
                    onClick={() => setOnboardingStep('form')}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm sm:text-base font-semibold text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <span>Build My Agent</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2: Onboarding Form */}
            {onboardingStep === 'form' && (
              <section
                id="capture-screen"
                className="bg-white border border-stone-200/80 rounded-3xl p-4 sm:p-6 shadow-xs animate-in fade-in duration-200 space-y-4"
              >
                <header className="flex items-center gap-3 border-b border-stone-100 pb-3">
                  <button
                    type="button"
                    onClick={() => setOnboardingStep(activeProfile ? 'confirmed' : 'landing')}
                    className="p-2 -ml-1 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl transition cursor-pointer shrink-0"
                    title="Back"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 id="capture-title" className="text-lg font-bold text-stone-900 tracking-tight">
                      {activeProfile ? 'Edit Your Agent' : 'Deploy Your Agent'}
                    </h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Tell your agent what you're working on and who to look for.
                    </p>
                  </div>
                </header>

                {error && (
                  <div
                    id="capture-error"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleCaptureSubmit} className="space-y-4">
                  {/* Voice onboarding */}
                  <div className="space-y-2">
                    <VoiceInput
                      onExtracted={(d) => {
                        if (d.working_on) setWorkingOn(d.working_on);
                        if (d.looking_for) setLookingFor(d.looking_for);
                        if (d.name && !name.trim()) setName(d.name);
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-stone-200"></div>
                      <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        or type it out
                      </span>
                      <div className="flex-1 h-px bg-stone-200"></div>
                    </div>
                  </div>

                  {/* What are you working on ? */}
                  <div>
                    <label
                      htmlFor="capture-working-on"
                      className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5"
                    >
                      What are you working on ?
                    </label>
                    <textarea
                      id="capture-working-on"
                      rows={3}
                      value={workingOn}
                      onChange={(e) => setWorkingOn(e.target.value)}
                      placeholder="e.g. Building an open-source evaluation benchmark and agent runtime"
                      className="w-full px-4 py-3 bg-stone-50/80 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm sm:text-base leading-relaxed transition resize-none min-h-[90px]"
                    />
                  </div>

                  {/* Who would you like to meet ? */}
                  <div>
                    <label
                      htmlFor="capture-looking-for"
                      className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5"
                    >
                      Who would you like to meet ?
                    </label>
                    <textarea
                      id="capture-looking-for"
                      rows={3}
                      value={lookingFor}
                      onChange={(e) => setLookingFor(e.target.value)}
                      placeholder="e.g. Looking to meet engineers experimenting with agent compilers & sandboxes"
                      className="w-full px-4 py-3 bg-stone-50/80 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm sm:text-base leading-relaxed transition resize-none min-h-[90px]"
                    />
                  </div>

                  {/* Agent Personality Persona - Compact Pills with Selected Description */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                      Agent Personality Persona
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {TONES.map((t) => {
                        const isSelected = agentTone === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAgentTone(t.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-stone-900 text-stone-50 shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/70'
                            }`}
                          >
                            <span className="text-sm leading-none">{t.emoji}</span>
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Description Display */}
                    {(() => {
                      const activeObj = TONES.find((t) => t.id === agentTone);
                      return activeObj ? (
                        <div className="mt-2 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 flex items-center gap-2 animate-in fade-in duration-200">
                          <span className="font-bold text-stone-900">
                            {activeObj.label}:
                          </span>
                          <span>{activeObj.description}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Name field with AI generator */}
                  <div>
                    <label
                      htmlFor="capture-name"
                      className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5"
                    >
                      Your Name
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="capture-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Chen"
                        className="flex-1 px-4 py-2.5 bg-stone-50/80 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm sm:text-base transition"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateName}
                        disabled={isGeneratingName}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 font-semibold text-xs sm:text-sm border border-stone-200/80 transition cursor-pointer shrink-0 disabled:opacity-50"
                        title="Generate name with AI"
                      >
                        {isGeneratingName ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        )}
                        <span>Generate</span>
                      </button>
                    </div>
                  </div>

                  {/* Profile Selfie */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                      Profile Photo
                    </label>
                    <SelfieCapture photo={photo} onCapture={setPhoto} />
                  </div>

                  {/* Consent Toggle */}
                  <div className="pt-2 pb-1 border-t border-stone-100">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="capture-match-toggle"
                        className="text-xs sm:text-sm font-semibold text-stone-800 cursor-pointer block"
                      >
                        Open to introductions
                      </label>
                      <button
                        id="capture-match-toggle"
                        type="button"
                        role="switch"
                        aria-checked={openToTalk}
                        onClick={() => setOpenToTalk(!openToTalk)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                          openToTalk ? 'bg-emerald-500' : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out ${
                            openToTalk ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="pt-2">
                    <button
                      id="capture-submit-btn"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-semibold text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-xs"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{activeProfile ? 'Updating AI agent...' : 'Deploying AI agent...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{activeProfile ? 'Save & Update Agent' : 'Activate My Agent'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* STEP 3: Confirmed Screen */}
            {onboardingStep === 'confirmed' && (
              <section
                id="confirmed-screen"
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 shadow-xs text-center space-y-5 animate-in fade-in duration-300"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 mb-1">
                  <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Agent Active
                  </span>
                  <h2
                    id="confirmed-title"
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 pt-1"
                  >
                    You're ready to mingle.
                  </h2>
                  <p
                    id="confirmed-message"
                    className="text-stone-600 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed"
                  >
                    Your {activeProfile?.agent_tone || 'cool'} agent is registered in the event pool and discovering complementary builders.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeProfile) {
                        setMinglePair({ aId: activeProfile.id });
                      }
                      setActiveTab('mingle');
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 text-sm font-semibold text-stone-50 bg-stone-900 hover:bg-stone-800 rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Watch Your Agent Mingle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
                  >
                    <span>Browse Room Directory</span>
                  </button>

                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: LIVE MINGLE */}
        {activeTab === 'mingle' && (
          <MingleScreen
            currentProfile={activeProfile}
            initialProfileAId={minglePair.aId}
            initialProfileBId={minglePair.bId}
            onMatchFound={loadEventData}
            onGoToAgentSetup={() => setActiveTab('agent')}
            chatSessions={liveSessions}
            setChatSessions={setLiveSessions}
            numChatsToRun={numChatsToRun}
            setNumChatsToRun={setNumChatsToRun}
            isRunning={isMinglingRunning}
            setIsRunning={setIsMinglingRunning}
            selectedSessionId={activeViewingSessionId}
            setSelectedSessionId={setActiveViewingSessionId}
          />
        )}

        {/* TAB 3: ROOM DIRECTORY */}
        {activeTab === 'directory' && (
          <RoomDirectory
            profiles={profilesList}
            currentProfileId={activeProfile?.id}
            onMingleWith={handleMingleWithAttendee}
            onEditProfile={(p) => handleStartEditAgent(p)}
          />
        )}

        {/* TAB 4: CONFIRMED MATCHES FEED */}
        {activeTab === 'matches' && (
          <MatchesFeed onStartMingleWithPair={handleReplayMatchPair} />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        attendeesCount={profilesList.length}
        matchesCount={matchesCount}
      />
    </div>
  );
}
