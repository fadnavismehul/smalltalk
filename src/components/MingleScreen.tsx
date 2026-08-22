import React, { useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { Profile, TranscriptMessage, MatchDecision, AgentChatSession } from '../types';

interface MingleScreenProps {
  currentProfile?: Profile | null;
  onMatchFound?: () => void;
  onGoToAgentSetup?: () => void;
  initialProfileBId?: string;
  initialProfileAId?: string;
  chatSessions: AgentChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<AgentChatSession[]>>;
  numChatsToRun: number;
  setNumChatsToRun: React.Dispatch<React.SetStateAction<number>>;
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSessionId: string | null;
  setSelectedSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

const TONE_EMOJIS: Record<string, string> = {
  cool: '🕶️',
  warm: '🤝',
  quirky: '✨',
  direct: '🎯',
  curious: '🔍',
};

export default function MingleScreen({
  currentProfile,
  onMatchFound,
  onGoToAgentSetup,
  initialProfileBId,
  chatSessions,
  setChatSessions,
  numChatsToRun,
  setNumChatsToRun,
  isRunning,
  setIsRunning,
  selectedSessionId,
  setSelectedSessionId,
}: MingleScreenProps) {
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = React.useState(true);
  
  const isRunningRef = useRef<boolean>(isRunning);
  isRunningRef.current = isRunning;

  // Load profiles from backend
  const fetchProfiles = async () => {
    try {
      setIsLoadingProfiles(true);
      const res = await fetch('/api/profiles');
      const data = await res.json();
      if (data.profiles && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Use only the user's explicitly configured profile (do not talk as a random person)
  const activeMyProfile: Profile | null = currentProfile || null;

  // Available candidate attendees in the room (strictly excluding oneself)
  const eligibleCandidates = useMemo(() => {
    if (!activeMyProfile) return [];
    return profiles.filter((p) => p.id !== activeMyProfile.id);
  }, [profiles, activeMyProfile]);

  // Adjust default count based on available candidates
  useEffect(() => {
    if (eligibleCandidates.length > 0 && numChatsToRun > eligibleCandidates.length) {
      setNumChatsToRun(eligibleCandidates.length);
    }
  }, [eligibleCandidates.length, numChatsToRun, setNumChatsToRun]);

  // Auto-trigger single attendee if redirected from Room directory with initialProfileBId
  useEffect(() => {
    if (initialProfileBId && activeMyProfile && profiles.length > 0) {
      const target = profiles.find((p) => p.id === initialProfileBId);
      if (target && target.id !== activeMyProfile.id && !chatSessions.some((s) => s.targetProfile.id === target.id)) {
        const singleSession: AgentChatSession = {
          id: `session-${Date.now()}-${target.id}`,
          targetProfile: target,
          myProfile: activeMyProfile,
          status: 'queued',
          currentTurn: 0,
          transcript: [],
        };
        setChatSessions((prev) => [singleSession, ...prev]);
        setSelectedSessionId(singleSession.id);
        runSessionsQueue([singleSession], activeMyProfile);
      }
    }
  }, [initialProfileBId, activeMyProfile, profiles]);

  // Execute a single chat session between My Agent and Target Agent
  const executeChat = async (
    session: AgentChatSession,
    myProfile: Profile,
    updateSession: (id: string, updater: (s: AgentChatSession) => AgentChatSession) => void
  ) => {
    const target = session.targetProfile;

    // Check consent gate
    if (myProfile.open_to_talk === false || target.open_to_talk === false) {
      updateSession(session.id, (s) => ({
        ...s,
        status: 'ineligible',
        error: `${target.name} has opted out of introductions.`,
      }));
      return;
    }

    updateSession(session.id, (s) => ({
      ...s,
      status: 'talking',
      startedAt: Date.now(),
      currentTurn: 0,
    }));

    const currentTranscript: TranscriptMessage[] = [];
    const turns: Array<'A' | 'B'> = ['A', 'B', 'A', 'B'];

    try {
      for (let i = 0; i < turns.length; i++) {
        if (!isRunningRef.current) {
          break;
        }

        const speaker = turns[i];
        updateSession(session.id, (s) => ({
          ...s,
          currentTurn: i + 1,
          currentSpeaker: speaker,
        }));

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        const res = await fetch('/api/negotiate-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileA: myProfile,
            profileB: target,
            transcript_so_far: currentTranscript,
            speaker,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Turn exchange failed.');
        }

        const data = await res.json();
        const newMessage: TranscriptMessage = {
          speaker,
          name: speaker === 'A' ? myProfile.name : target.name,
          text: data.message || 'Discussing common goals...',
          timestamp: Date.now(),
        };

        currentTranscript.push(newMessage);
        updateSession(session.id, (s) => ({
          ...s,
          transcript: [...currentTranscript],
        }));
      }

      if (!isRunningRef.current) return;

      // Evaluate match
      const decideRes = await fetch('/api/negotiate-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileA: myProfile,
          profileB: target,
          full_transcript: currentTranscript,
        }),
      });

      if (!decideRes.ok) {
        throw new Error('Failed to evaluate match.');
      }

      const decision: MatchDecision = await decideRes.json();

      updateSession(session.id, (s) => ({
        ...s,
        status: 'completed',
        decision,
        completedAt: Date.now(),
        currentSpeaker: undefined,
      }));

      if (decision.matched) {
        if (onMatchFound) onMatchFound();
      }
    } catch (err: any) {
      console.error('Chat execution failed:', err);
      updateSession(session.id, (s) => ({
        ...s,
        status: 'failed',
        error: err?.message || 'Chat interrupted.',
      }));
    }
  };

  // Run a queue of chat sessions sequentially
  const runSessionsQueue = async (sessions: AgentChatSession[], myProfile: Profile) => {
    setIsRunning(true);
    isRunningRef.current = true;

    const updateSession = (id: string, updater: (s: AgentChatSession) => AgentChatSession) => {
      setChatSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    };

    for (const session of sessions) {
      if (!isRunningRef.current) break;
      await executeChat(session, myProfile, updateSession);
      if (isRunningRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setIsRunning(false);
    isRunningRef.current = false;
  };

  // Handle "Go and Talk" or "Run New Round" button click
  const handleStartMingling = () => {
    if (!activeMyProfile) return;
    if (eligibleCandidates.length === 0) return;

    // Pick candidates for this round (excluding self)
    const openCandidates = [...eligibleCandidates].sort(() => 0.5 - Math.random());
    const selected = openCandidates.slice(0, Math.min(numChatsToRun, openCandidates.length));

    const newSessions: AgentChatSession[] = selected.map((target) => ({
      id: `session-${Date.now()}-${target.id}`,
      targetProfile: target,
      myProfile: activeMyProfile,
      status: 'queued',
      currentTurn: 0,
      transcript: [],
    }));

    setChatSessions(newSessions);
    runSessionsQueue(newSessions, activeMyProfile);
  };

  const handleStopMingling = () => {
    setIsRunning(false);
    isRunningRef.current = false;
  };

  // Filter out any stale sessions where target is oneself
  const cleanChatSessions = useMemo(() => {
    if (!activeMyProfile) return chatSessions;
    return chatSessions.filter((s) => s.targetProfile.id !== activeMyProfile.id);
  }, [chatSessions, activeMyProfile]);

  // Sort chat sessions so that MATCHES shift directly to the top!
  const sortedSessions = useMemo(() => {
    return [...cleanChatSessions].sort((a, b) => {
      const aIsMatch = a.status === 'completed' && a.decision?.matched === true;
      const bIsMatch = b.status === 'completed' && b.decision?.matched === true;

      // 1. Confirmed matches always at top
      if (aIsMatch && !bIsMatch) return -1;
      if (!aIsMatch && bIsMatch) return 1;

      // 2. Currently talking comes next
      if (a.status === 'talking' && b.status !== 'talking') return -1;
      if (a.status !== 'talking' && b.status === 'talking') return 1;

      // 3. Queued comes next
      if (a.status === 'queued' && b.status !== 'queued') return -1;
      if (a.status !== 'queued' && b.status === 'queued') return 1;

      return 0;
    });
  }, [cleanChatSessions]);

  const activeSelectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return cleanChatSessions.find((s) => s.id === selectedSessionId) || null;
  }, [selectedSessionId, cleanChatSessions]);

  const matchesFoundCount = useMemo(() => {
    return cleanChatSessions.filter((s) => s.status === 'completed' && s.decision?.matched === true).length;
  }, [cleanChatSessions]);

  const completedCount = useMemo(() => {
    return cleanChatSessions.filter((s) => s.status === 'completed').length;
  }, [cleanChatSessions]);

  // ==========================================
  // GATE: NO AGENT PROFILE SET UP YET
  // ==========================================
  if (!activeMyProfile) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200">
        <section className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center mx-auto shadow-xs">
            <Bot className="w-7 h-7 text-stone-900" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Set up your agent first
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Before entering Live Mingle, configure your attendee profile so your agent knows what you're working on and who you're looking to meet.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToAgentSetup}
              className="inline-flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-semibold text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded-xl transition cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Go to My Agent</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ==========================================
  // IN-PAGE TRANSCRIPT VIEW (Replaces list on this page)
  // ==========================================
  if (activeSelectedSession) {
    const target = activeSelectedSession.targetProfile;
    const isMatch = activeSelectedSession.status === 'completed' && activeSelectedSession.decision?.matched === true;
    const isNonMatch = activeSelectedSession.status === 'completed' && activeSelectedSession.decision?.matched === false;
    const isTalking = activeSelectedSession.status === 'talking';

    return (
      <div className="w-full max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200">
        {/* Back navigation header button */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setSelectedSessionId(null)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-950 py-1 px-2.5 -ml-2.5 rounded-xl hover:bg-stone-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Mingle List</span>
          </button>

          {isTalking && (
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-900 text-stone-50 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Turn {activeSelectedSession.currentTurn}/4 Live</span>
            </span>
          )}
        </div>

        {/* Main In-Page Conversation Card */}
        <section className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-xs ${
                  isMatch
                    ? 'bg-emerald-600 text-emerald-50'
                    : isTalking
                    ? 'bg-stone-900 text-stone-50'
                    : 'bg-stone-100 text-stone-800 border border-stone-200'
                }`}
              >
                {target.photo ? (
                  <img
                    src={target.photo}
                    alt={target.name}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  target.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-stone-900 text-lg sm:text-xl truncate">
                    {target.name}
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80 flex items-center gap-1">
                    <span>{TONE_EMOJIS[target.agent_tone || 'cool']}</span>
                    <span className="capitalize">{target.agent_tone || 'cool'}</span>
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Autonomous 4-Turn Agent Dialogue
                </p>
              </div>
            </div>

            {isMatch && (
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Match Confirmed</span>
              </span>
            )}
          </div>

          {/* Confirmed Match Rationale Banner */}
          {isMatch && activeSelectedSession.decision && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-left space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Why you two should connect</span>
              </div>
              <p className="text-xs sm:text-sm text-stone-900 font-medium leading-relaxed">
                "{activeSelectedSession.decision.reason}"
              </p>
            </div>
          )}

          {/* Non-match Rationale Banner */}
          {isNonMatch && activeSelectedSession.decision && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-left text-xs text-stone-600 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-800 block mb-0.5">No match this round</span>
                <span>{activeSelectedSession.decision.reason || 'Agents determined low overlap for this session.'}</span>
              </div>
            </div>
          )}

          {/* Target Attendee Details */}
          <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/70 text-xs sm:text-sm text-stone-700 space-y-2">
            <div>
              <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px] block mb-0.5">
                What they're working on
              </span>
              <p className="text-stone-700 leading-relaxed">{target.working_on}</p>
            </div>

            {target.looking_for && (
              <div className="pt-2 border-t border-stone-200/60">
                <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px] block mb-0.5">
                  Who they'd like to meet
                </span>
                <p className="text-stone-700 leading-relaxed">{target.looking_for}</p>
              </div>
            )}
          </div>

          {/* Transcript Dialogue Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-500 px-1">
              <span>Dialogue Exchange</span>
              <span className="font-medium text-stone-400 normal-case">
                {activeSelectedSession.transcript.length} turns recorded
              </span>
            </div>

            {activeSelectedSession.transcript.length === 0 ? (
              <div className="py-10 text-center text-xs text-stone-400 space-y-2 bg-stone-50/50 rounded-2xl border border-stone-100">
                <MessageSquare className="w-7 h-7 mx-auto text-stone-300" />
                <p>Agent negotiation is queued and will begin shortly...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSelectedSession.transcript.map((msg, idx) => {
                  const isMe = msg.speaker === 'A';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}
                    >
                      <div className="text-[10px] text-stone-500 font-medium px-1 mb-1 flex items-center gap-1">
                        <span>
                          {isMe
                            ? `${activeMyProfile.name}'s Agent (You)`
                            : `${target.name}'s Agent`}
                        </span>
                        <span>• Turn {idx + 1}</span>
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[88%] ${
                          isMe
                            ? 'bg-stone-100 text-stone-900 rounded-tl-xs border border-stone-200/70'
                            : 'bg-stone-900 text-stone-50 rounded-tr-xs shadow-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active speaking indicator */}
            {isTalking && (
              <div className="flex items-center gap-2 text-xs text-stone-500 italic px-2 py-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {activeSelectedSession.currentSpeaker === 'A'
                    ? `${activeMyProfile.name}'s agent is replying...`
                    : `${target.name}'s agent is replying...`}
                </span>
              </div>
            )}
          </div>

          {/* Action to return */}
          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedSessionId(null)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-stone-50 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Mingle List</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ==========================================
  // MAIN MINGLE SCREEN (List of Chats & Controls)
  // ==========================================
  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Top Banner & Control Card */}
      <section
        id="mingle-control-card"
        className="bg-white border border-stone-200/80 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-stone-900" />
              <span>Live Agent Mingle</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Your agent reaches out to other attendees autonomously to discover high-value matches.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs shrink-0">
            <span className="font-semibold text-stone-800">{activeMyProfile.name}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-white text-stone-700 border border-stone-200 font-semibold flex items-center gap-1">
              <span>{TONE_EMOJIS[activeMyProfile.agent_tone || 'cool']}</span>
              <span className="capitalize">{activeMyProfile.agent_tone || 'cool'}</span>
            </span>
          </div>
        </div>

        {/* Number of chats selector (Available whenever not actively in the middle of talking) */}
        {!isRunning && (
          <div className="pt-3 border-t border-stone-100 space-y-2.5">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
              {cleanChatSessions.length > 0 ? 'Select number of chats for new round' : 'How many chats should your agent do?'}
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              {[2, 3, 5, Math.min(8, eligibleCandidates.length || 8)].map((num) => {
                if (num > (eligibleCandidates.length || 5) && num !== 2) return null;
                const isSelected = numChatsToRun === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumChatsToRun(num)}
                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-stone-50 shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/80'
                    }`}
                  >
                    {num} Chats
                  </button>
                );
              })}

              {eligibleCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNumChatsToRun(eligibleCandidates.length)}
                  className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    numChatsToRun === eligibleCandidates.length
                      ? 'bg-stone-900 text-stone-50 shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/80'
                  }`}
                >
                  All in Room ({eligibleCandidates.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Button: "Go and Talk" / "Run New Round" */}
        <div className="pt-1 flex items-center gap-2">
          {!isRunning ? (
            <button
              id="start-go-talk-btn"
              type="button"
              onClick={handleStartMingling}
              disabled={isLoadingProfiles || eligibleCandidates.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 text-sm sm:text-base font-semibold text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {cleanChatSessions.length === 0 ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Go and Talk ({numChatsToRun} Chats)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Run New Round ({numChatsToRun} Chats)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopMingling}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>Pause Mingle ({completedCount}/{cleanChatSessions.length} done)</span>
            </button>
          )}
        </div>

        {/* Live Progress Bar */}
        {cleanChatSessions.length > 0 && (
          <div className="pt-2 border-t border-stone-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
              <span className="flex items-center gap-1.5">
                {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                <span>
                  {isRunning
                    ? `Agent actively mingling (${completedCount}/${cleanChatSessions.length} chats completed)`
                    : `Completed ${completedCount} of ${cleanChatSessions.length} chats`}
                </span>
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                {matchesFoundCount} {matchesFoundCount === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-900 transition-all duration-300 ease-out"
                style={{
                  width: `${(completedCount / (cleanChatSessions.length || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* List of Chats */}
      {sortedSessions.length > 0 && (
        <section id="chats-list-section" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Agent Conversations ({sortedSessions.length})
            </h3>
            <span className="text-[11px] text-stone-400 font-medium">
              Matches shift to top • Click to view transcript
            </span>
          </div>

          <div className="space-y-2.5">
            {sortedSessions.map((session) => {
              const target = session.targetProfile;
              const isMatch = session.status === 'completed' && session.decision?.matched === true;
              const isNonMatch = session.status === 'completed' && session.decision?.matched === false;
              const isTalking = session.status === 'talking';
              const isQueued = session.status === 'queued';
              const isIneligible = session.status === 'ineligible';

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left bg-white border rounded-2xl p-4 sm:p-4.5 shadow-xs transition-all duration-200 cursor-pointer hover:shadow-sm flex items-center justify-between gap-3 ${
                    isMatch
                      ? 'border-emerald-500/80 bg-gradient-to-r from-emerald-50/30 via-white to-white ring-1 ring-emerald-500/20 hover:border-emerald-600'
                      : isTalking
                      ? 'border-stone-400 bg-stone-50/40 ring-1 ring-stone-900/10'
                      : 'border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Avatar */}
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                        isMatch
                          ? 'bg-emerald-600 text-emerald-50'
                          : isTalking
                          ? 'bg-stone-900 text-stone-50'
                          : 'bg-stone-100 text-stone-800 border border-stone-200'
                      }`}
                    >
                      {target.photo ? (
                        <img
                          src={target.photo}
                          alt={target.name}
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        target.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm sm:text-base truncate">
                          {target.name}
                        </span>

                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80 flex items-center gap-1">
                          <span>{TONE_EMOJIS[target.agent_tone || 'cool']}</span>
                          <span className="capitalize">{target.agent_tone || 'cool'}</span>
                        </span>

                        {/* Status Pills: Concise match / no match status without multiline text */}
                        {isMatch && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Match</span>
                          </span>
                        )}

                        {isTalking && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-900 text-stone-50 flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Turn {session.currentTurn}/4 Talking</span>
                          </span>
                        )}

                        {isQueued && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-500">
                            Queued
                          </span>
                        )}

                        {isNonMatch && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            No match
                          </span>
                        )}

                        {isIneligible && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            <span>Opted Out</span>
                          </span>
                        )}
                      </div>

                      {/* Attendee Focus */}
                      <p className="text-xs text-stone-600 line-clamp-1 truncate">
                        <span className="font-semibold text-stone-700">Focus: </span>
                        {target.working_on}
                      </p>
                    </div>
                  </div>

                  {/* Right Arrow */}
                  <div className="flex items-center gap-1 text-stone-400 shrink-0">
                    <span className="text-xs font-semibold text-stone-500 hidden sm:inline">
                      View
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty State before any chats have run */}
      {cleanChatSessions.length === 0 && !isRunning && (
        <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-amber-600" />
          </div>

          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              Ready to find your best matches
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Choose how many attendees you want your agent to converse with above and click{' '}
              <span className="font-semibold text-stone-900">"Go and Talk"</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
