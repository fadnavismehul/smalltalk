import { useState, useEffect, useRef } from 'react';
import { Bot, RefreshCw, CheckCircle2, XCircle, Play } from 'lucide-react';
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

  const handleStartMingling = async () => {
    if (!profileA || !profileB) return;
    if (profileA.id === profileB.id) {
      setError('Please select two different attendees to mingle.');
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

        // Small pacing delay to feel organic
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
          throw new Error('Negotiation turn failed to generate.');
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

      // Call negotiate-decide
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

  const handleQuickPair = (idA: string, idB: string) => {
    if (isMingling) return;
    setProfileAId(idA);
    setProfileBId(idB);
    handleReset();
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

        {/* Profile Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* Profile A */}
          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="select-profile-a" className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Attendee A
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-medium">
                Agent A
              </span>
            </div>
            <select
              id="select-profile-a"
              value={profileAId}
              disabled={isMingling || isLoadingProfiles}
              onChange={(e) => {
                const newA = e.target.value;
                setProfileAId(newA);
                if (newA === profileBId) {
                  // Switch B to another distinct profile
                  const alt = profiles.find((p) => p.id !== newA);
                  if (alt) setProfileBId(alt.id);
                }
                handleReset();
              }}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:bg-stone-100 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.working_on.slice(0, 32)}...)
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
          <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="select-profile-b" className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Attendee B
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-medium">
                Agent B
              </span>
            </div>
            <select
              id="select-profile-b"
              value={profileBId}
              disabled={isMingling || isLoadingProfiles}
              onChange={(e) => {
                const newB = e.target.value;
                setProfileBId(newB);
                if (newB === profileAId) {
                  // Switch A to another distinct profile
                  const alt = profiles.find((p) => p.id !== newB);
                  if (alt) setProfileAId(alt.id);
                }
                handleReset();
              }}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:bg-stone-100 cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.working_on.slice(0, 32)}...)
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

        {/* Quick test pair shortcuts */}
        {profiles.length >= 4 && (
          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500 font-medium mr-1">Suggested Pairings:</span>
            <button
              type="button"
              disabled={isMingling}
              onClick={() => handleQuickPair(profiles[0]?.id, profiles[1]?.id)}
              className="px-2.5 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md transition disabled:opacity-50"
            >
              High Overlap: {profiles[0]?.name.split(' ')[0]} & {profiles[1]?.name.split(' ')[0]}
            </button>
            {profiles.length >= 4 && (
              <button
                type="button"
                disabled={isMingling}
                onClick={() => handleQuickPair(profiles[2]?.id, profiles[3]?.id)}
                className="px-2.5 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md transition disabled:opacity-50"
              >
                Domain Match: {profiles[2]?.name.split(' ')[0]} & {profiles[3]?.name.split(' ')[0]}
              </button>
            )}
          </div>
        )}

        {/* Action button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            id="start-mingling-btn"
            type="button"
            disabled={isMingling || !profileA || !profileB || profileA.id === profileB.id}
            onClick={handleStartMingling}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            {isMingling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Agents Mingling in Background...</span>
              </>
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
              className="px-4 py-3 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
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

      {/* Match Decision Reveal */}
      {decision && (
        <section id="decision-section" className="animate-in fade-in slide-in-from-bottom-3 duration-300">
          {decision.matched ? (
            <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 mb-1">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  You've been introduced
                </span>
                <h3 className="text-2xl font-bold text-stone-900 tracking-tight pt-2">
                  {profileA?.name} <span className="text-stone-400 font-light">&</span> {profileB?.name}
                </h3>
              </div>

              <p className="text-stone-700 text-base sm:text-lg leading-relaxed max-w-xl mx-auto pt-1 font-normal">
                "{decision.reason}"
              </p>

              <div className="pt-4">
                <p className="text-xs text-stone-500">
                  Both attendees have matching open willingness and complementary domains.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-6 sm:p-8 text-center space-y-3">
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
