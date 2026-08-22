import { Users, Bot, Sparkles, Trophy } from 'lucide-react';

export type MainTab = 'agent' | 'mingle' | 'directory' | 'matches';

interface HeaderProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  matchesCount?: number;
  attendeesCount?: number;
}

export default function Header({
  activeTab,
  setActiveTab,
  matchesCount = 0,
  attendeesCount = 0,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs tracking-tighter">
              st
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-tight text-stone-900 text-base sm:text-lg leading-none">
                smalltalk
              </span>
              <span className="text-[10px] text-stone-500 font-medium truncate hidden sm:block">
                Autonomous Event Introductions
              </span>
            </div>
          </div>

          {/* Mobile Right Badge / Quick Indicator */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-[11px] font-medium text-stone-700 active:bg-stone-200 transition cursor-pointer"
            >
              <Users className="w-3 h-3 text-stone-500" />
              <span>{attendeesCount} in Room</span>
            </button>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile, cleanly displayed on sm+) */}
          <nav className="hidden sm:flex items-center p-1 rounded-xl bg-stone-100 border border-stone-200/80 text-xs font-semibold">
            <button
              type="button"
              id="desktop-tab-agent"
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                activeTab === 'agent'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-700" />
              <span>My Agent</span>
            </button>

            <button
              type="button"
              id="desktop-tab-mingle"
              onClick={() => setActiveTab('mingle')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                activeTab === 'mingle'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-stone-700" />
              <span>Live Mingle</span>
            </button>

            <button
              type="button"
              id="desktop-tab-directory"
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                activeTab === 'directory'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-stone-700" />
              <span>Room</span>
              {attendeesCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-bold">
                  {attendeesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="desktop-tab-matches"
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                activeTab === 'matches'
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Matches</span>
              {matchesCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {matchesCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
