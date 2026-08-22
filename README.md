# smalltalk

**Autonomous Agent-to-Agent Matchmaking for Live Events and Hackathons.**

---

## The Problem

Hackathons and technical conferences are full of high-potential collaborators, but serendipity is inefficient. Attendees waste time enduring awkward icebreakers, pitching the wrong people, or missing high-leverage connections entirely because they couldn't possibly meet 200+ attendees in person.

---

## How It Works

`smalltalk` flips networking on its head: instead of you wandering the venue, your personal AI agent negotiates on your behalf in real-time.

```text
[ Attendee Speaks / Types Bio ]
               │
               ▼
[ Voice / Multimodal Structured Extraction ]
   (Gemini extracts name, project, interests, goals & consent)
               │
               ▼
[ 1-on-1 Autonomous Agent Negotiation (4 Turns Max) ]
   (Agent A & Agent B probe deep synergies and complementary needs)
               │
               ▼
[ Function-Calling Matchmaker Decision ]
   (Gemini judges the full transcript & records the match)
               │
               ▼
[ Celebratory Match Reveal & Actionable Intro ]
   (Front-and-center rationale: "Why you two should connect")
```

1. **Onboard**: The attendee speaks into their microphone or inputs their current focus, interests, and what they are looking for. Gemini structures their preferences into a live profile.
2. **Live Agent Negotiation**: Two attendees' autonomous agents enter a focused 4-turn dialogue, directly discussing what each human is hacking on and exploring technical overlaps.
3. **Function-Call Decision**: An objective matchmaker evaluates the full transcript. It grounds its decision not merely on static bios, but on specific synergies surfaced during the live exchange.
4. **Match Reveal**: If a genuine connection is found, the system produces an introduction payoff screen and commits the introduction record to the event database.

---

## Why Gemini 3.7 Flash?

- **Multimodal Onboarding**: Fast, accurate audio-to-structured-JSON extraction allows attendees to speak naturally for 15 seconds and have their interests instantly profiled.
- **Sub-Second Live Negotiation**: Real-time conversational exchanges between two autonomous agents require low latency and high reasoning fidelity so turns feel fast and dynamic.
- **Function Calling & Structured Outputs**: Rather than just outputting passive text, Gemini 3.7 Flash executes structured function calling to commit validated match records (`match: true`, `confidence`, `reason`) directly into the backend store.

---

## Consent & Safety

- **Explicit `open_to_talk` Opt-In**: Attendees have direct control over whether they are open to live introductions today.
- **Deterministic Hard Gate**: If either attendee has `open_to_talk: false`, the system blocks negotiation instantly at the code level **before** any Gemini API call is triggered.
- **Strict Pair Consent**: No introduction or match is ever evaluated or created unless **both** profiles have explicitly opted in.
- **Event-Scoped Data**: Attendee profiles and negotiated transcripts are transient and strictly scoped to the active event session.

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- A Google Gemini API Key

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/smalltalk.git
cd smalltalk
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and add your Gemini API key:
```bash
cp .env.example .env
```
Inside `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Verify API Endpoints
- **List Profiles**: `GET http://localhost:3000/api/profiles`
- **List Persisted Matches**: `GET http://localhost:3000/api/matches`

---

## Hackathon Track

🏆 **Most Creative Gemini Hack**
