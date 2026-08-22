import { Users, Bot, Sparkles, Trophy } from 'lucide-react';
import { MainTab } from './Header';

interface BottomNavProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  matchesCount?: number;
  attendeesCount?: number;
}

export default function BottomNav({
  activeTab,
  setActiveTab,
  matchesCount = 0,
  attendeesCount = 0,
}: BottomNavProps) {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-stone-200 shadow-lg pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-2">
        {/* Tab 1: My Agent */}
        <button
          type="button"
          id="mobile-tab-agent"
          onClick={() => setActiveTab('agent')}
          className={`flex flex-col items-center justify-center gap-1 relative py-1 transition-colors cursor-pointer ${
            activeTab === 'agent'
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
          }`}
        >
          <div className="relative">
            <Sparkles
              className={`w-5 h-5 transition-transform ${
                activeTab === 'agent' ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            {activeTab === 'agent' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900" />
            )}
          </div>
          <span className="text-[11px] tracking-tight leading-none">My Agent</span>
        </button>

        {/* Tab 2: Live Mingle */}
        <button
          type="button"
          id="mobile-tab-mingle"
          onClick={() => setActiveTab('mingle')}
          className={`flex flex-col items-center justify-center gap-1 relative py-1 transition-colors cursor-pointer ${
            activeTab === 'mingle'
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
          }`}
        >
          <div className="relative">
            <Bot
              className={`w-5 h-5 transition-transform ${
                activeTab === 'mingle' ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            {activeTab === 'mingle' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900" />
            )}
          </div>
          <span className="text-[11px] tracking-tight leading-none">Live Mingle</span>
        </button>

        {/* Tab 3: Room Directory */}
        <button
          type="button"
          id="mobile-tab-directory"
          onClick={() => setActiveTab('directory')}
          className={`flex flex-col items-center justify-center gap-1 relative py-1 transition-colors cursor-pointer ${
            activeTab === 'directory'
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
          }`}
        >
          <div className="relative">
            <Users
              className={`w-5 h-5 transition-transform ${
                activeTab === 'directory' ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            {attendeesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] text-center text-[9px] font-bold rounded-full bg-stone-200 text-stone-800 leading-tight">
                {attendeesCount}
              </span>
            )}
            {activeTab === 'directory' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900" />
            )}
          </div>
          <span className="text-[11px] tracking-tight leading-none">Room</span>
        </button>

        {/* Tab 4: Matches Feed */}
        <button
          type="button"
          id="mobile-tab-matches"
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center justify-center gap-1 relative py-1 transition-colors cursor-pointer ${
            activeTab === 'matches'
              ? 'text-amber-900 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
          }`}
        >
          <div className="relative">
            <Trophy
              className={`w-5 h-5 transition-transform ${
                activeTab === 'matches'
                  ? 'scale-110 stroke-[2.25] text-amber-600'
                  : 'stroke-[1.75]'
              }`}
            />
            {matchesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] text-center text-[9px] font-extrabold rounded-full bg-amber-500 text-white leading-tight">
                {matchesCount}
              </span>
            )}
            {activeTab === 'matches' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-600" />
            )}
          </div>
          <span className="text-[11px] tracking-tight leading-none">Matches</span>
        </button>
      </div>
    </nav>
  );
}
