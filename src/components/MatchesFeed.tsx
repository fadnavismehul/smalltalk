import { useEffect, useState } from 'react';
import { Trophy, RefreshCw, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { MatchRecord } from '../types';

interface MatchesFeedProps {
  onStartMingleWithPair?: (aId: string, bId: string) => void;
}

export default function MatchesFeed({ onStartMingleWithPair }: MatchesFeedProps) {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMatches = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (data.matches && Array.isArray(data.matches)) {
        setMatches(data.matches.reverse()); // most recent first
      }
    } catch (e) {
      console.error('Failed to load matches:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white border border-stone-200/80 rounded-2xl p-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>Event Introductions Feed</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Confirmed synergy matches formed through autonomous agent exchanges.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMatches}
          disabled={isLoading}
          className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
          title="Refresh matches"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 text-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-stone-400" />
          <p className="text-xs text-stone-500">Checking room matches...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-stone-900 text-sm sm:text-base">No matches recorded yet</h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Head to the Live Mingle tab to simulate agent negotiations and discover synergistic connections!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div
              key={m.matchId}
              className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 transition hover:border-stone-300"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Introduced</span>
                  </span>
                  <span className="text-xs text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {onStartMingleWithPair && (
                  <button
                    type="button"
                    onClick={() => onStartMingleWithPair(m.profileAId, m.profileBId)}
                    className="text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    Replay Mingle
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="font-bold text-stone-900 text-base sm:text-lg tracking-tight">
                  {m.profileAName} <span className="text-stone-400 font-normal">&</span> {m.profileBName}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60 text-xs sm:text-sm text-stone-700 leading-relaxed">
                <span className="font-semibold text-stone-900 block mb-0.5 text-[11px] uppercase tracking-wider">
                  Mutual Synergy Hook
                </span>
                "{m.reason}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
