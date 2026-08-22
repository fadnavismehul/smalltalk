import { useState } from 'react';
import { Search, Bot, Edit3 } from 'lucide-react';
import { Profile } from '../types';

interface RoomDirectoryProps {
  profiles: Profile[];
  currentProfileId?: string;
  onMingleWith: (targetProfileId: string) => void;
  onEditProfile: (profile: Profile) => void;
}

const TONE_EMOJIS: Record<string, string> = {
  cool: '🕶️',
  warm: '🤝',
  quirky: '✨',
  direct: '🎯',
  curious: '🔍',
};

export default function RoomDirectory({
  profiles,
  currentProfileId,
  onMingleWith,
  onEditProfile,
}: RoomDirectoryProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'inactive'>('all');

  const filtered = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.working_on.toLowerCase().includes(search.toLowerCase()) ||
      (p.interest_tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'open') return p.open_to_talk !== false;
    if (filter === 'inactive') return p.open_to_talk === false;
    return true;
  });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Header & Search Bar */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>Event Floor Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold border border-stone-200">
                {profiles.length} attendees
              </span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Browse attendees and test direct agent negotiations.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, project, or tag..."
            className="w-full pl-9.5 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 transition placeholder:text-stone-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              filter === 'all'
                ? 'bg-stone-900 text-stone-50 shadow-xs font-semibold'
                : 'bg-stone-100 text-stone-600 hover:text-stone-900'
            }`}
          >
            All ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('open')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              filter === 'open'
                ? 'bg-stone-900 text-stone-50 shadow-xs font-semibold'
                : 'bg-stone-100 text-stone-600 hover:text-stone-900'
            }`}
          >
            Open to Talk ({profiles.filter((p) => p.open_to_talk !== false).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              filter === 'inactive'
                ? 'bg-stone-900 text-stone-50 shadow-xs font-semibold'
                : 'bg-stone-100 text-stone-600 hover:text-stone-900'
            }`}
          >
            Opted Out ({profiles.filter((p) => p.open_to_talk === false).length})
          </button>
        </div>
      </div>

      {/* Attendees List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-stone-200/80 rounded-2xl p-8 text-center text-stone-500 text-sm">
            No attendees found matching "{search}".
          </div>
        ) : (
          filtered.map((p) => {
            const isMe = p.id === currentProfileId;
            const isOptedOut = p.open_to_talk === false;
            const toneEmoji = TONE_EMOJIS[p.agent_tone || 'cool'] || '🤖';

            return (
              <div
                key={p.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition space-y-3 ${
                  isMe
                    ? 'border-stone-400 bg-stone-50/40'
                    : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt={p.name}
                        className="w-10 h-10 rounded-xl object-cover border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-bold text-sm shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm sm:text-base truncate">
                          {p.name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-stone-900 text-stone-50">
                            You
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80 flex items-center gap-1">
                          <span>{toneEmoji}</span>
                          <span className="capitalize">{p.agent_tone || 'cool'} agent</span>
                        </span>
                        {isOptedOut && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/80 flex items-center gap-1">
                            <span>Opted Out</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                        {p.working_on}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tags & Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-stone-100">
                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(p.interest_tags || []).slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditProfile(p)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
                      title="Edit agent profile"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {!isOptedOut && (
                      <button
                        type="button"
                        onClick={() => onMingleWith(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-stone-50 hover:bg-stone-800 transition cursor-pointer shadow-xs"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Mingle With {p.name.split(' ')[0]}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
