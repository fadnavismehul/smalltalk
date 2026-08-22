import { useState, useEffect, useRef } from 'react';
import { Bot, RefreshCw, CheckCircle2, XCircle, Play, ShieldAlert } from 'lucide-react';
import { Profile, TranscriptMessage, MatchDecision } from '../types';

export default function MingleScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileAId, setProfileAId] = useState<string>('');
  const [profileBId, setProfileBId] = useState<string>('');
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  // Mingle state
  const [isMingling, setIsMingling] = useState(false);
  const [currentTurnSpeaker, setCurrentTurnSpeaker] = useState<'A' | 'B' | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [decision, setDecision] = useState<MatchDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  const fetchProfiles = async (forceSeed = false) => {
    try {
      setIsLoadingProfiles(true);
      setError(null);
      
      const endpoint = forceSeed ? '/api/profiles/seed' : '/api/profiles';
      const method = forceSeed ? 'POST' : 'GET';
      
      const res = await fetch(endpoint, { method });
      const data = await res.json();
      if (data.profiles && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        if (data.profiles.length >= 2) {
          // Set to first two distinct profiles if current selection is empty or same
          setProfileAId((prevA) => {
            const exists = data.profiles.some((p: Profile) => p.id === prevA);
            return exists && prevA ? prevA : data.profiles[0].id;
          });
          setProfileBId((prevB) => {
            const exists = data.profiles.some((p: Profile) => p.id === prevB);
            if (exists && prevB && prevB !== data.profiles[0].id) {
              return prevB;
            }
            return data.profiles[1].id;
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
      setError('Could not load attendees. Please click "Refresh Pool" to retry.');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles(true); // Seed and fetch on mount
  }, []);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentTurnSpeaker, decision]);

  const profileA = profiles.find((p) => p.id === profileAId);
  const profileB = profiles.find((p) => p.id === profileBId);

  const isProfileAIneligible = profileA && profileA.open_to_talk === false;
  const isProfileBIneligible = profileB && profileB.open_to_talk === false;
  const isPairIneligible = Boolean(isProfileAIneligible || isProfileBIneligible);

  const handleStartMingling = async () => {
    if (!profileA || !profileB) return;
    if (profileA.id === profileB.id) {
      setError('Please select two different attendees to mingle.');
      return;
    }

    // Step 3 Requirement: Hard gate on open_to_talk before negotiation runs
    if (profileA.open_to_talk === false || profileB.open_to_talk === false) {
      const ineligibleNames =
        profileA.open_to_talk === false && profileB.open_to_talk === false
          ? `${profileA.name} and ${profileB.name}`
          : profileA.open_to_talk === false
          ? profileA.name
          : profileB.name;
      setError(`Not eligible for negotiation: ${ineligibleNames} indicated they are not open to introductions today.`);
      return;
    }

    setIsMingling(true);
    setError(null);
    setTranscript([]);
    setDecision(null);

    const currentTranscript: TranscriptMessage[] = [];
    const turns: Array<'A' | 'B'> = ['A', 'B', 'A', 'B']; // Cap negotiation at 4 turns max

    try {
      for (let i = 0; i < turns.length; i++) {
        const speaker = turns[i];
        setCurrentTurnSpeaker(speaker);

        // Small organic pacing delay between turns
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        const res = await fetch('/api/negotiate-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileA,
            profileB,
            transcript_so_far: currentTranscript,
            speaker,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Negotiation turn failed to generate.');
        }

        const data = await res.json();
        const newMessage: TranscriptMessage = {
          speaker,
          name: speaker === 'A' ? profileA.name : profileB.name,
          text: data.message || 'Exploring common ground...',
          timestamp: Date.now(),
        };

        currentTranscript.push(newMessage);
        setTranscript([...currentTranscript]);
      }

      setCurrentTurnSpeaker(null);

      // Call negotiate-decide passing the full 4-turn transcript
      const decideRes = await fetch('/api/negotiate-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileA,
          profileB,
          full_transcript: currentTranscript,
        }),
      });

      if (!decideRes.ok) {
        throw new Error('Failed to evaluate match decision.');
      }

      const decideData: MatchDecision = await decideRes.json();
      setDecision(decideData);
    } catch (err: any) {
      console.error('Mingling error:', err);
      setError(err?.message || 'Error occurred during agent negotiation.');
    } finally {
      setIsMingling(false);
      setCurrentTurnSpeaker(null);
    }
  };

  const handleReset = () => {
    setTranscript([]);
    setDecision(null);
    setError(null);
    setIsMingling(false);
    setCurrentTurnSpeaker(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Control Panel / Attendee Selection */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-stone-700 stroke-[1.75]" />
              <span>Live Agent Mingle</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Simulate 1-on-1 agent negotiation to evaluate attendee synergy.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="test-consent-gate-btn"
              onClick={async () => {
                const inactiveProfile = profiles.find((p) => p.open_to_talk === false) || {
                  id: 'test-inactive-mock',
                  name: 'Alex Rivera (Opted Out)',
                  working_on: 'Solo sprint',
                  interest_tags: ['CUDA'],
                  looking_for: 'Solo hacking',
                  open_to_talk: false,
                };
                const activeProfile = profiles.find((p) => p.open_to_talk !== false) || profiles[0];
                
                console.log('[Consent Gate Test] Triggering test against opted-out profile:', inactiveProfile.name);
                try {
                  const res = await fetch('/api/negotiate-turn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      profileA: activeProfile,
                      profileB: inactiveProfile,
                      transcript_so_far: [],
                      speaker: 'A',
                    }),
                  });
                  const data = await res.json();
                  console.log('[Consent Gate Test] Response status:', res.status, data);
                  if (res.status === 400 && (data.error === 'not_eligible' || data.error)) {
                    setError(`[Consent Gate Verified] Server blocked negotiation instantly (HTTP 400): "${data.message || data.error}". Zero Gemini API calls executed.`);
                  } else {
                    setError(`[Consent Gate Test] Unexpected response: ${JSON.stringify(data)}`);
                  }
                } catch (e: any) {
                  console.error('[Consent Gate Test Error]:', e);
                  setError(`[Consent Gate Test] Request error: ${e.message}`);
                }
              }}
              disabled={isMingling || isLoadingProfiles}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Test Consent Gate Check"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Test Consent Gate</span>
            </button>
            <button
              type="button"
              onClick={() => fetchProfiles(true)}
              disabled={isMingling || isLoadingProfiles}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Reload attendee pool"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProfiles ? 'animate-spin' : ''}`} />
              <span>Refresh Pool</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {isPairIneligible && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <div>
              <span className="font-semibold">Not eligible for negotiation: </span>
              {isProfileAIneligible && isProfileBIneligible
                ? `${profileA?.name} and ${profileB?.name} have both opted out of live networking.`
                : isProfileAIneligible
                ? `${profileA?.name} has opted out of live networking.`
                : `${profileB?.name} has opted out of live networking.`}
            </div>
          </div>
        )}

        {/* Profile Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* Profile A */}
          <div className={`p-3.5 rounded-xl border transition space-y-2 ${isProfileAIneligible ? 'bg-amber-50/40 border-amber-200' : 'bg-stone-50/80 border-stone-200'}`}>
            <div className="flex items-center justify-between">
              <label htmlFor="select-profile-a" className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Attendee A
              </label>
              <div className="flex items-center gap-1.5">
                {isProfileAIneligible && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                    Not open to talk
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-medium">
                  Agent A
                </span>
              </div>
            </div>
            <select
              id="select-profile-a"
              value={profileAId}
              disabled={isMingling || isLoadingProfiles}
              onChange={(e) => {
                const newA = e.target.value;
                setProfileAId(newA);
                if (newA === profileBId) {
                  const alt = profiles.find((p) => p.id !== newA);
                  if (alt) setProfileBId(alt.id);
                }
                handleReset();
              }}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:bg-stone-100 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.open_to_talk === false ? '(Not open to talk)' : ''} ({p.working_on.slice(0, 28)}...)
                </option>
              ))}
            </select>
            {profileA && (
              <p className="text-xs text-stone-600 leading-relaxed pt-1 line-clamp-2">
                <span className="font-medium text-stone-800">{profileA.name}:</span> {profileA.working_on}
              </p>
            )}
          </div>

          {/* Profile B */}
          <div className={`p-3.5 rounded-xl border transition space-y-2 ${isProfileBIneligible ? 'bg-amber-50/40 border-amber-200' : 'bg-stone-50/80 border-stone-200'}`}>
            <div className="flex items-center justify-between">
              <label htmlFor="select-profile-b" className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Attendee B
              </label>
              <div className="flex items-center gap-1.5">
                {isProfileBIneligible && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                    Not open to talk
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-medium">
                  Agent B
                </span>
              </div>
            </div>
            <select
              id="select-profile-b"
              value={profileBId}
              disabled={isMingling || isLoadingProfiles}
              onChange={(e) => {
                const newB = e.target.value;
                setProfileBId(newB);
                if (newB === profileAId) {
                  const alt = profiles.find((p) => p.id !== newB);
                  if (alt) setProfileAId(alt.id);
                }
                handleReset();
              }}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:bg-stone-100 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.open_to_talk === false ? '(Not open to talk)' : ''} ({p.working_on.slice(0, 28)}...)
                </option>
              ))}
            </select>
            {profileB && (
              <p className="text-xs text-stone-600 leading-relaxed pt-1 line-clamp-2">
                <span className="font-medium text-stone-800">{profileB.name}:</span> {profileB.working_on}
              </p>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            id="start-mingling-btn"
            type="button"
            disabled={isMingling || !profileA || !profileB || profileA.id === profileB.id || isPairIneligible}
            onClick={handleStartMingling}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            {isMingling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Agents Mingling in Background...</span>
              </>
            ) : isPairIneligible ? (
              <span>Attendee Ineligible (Not Open to Introductions)</span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Mingling</span>
              </>
            )}
          </button>

          {(transcript.length > 0 || decision) && !isMingling && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-3 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* Live Conversation Transcript */}
      {(transcript.length > 0 || currentTurnSpeaker) && (
        <section id="transcript-section" className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-900 tracking-tight flex items-center gap-2">
              <span>Agent Exchange Transcript</span>
              <span className="text-xs font-normal text-stone-500">
                ({transcript.length}/4 turns)
              </span>
            </h3>
            {isMingling && (
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active Negotiation</span>
              </span>
            )}
          </div>

          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {transcript.map((msg, index) => {
              const isA = msg.speaker === 'A';
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isA ? 'items-start' : 'items-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-stone-500 font-medium">
                    <span>{msg.name}'s Agent</span>
                    <span className="text-[10px] text-stone-400">• Turn {index + 1}</span>
                  </div>
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isA
                        ? 'bg-stone-100 text-stone-900 rounded-tl-sm'
                        : 'bg-stone-900 text-stone-50 rounded-tr-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Current speaking typing bubble */}
            {currentTurnSpeaker && (
              <div
                className={`flex flex-col ${currentTurnSpeaker === 'A' ? 'items-start' : 'items-end'} animate-in fade-in duration-200`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-stone-500 font-medium">
                  <span>
                    {currentTurnSpeaker === 'A' ? profileA?.name : profileB?.name}'s Agent is formulating...
                  </span>
                </div>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm ${
                    currentTurnSpeaker === 'A'
                      ? 'bg-stone-100 text-stone-600 rounded-tl-sm'
                      : 'bg-stone-800 text-stone-300 rounded-tr-sm'
                  }`}
                >
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}

            <div ref={transcriptBottomRef} />
          </div>
        </section>
      )}

      {/* Match Decision Reveal Screen */}
      {decision && (
        <section id="decision-section" className="animate-in fade-in slide-in-from-bottom-3 duration-300">
          {decision.matched ? (
            /* True Case: Celebratory Match Payoff Screen */
            <div className="bg-stone-950 text-stone-50 border border-stone-800 rounded-3xl p-7 sm:p-10 shadow-xl text-center relative overflow-hidden">
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

              <div className="space-y-6 max-w-xl mx-auto">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-7 h-7 stroke-[2]" />
                </div>

                <div className="space-y-2">
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3.5 py-1 rounded-full border border-emerald-700/50">
                    Match Confirmed • Introduction Created
                  </span>
                  
                  <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-50 pt-1">
                    {profileA?.name} <span className="text-emerald-400 font-light">&</span> {profileB?.name}
                  </h3>
                </div>

                {/* Generated Reason Line - Front and Center */}
                <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-5 sm:p-6 text-left space-y-2 shadow-inner">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                    Why you two should connect
                  </span>
                  <p className="text-base sm:text-lg text-stone-100 font-medium leading-relaxed">
                    "{decision.reason}"
                  </p>
                </div>

                <p className="text-xs text-stone-400 pt-1">
                  Match recorded in event database. Go find each other on the floor!
                </p>
              </div>
            </div>
          ) : (
            /* False Case: Calm, Visually Distinct Rejection State */
            <div className="bg-stone-100/90 border border-stone-200 rounded-2xl p-6 sm:p-8 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stone-200 text-stone-500 mb-1">
                <XCircle className="w-5 h-5 stroke-[1.75]" />
              </div>

              <h3 className="text-lg font-semibold text-stone-800 tracking-tight">
                No strong overlap this time
              </h3>

              <p className="text-stone-600 text-sm max-w-md mx-auto leading-relaxed">
                {decision.reason || 'Their current project focus areas and event goals are in distinct directions.'}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
