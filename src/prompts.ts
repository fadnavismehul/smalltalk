import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

/**
 * Helper to safely read a markdown prompt template from the /prompts directory.
 */
function loadMarkdownPrompt(fileName: string, defaultFallback: string): string {
  try {
    const filePath = path.join(PROMPTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim();
    }
  } catch (err) {
    console.error(`Error loading prompt file ${fileName}:`, err);
  }
  return defaultFallback;
}

export interface CapturedProfileData {
  name: string;
  working_on: string;
  interest_tags: string[];
  looking_for: string;
  agent_tone?: string;
}

export function getToneDescription(tone?: string): string {
  switch (tone) {
    case 'cool':
      return 'Speak with a calm, understated, effortlessly modern and confident tone. Keep it low-key, sharp, and concise.';
    case 'warm':
      return 'Speak with an enthusiastic, supportive, welcoming, and genuinely encouraging tone. Express authentic excitement for shared work.';
    case 'quirky':
      return 'Speak with a playful, creative, witty, and slightly unconventional angle. Use vivid metaphors and show distinctive personality.';
    case 'direct':
      return 'Speak with high efficiency, zero fluff, analytical precision, and clear goal-oriented inquiries.';
    case 'curious':
      return 'Speak with deep intellectual curiosity, asking probing thoughtful technical questions and showing genuine fascination.';
    default:
      return 'Direct, curious, polite, authentic, and naturally conversational.';
  }
}

export interface TurnPromptParams {
  speaker: 'A' | 'B';
  currentProfile: CapturedProfileData;
  otherProfile: CapturedProfileData;
  formattedTranscript: string;
}

export interface DecisionPromptParams {
  profileA: CapturedProfileData;
  profileB: CapturedProfileData;
  formattedTranscript: string;
}

export const PROMPTS = {
  // Step 1: Attendee Profile Cleaning & Structured Extraction
  captureExtraction: {
    getSystemInstruction: (): string =>
      loadMarkdownPrompt(
        'capture_system.md',
        'You extract and clean structured profile preferences for event networking.'
      ),

    buildUserPrompt: (name: string, workingOnRaw: string, lookingForRaw: string): string => `Attendee Input to Clean:
Name: ${name.trim()}
What are you building / working on today?: "${workingOnRaw || ''}"
What do you want to get out of today?: "${lookingForRaw || ''}"

Extract:
1. working_on: 1-sentence clean summary
2. interest_tags: 3-6 relevant tags
3. looking_for: 1-sentence clean summary`,
  },

  // Step 2: Agent Negotiation (Per-Turn Conversation)
  negotiateTurn: {
    getSystemInstruction: (speaker: 'A' | 'B', clientName: string, otherName: string, agentTone?: string): string => {
      const otherSpeaker = speaker === 'A' ? 'B' : 'A';
      const toneInstruction = getToneDescription(agentTone);
      const rawMarkdown = loadMarkdownPrompt(
        'negotiate_agent_system.md',
        `You are profile ${speaker}'s agent (${clientName}'s agent), mingling with ${otherName}'s agent to find genuine shared ground. Personality Tone: ${toneInstruction}. Reply in 1-2 short, natural sentences.`
      );

      return rawMarkdown
        .replace(/{{CLIENT_NAME}}/g, clientName)
        .replace(/{{OTHER_CLIENT_NAME}}/g, otherName)
        .replace(/{{SPEAKER}}/g, speaker)
        .replace(/{{OTHER_SPEAKER}}/g, otherSpeaker)
        .replace(/{{AGENT_TONE_INSTRUCTION}}/g, toneInstruction);
    },

    buildUserPrompt: ({ currentProfile, otherProfile, formattedTranscript }: TurnPromptParams): string => `Context:
Your client: ${currentProfile.name}
- Working on: ${currentProfile.working_on}
- Tags: ${(currentProfile.interest_tags || []).join(', ')}
- Looking for: ${currentProfile.looking_for}
- Agent Personality Tone: ${currentProfile.agent_tone || 'direct and curious'}

The other attendee: ${otherProfile.name}
- Working on: ${otherProfile.working_on}
- Tags: ${(otherProfile.interest_tags || []).join(', ')}
- Looking for: ${otherProfile.looking_for}

Conversation transcript so far:
${formattedTranscript}

Generate the next turn in the conversation speaking directly to ${otherProfile.name}'s agent in 1-2 natural sentences, matching your assigned personality tone.`,
  },

  // Step 3: Match Decision & Reason Generation
  negotiateDecide: {
    getSystemInstruction: (): string =>
      loadMarkdownPrompt(
        'decide_system.md',
        `You're judging whether two hackathon attendees should be introduced, based on a live exchange between their agents.

A good match does NOT require working in the same domain. Look instead for:
- Direct complementary value — one person's work could genuinely help or interest the other
- A specific, concrete hook that surfaced during the exchange itself — not just similarity between their static bios
- Shared context (same event, same kind of problem, same community) even if their technical fields differ

Read the full transcript, including later turns, not just the opening framing. Ground your decision and reason in something that was actually said during the exchange.

Return match=true if there's a genuine, specific reason these two people would want to talk — even if their fields look unrelated on paper.`
      ),

    buildUserPrompt: ({ profileA, profileB, formattedTranscript }: DecisionPromptParams): string => `Attendee A (${profileA.name}):
- Working on: ${profileA.working_on}
- Looking for: ${profileA.looking_for}

Attendee B (${profileB.name}):
- Working on: ${profileB.working_on}
- Looking for: ${profileB.looking_for}

Full 4-Turn Agent Negotiation Transcript:
${formattedTranscript}

Evaluate whether attendee A (${profileA.name}) and attendee B (${profileB.name}) should be introduced based on the system instructions, grounding your decision and reason in what was actually said and surfaced during the live exchange.`,
  },
};
