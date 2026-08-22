Build the agent negotiation feature. Reuse the profile schema and Gemini
setup from step 1 — extend, don't replace.

1. Seed data: pre-load 5-10 sample profiles into the same store the
   capture form writes to (a couple of real teammate submissions plus a
   few hand-written extras is fine for testing).

2. Backend endpoint POST /api/negotiate-turn
   Input: { profileA, profileB, transcript_so_far (array), speaker: "A"|"B" }
   Call gemini-3.7-flash with a system instruction that the model is
   "profile [speaker]'s agent, mingling with another attendee's agent to
   find genuine shared ground for a possible introduction. Reply in 1-2
   short, natural sentences. Be curious and specific, not generic."
   Feed it the other profile's summary + transcript so far.
   Output: the next message as plain text.

3. Backend endpoint POST /api/negotiate-decide
   Input: { profileA, profileB, full_transcript }
   Call gemini-3.7-flash with function calling using the propose_match
   schema above. If match is true and confidence is above ~0.6, write a
   match record (in-memory is fine) with both profile ids + reason +
   timestamp.

4. Frontend "mingle" screen:
   - Pick two profiles from the pool (dropdown or click-to-select — this
     is your demo control panel)
   - "Start mingling" button calls /negotiate-turn 3-4 times in sequence,
     alternating A/B, rendering each message into a chat-style transcript
     as soon as it returns. This should feel live, not like a spinner.
   - After the last turn, call /negotiate-decide. If matched, reveal both
     names + the reason line as a clear "you've been introduced" moment.
     If not matched, show a simple "no strong overlap this time" state.
   - Don't show the confidence score or raw profile tags to the audience —
     only the generated reason line and the two names. Keep the focus on
     the exchange and outcome, not a data dashboard.

5. Cap negotiation at 4 turns max regardless of outcome — keeps pacing
   tight and prevents runaway calls.
