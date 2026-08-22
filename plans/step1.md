Build a single-page web app for a live event-networking tool. This is step 1
only — landing page + preference capture. No matching or agent negotiation
logic yet, that comes next.

1. Landing screen: project name, one-line tagline, single CTA "Join the mingle".

2. Capture form with these fields:
   - Name (text)
   - "What are you building / working on today?" (free text, 1-2 sentences)
   - "What do you want to get out of today?" (free text, 1-2 sentences)
   - "Open to being matched with someone today?" — toggle, default ON,
     labeled clearly as revocable
   - Submit button

3. On submit, call the Gemini API (model: gemini-3.7-flash) using its
   structured-output / JSON mode to convert the two free-text fields into
   an object matching exactly this schema:
   {
     "id": "uuid",
     "name": "string",
     "working_on": "string, cleaned, 1 sentence",
     "interest_tags": ["3-6 short tags"],
     "looking_for": "string, cleaned, 1 sentence",
     "open_to_talk": true,
     "captured_at": "ISO timestamp"
   }
   Use the model's structured-output/function-calling capability for this,
   not manual string parsing — check the current Gemini API docs for the
   exact structured-output syntax for this model.

4. Store the result in-memory or in a simple local JSON store — no auth,
   no database setup needed yet.

5. After submit, show only a plain confirmation: "You're in. We'll introduce
   you to someone worth meeting." Do NOT display the extracted tags or
   profile back to the user — this data is only ever used downstream for
   matching, never shown as a personality summary.

6. Keep styling minimal — this screen gets replaced by a live agent-
   negotiation view next, don't over-invest in polish here.

7. Read the Gemini API key from an environment variable, never hard-code
   it, and add .env to .gitignore — this repo will be public.
