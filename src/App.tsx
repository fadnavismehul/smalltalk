import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Users } from 'lucide-react';

type ScreenState = 'landing' | 'capture' | 'confirmed';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('landing');
  const [name, setName] = useState('');
  const [workingOn, setWorkingOn] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [openToTalk, setOpenToTalk] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          working_on_raw: workingOn.trim(),
          looking_for_raw: lookingFor.trim(),
          open_to_talk: openToTalk,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit preferences');
      }

      setScreen('confirmed');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-stone-50 text-stone-900 selection:bg-stone-200">
      <div className="w-full max-w-md mx-auto">
        {screen === 'landing' && (
          <section id="landing-screen" className="text-center space-y-8 animate-in fade-in duration-300">
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-200/80 text-stone-800 mb-2">
                <Users className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h1 id="landing-title" className="text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900">
                smalltalk
              </h1>
              <p id="landing-tagline" className="text-stone-600 text-base sm:text-lg max-w-xs mx-auto leading-relaxed">
                Connect with the right people at today’s event.
              </p>
            </div>

            <div className="pt-2">
              <button
                id="join-mingle-btn"
                type="button"
                onClick={() => setScreen('capture')}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded-xl transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
              >
                <span>Join the mingle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {screen === 'capture' && (
          <section id="capture-screen" className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs animate-in fade-in duration-200">
            <header className="mb-6">
              <h2 id="capture-title" className="text-xl font-semibold text-stone-900 tracking-tight">
                Tell us about you
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Help us introduce you to the right people.
              </p>
            </header>

            {error && (
              <div id="capture-error" className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="capture-name" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Name
                </label>
                <input
                  id="capture-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name or first name"
                  className="w-full px-3.5 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent text-sm transition"
                />
              </div>

              <div>
                <label htmlFor="capture-working-on" className="block text-sm font-medium text-stone-700 mb-1.5">
                  What are you building / working on today?
                </label>
                <textarea
                  id="capture-working-on"
                  rows={3}
                  value={workingOn}
                  onChange={(e) => setWorkingOn(e.target.value)}
                  placeholder="e.g. Building an open-source data agent for developers (1-2 sentences)"
                  className="w-full px-3.5 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent text-sm transition resize-none"
                />
              </div>

              <div>
                <label htmlFor="capture-looking-for" className="block text-sm font-medium text-stone-700 mb-1.5">
                  What do you want to get out of today?
                </label>
                <textarea
                  id="capture-looking-for"
                  rows={3}
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  placeholder="e.g. Looking for early feedback from AI engineers and potential co-founders (1-2 sentences)"
                  className="w-full px-3.5 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent text-sm transition resize-none"
                />
              </div>

              {/* Match toggle with explicit revocable label */}
              <div className="pt-2 pb-1 border-t border-stone-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <label htmlFor="capture-match-toggle" className="text-sm font-medium text-stone-800 cursor-pointer">
                      Open to being matched with someone today?
                    </label>
                    <p className="text-xs text-stone-500">
                      You can change or revoke this anytime during the event.
                    </p>
                  </div>
                  <button
                    id="capture-match-toggle"
                    type="button"
                    role="switch"
                    aria-checked={openToTalk}
                    onClick={() => setOpenToTalk(!openToTalk)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 ${
                      openToTalk ? 'bg-stone-900' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        openToTalk ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="capture-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-stone-50 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving preferences...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {screen === 'confirmed' && (
          <section id="confirmed-screen" className="text-center space-y-6 py-8 animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/70 mb-2">
              <CheckCircle2 className="w-8 h-8 stroke-[1.75]" />
            </div>

            <div className="space-y-3">
              <h2 id="confirmed-title" className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
                You're in.
              </h2>
              <p id="confirmed-message" className="text-stone-600 text-base sm:text-lg max-w-xs mx-auto leading-relaxed">
                We'll introduce you to someone worth meeting.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
