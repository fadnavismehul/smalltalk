Extend the existing agent-negotiation feature from step 2. Do not rebuild
it — patch and extend in place.

1. Replace the /api/negotiate-decide system instruction with this:

   "You're judging whether two hackathon attendees should be introduced,
   based on a live exchange between their agents.

   A good match does NOT require working in the same domain. Look instead
   for:
   - Direct complementary value — one person's work could genuinely help
     or interest the other
   - A specific, concrete hook that surfaced during the exchange itself —
     not just similarity between their static bios
   - Shared context (same event, same kind of problem, same community)
     even if their technical fields differ

   Read the full transcript, including later turns, not just the opening
   framing. Ground your decision and reason in something that was actually
   said during the exchange.

   Return match=true if there's a genuine, specific reason these two
   people would want to talk — even if their fields look unrelated on
   paper."

   Confirm the full 4-turn transcript array is actually passed into this
   call, not just the two profile summaries — log it if you're not sure.

2. Add a hard gate before negotiation runs at all: if either profile's
   open_to_talk is false, skip the negotiation entirely and return a
   "not eligible" result. Check this in code, not via the model.

3. When match=true, persist a match record:
   { matchId, profileAId, profileBId, reason, timestamp }
   Treat this as a real state write, not just a UI flag — this is the
   action the negotiation is supposed to produce.

4. Build a match reveal screen for the true case, separate from the
   existing "no strong overlap" card:
   - Both names, shown clearly
   - The generated reason line, front and center
   - Visually distinct from the rejection state — this is the payoff
     moment, it should feel like one
   - Do not show confidence score or raw profile tags

5. Remove the "Suggested Pairings" badges (High Overlap / Domain Match)
   from the Agent Mingle screen entirely. They run on separate static
   logic that doesn't reflect the live negotiation and has already
   disagreed with it twice — cut them, don't try to reconcile them.

After this is done, re-run the Mehul/Maya pair and confirm it now produces
a match, with a reason grounded in the hackathon-testing overlap that
showed up in turns 3-4.