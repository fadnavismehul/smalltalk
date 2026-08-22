import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { PROMPTS } from './src/prompts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

export interface CapturedProfile {
  id: string;
  name: string;
  working_on: string;
  interest_tags: string[];
  looking_for: string;
  open_to_talk: boolean;
  agent_tone?: string;
  photo?: string;
  captured_at: string;
}

const profilesStore: CapturedProfile[] = [];
const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

// Ensure local persistence data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed creating data directory:', e);
  }
}

const SEED_PROFILES: CapturedProfile[] = [
  {
    id: 'seed-1',
    name: 'Maya Chen',
    working_on: 'Building an open-source evaluation harness for multi-agent LLM systems — measuring negotiation quality, tool-use accuracy, and failure recovery across agent frameworks.',
    interest_tags: ['AI Agents', 'LLM Evals', 'Open Source', 'Developer Tools'],
    looking_for: 'Engineers shipping real agent-to-agent products who want rigorous evals, and a potential technical co-founder with infra depth.',
    open_to_talk: true,
    agent_tone: 'curious',
    captured_at: new Date('2026-08-22T09:00:00Z').toISOString(),
  },
  {
    id: 'seed-2',
    name: 'Daniel Okafor',
    working_on: 'Real-time voice AI infrastructure — sub-300ms speech-to-speech pipelines over WebRTC, currently powering live translation for event stages.',
    interest_tags: ['Voice AI', 'WebRTC', 'Real-Time Systems', 'Speech'],
    looking_for: 'Builders adding voice interfaces to their apps, and anyone with hard latency problems in production audio pipelines.',
    open_to_talk: true,
    agent_tone: 'direct',
    captured_at: new Date('2026-08-22T09:10:00Z').toISOString(),
  },
  {
    id: 'seed-3',
    name: 'Sofia Marquez',
    working_on: 'Product lead for a 3,000-attendee conference platform — redesigning how attendees discover each other using interest graphs instead of job titles.',
    interest_tags: ['Event Tech', 'Product', 'Recommendation Systems', 'Community'],
    looking_for: 'AI engineers who can turn messy attendee bios into structured matching signals, and founders in the events space to swap notes with.',
    open_to_talk: true,
    agent_tone: 'warm',
    captured_at: new Date('2026-08-22T09:20:00Z').toISOString(),
  },
  {
    id: 'seed-4',
    name: 'Kenji Tanaka',
    working_on: 'Fine-tuning small multimodal models for on-device photo and audio understanding — profile extraction from a selfie and a 15-second voice note.',
    interest_tags: ['Multimodal AI', 'On-Device ML', 'Computer Vision', 'Speech'],
    looking_for: 'People with real user data pipelines who want fast multimodal extraction, and researchers pushing small-model quality.',
    open_to_talk: true,
    agent_tone: 'cool',
    captured_at: new Date('2026-08-22T09:30:00Z').toISOString(),
  },
  {
    id: 'seed-6',
    name: 'Marguerite Dubois',
    working_on: 'Running a small-batch patisserie and testing a subscription model for regional croissant delivery — here to explore tech for order logistics.',
    interest_tags: ['Food & Beverage', 'Subscriptions', 'Local Business', 'Logistics'],
    looking_for: 'Food industry investors and anyone who has scaled a perishable-goods delivery operation.',
    open_to_talk: true,
    agent_tone: 'warm',
    captured_at: new Date('2026-08-22T09:50:00Z').toISOString(),
  },
  {
    id: 'seed-7',
    name: 'Tom Whitfield',
    working_on: 'Restoring vintage synthesizers and building a marketplace for authenticated analog music gear with escrow-based trades.',
    interest_tags: ['Music Hardware', 'Marketplaces', 'Collectibles', 'E-commerce'],
    looking_for: 'Fellow synth collectors and marketplace operators who have solved authentication and escrow for high-value physical goods.',
    open_to_talk: true,
    agent_tone: 'quirky',
    captured_at: new Date('2026-08-22T09:55:00Z').toISOString(),
  },
  {
    id: 'seed-8',
    name: 'Ingrid Halvorsen',
    working_on: 'Marine biologist mapping kelp forest recovery off the Norwegian coast with underwater drone photogrammetry.',
    interest_tags: ['Marine Biology', 'Ocean Tech', 'Drones', 'Conservation'],
    looking_for: 'Grant co-authors in ocean sciences and underwater robotics hardware specialists.',
    open_to_talk: true,
    agent_tone: 'curious',
    captured_at: new Date('2026-08-22T10:00:00Z').toISOString(),
  },
  {
    id: 'seed-5',
    name: 'Priya Nair',
    working_on: 'Heads-down sprint on a GPU inference scheduler today — at the venue but not taking meetings.',
    interest_tags: ['GPU Infrastructure', 'Inference', 'Performance'],
    looking_for: 'Nothing today — deep work mode.',
    open_to_talk: false,
    agent_tone: 'direct',
    captured_at: new Date('2026-08-22T09:40:00Z').toISOString(),
  },
];

export interface MatchRecord {
  matchId: string;
  profileAId: string;
  profileBId: string;
  profileAName: string;
  profileBName: string;
  reason: string;
  timestamp: string;
  confidence?: number;
}

const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const matchesStore: MatchRecord[] = [];

// Load existing matches
if (fs.existsSync(MATCHES_FILE)) {
  try {
    const raw = fs.readFileSync(MATCHES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      matchesStore.push(...parsed);
    }
  } catch (err) {
    console.error('Failed reading matches.json:', err);
  }
}

function saveMatches() {
  try {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(matchesStore, null, 2));
  } catch (err) {
    console.error('Failed saving matches.json:', err);
  }
}

// Load existing profiles and merge with seed profiles
if (fs.existsSync(PROFILES_FILE)) {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      profilesStore.push(...parsed);
    }
  } catch (err) {
    console.error('Failed reading profiles.json:', err);
  }
}

// Ensure seed profiles exist alongside user-created profiles
for (const seed of SEED_PROFILES) {
  if (!profilesStore.some((p) => p.id === seed.id || p.name.toLowerCase() === seed.name.toLowerCase())) {
    profilesStore.push(seed);
  }
}
saveProfiles();

function saveProfiles() {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profilesStore, null, 2));
  } catch (err) {
    console.error('Failed saving profiles.json:', err);
  }
}

// Initialize Gemini Client
function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    vertexai: process.env.USE_VERTEX_AI === 'true',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// --- OpenRouter provider (OpenAI-compatible protocol) ---
// When OPENROUTER_API_KEY is set, all AI calls route through OpenRouter
// to Gemini 3.7 Flash instead of the Google Gemini API.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getOpenRouterKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

async function openRouterGenerate(opts: {
  system?: string;
  user: string;
  audio?: { data: string; mimeType: string };
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const key = getOpenRouterKey();
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.7-flash';

  const userContent: any = opts.audio
    ? [
        { type: 'text', text: opts.user },
        {
          type: 'input_audio',
          input_audio: {
            data: opts.audio.data,
            format: (opts.audio.mimeType.split('/')[1] || 'webm').split(';')[0],
          },
        },
      ]
    : opts.user;

  const messages: any[] = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: userContent });

  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message || `OpenRouter error ${resp.status}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty response from OpenRouter');
  }
  return text.trim();
}

// Parse JSON out of a model response, stripping markdown fences if present
function extractJson(text: string): any {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

app.post('/api/generate-name', async (req: Request, res: Response) => {
  try {
    const { working_on, looking_for, tone } = req.body;
    const ai = getGenAIClient();

    if (getOpenRouterKey() && (working_on || looking_for)) {
      try {
        const text = await openRouterGenerate({
          system: 'You generate catchy 2-part attendee names or aliases (exactly 2 words) inspired by what someone is building.',
          user: `Based on what this person is working on and looking for, generate a catchy, fun, memorable 2-word name (like "Vector Voyager", "Prompt Pioneer", "Neural Nomad").
Working on: ${working_on || 'building AI projects'}
Looking for: ${looking_for || 'meeting tech builders'}
Tone: ${tone || 'cool'}

Return ONLY JSON: {"name": "<2-word name>"}`,
          json: true,
        });
        const parsed = extractJson(text);
        if (parsed.name && typeof parsed.name === 'string') {
          return res.status(200).json({ name: parsed.name.trim() });
        }
      } catch (e) {
        console.error('OpenRouter generate-name failed, using fallback:', e);
      }
    } else if (ai && (working_on || looking_for)) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `Based on what this person is working on and looking for, generate a catchy, fun, memorable 2-word name (like "Vector Voyager", "Prompt Pioneer", "Neural Nomad", "Code Crafter", "Agent Alex", "Pixel Pilot", "Acoustic Artisan", "Kernel Kai").
Working on: ${working_on || 'building AI projects'}
Looking for: ${looking_for || 'meeting tech builders'}
Tone: ${tone || 'cool'}

Return ONLY JSON matching the schema.`,
        config: {
          systemInstruction: 'You generate catchy 2-part attendee names or aliases (exactly 2 words) inspired by what someone is building.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'A 2-part name (2 words, e.g. "Neural Nomad", "Vector Voyager", "Pixel Pilot")',
              },
            },
            required: ['name'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      if (parsed.name && typeof parsed.name === 'string') {
        return res.status(200).json({ name: parsed.name.trim() });
      }
    }

    // Fallback generator if no AI client or empty response
    const prefixes = ['Vector', 'Prompt', 'Neural', 'Pixel', 'Kernel', 'Acoustic', 'Quantum', 'Cloud', 'Byte', 'Logic'];
    const suffixes = ['Voyager', 'Pioneer', 'Nomad', 'Crafter', 'Pilot', 'Builder', 'Architect', 'Scout', 'Hacker', 'Weaver'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return res.status(200).json({ name: `${randomPrefix} ${randomSuffix}` });
  } catch (error: any) {
    console.error('Generate name error:', error);
    return res.status(200).json({ name: 'Pixel Pioneer' });
  }
});

app.post('/api/capture', async (req: Request, res: Response) => {
  try {
    const { name: rawName, working_on_raw, looking_for_raw, open_to_talk, agent_tone, photo } = req.body;

    const name = (rawName && typeof rawName === 'string' && rawName.trim()) 
      ? rawName.trim() 
      : 'You';

    const ai = getGenAIClient();
    let working_on = (working_on_raw || '').trim() || 'Working on various projects';
    let looking_for = (looking_for_raw || '').trim() || 'Looking to connect with fellow attendees';
    let interest_tags: string[] = ['Networking', 'Tech'];

    if (getOpenRouterKey()) {
      try {
        const prompt = PROMPTS.captureExtraction.buildUserPrompt(name, working_on_raw, looking_for_raw);
        const text = await openRouterGenerate({
          system: PROMPTS.captureExtraction.getSystemInstruction(),
          user: `${prompt}

Return ONLY JSON: {"working_on": "<1 sentence summary>", "interest_tags": ["<3-6 short tags>"], "looking_for": "<1 sentence summary>"}`,
          json: true,
        });
        const parsed = extractJson(text);
        if (parsed.working_on && typeof parsed.working_on === 'string') working_on = parsed.working_on;
        if (parsed.looking_for && typeof parsed.looking_for === 'string') looking_for = parsed.looking_for;
        if (Array.isArray(parsed.interest_tags) && parsed.interest_tags.length > 0) {
          interest_tags = parsed.interest_tags.map((t: any) => String(t));
        }
      } catch (aiErr) {
        console.error('OpenRouter extraction failed, using raw inputs:', aiErr);
      }
    } else if (ai) {
      try {
      const prompt = PROMPTS.captureExtraction.buildUserPrompt(name, working_on_raw, looking_for_raw);

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: PROMPTS.captureExtraction.getSystemInstruction(),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              working_on: {
                type: Type.STRING,
                description: 'Cleaned, 1 sentence summary of what they are building / working on today',
              },
              interest_tags: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: '3-6 short tags representing domain, technology, industry or project focus',
              },
              looking_for: {
                type: Type.STRING,
                description: 'Cleaned, 1 sentence summary of what they want to get out of today',
              },
            },
            required: ['working_on', 'interest_tags', 'looking_for'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.working_on && typeof parsed.working_on === 'string') {
          working_on = parsed.working_on;
        }
        if (parsed.looking_for && typeof parsed.looking_for === 'string') {
          looking_for = parsed.looking_for;
        }
        if (Array.isArray(parsed.interest_tags) && parsed.interest_tags.length > 0) {
          interest_tags = parsed.interest_tags.map((t: any) => String(t));
        }
      } catch (parseErr) {
        console.error('Failed to parse Gemini JSON response:', parseErr, responseText);
      }
      } catch (aiErr) {
        // Fall back to the raw inputs so agent creation still works if the Gemini call fails
        console.error('Gemini extraction failed, using raw inputs:', aiErr);
      }
    }

    const profile: CapturedProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      working_on,
      interest_tags,
      looking_for,
      open_to_talk: typeof open_to_talk === 'boolean' ? open_to_talk : true,
      agent_tone: agent_tone || 'cool',
      photo: typeof photo === 'string' && photo.startsWith('data:image/') ? photo : undefined,
      captured_at: new Date().toISOString(),
    };

    profilesStore.push(profile);
    saveProfiles();

    // Return the created profile object for seamless client state sync
    return res.status(200).json({
      success: true,
      id: profile.id,
      profile,
    });
  } catch (error: any) {
    console.error('Capture profile error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to capture preferences',
    });
  }
});

// Voice onboarding: extract structured profile fields from a spoken intro
app.post('/api/capture-voice', async (req: Request, res: Response) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'audio (base64 string) is required' });
    }

    if (getOpenRouterKey()) {
      const text = await openRouterGenerate({
        system:
          'You extract structured networking profiles from short spoken self-introductions at tech events. Be faithful to what was actually said; do not invent details.',
        user: `This is a hackathon attendee introducing themselves out loud. Extract their details for their networking agent profile. If a field is not mentioned, return an empty string for it.

Return ONLY JSON: {"name": "<name or empty string>", "working_on": "<1-2 sentence summary>", "looking_for": "<1-2 sentence summary>"}`,
        audio: { data: audio, mimeType: mimeType || 'audio/webm' },
        json: true,
      });
      const parsed = extractJson(text);
      return res.json({
        name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
        working_on: typeof parsed.working_on === 'string' ? parsed.working_on.trim() : '',
        looking_for: typeof parsed.looking_for === 'string' ? parsed.looking_for.trim() : '',
      });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return res.status(500).json({ error: 'No AI provider configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/webm', data: audio } },
            {
              text: `This is a hackathon attendee introducing themselves out loud. Extract their details for their networking agent profile. If a field is not mentioned, return an empty string for it. Return ONLY JSON matching the schema.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          'You extract structured networking profiles from short spoken self-introductions at tech events. Be faithful to what was actually said; do not invent details.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The attendee's name if they said it, else empty string",
            },
            working_on: {
              type: Type.STRING,
              description: '1-2 sentence summary of what they are building or working on, in first person removed form',
            },
            looking_for: {
              type: Type.STRING,
              description: '1-2 sentence summary of who they want to meet or what they want from the event',
            },
          },
          required: ['name', 'working_on', 'looking_for'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      working_on: typeof parsed.working_on === 'string' ? parsed.working_on.trim() : '',
      looking_for: typeof parsed.looking_for === 'string' ? parsed.looking_for.trim() : '',
    });
  } catch (error: any) {
    console.error('Capture voice error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process voice input' });
  }
});

// Update an existing profile
app.put('/api/profiles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, working_on, looking_for, interest_tags, open_to_talk, agent_tone, photo } = req.body;

    const existingIndex = profilesStore.findIndex((p) => p.id === id);
    if (existingIndex === -1) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const current = profilesStore[existingIndex];
    const updated: CapturedProfile = {
      ...current,
      name: typeof name === 'string' && name.trim() ? name.trim() : current.name,
      working_on: typeof working_on === 'string' ? working_on.trim() : current.working_on,
      looking_for: typeof looking_for === 'string' ? looking_for.trim() : current.looking_for,
      interest_tags: Array.isArray(interest_tags) ? interest_tags : current.interest_tags,
      open_to_talk: typeof open_to_talk === 'boolean' ? open_to_talk : current.open_to_talk,
      agent_tone: agent_tone || current.agent_tone || 'cool',
      photo: photo === null
        ? undefined
        : (typeof photo === 'string' && photo.startsWith('data:image/') ? photo : current.photo),
    };

    profilesStore[existingIndex] = updated;
    saveProfiles();

    return res.json({
      success: true,
      profile: updated,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to update profile' });
  }
});

// Stored profiles query endpoint
app.get('/api/profiles', (_req: Request, res: Response) => {
  // Ensure seed profiles if list has fewer than 2
  if (profilesStore.length < 2) {
    for (const seed of SEED_PROFILES) {
      if (!profilesStore.some((p) => p.id === seed.id || p.name.toLowerCase() === seed.name.toLowerCase())) {
        profilesStore.push(seed);
      }
    }
    saveProfiles();
  }

  res.json({
    total: profilesStore.length,
    profiles: profilesStore,
  });
});

// Endpoint to force reload seed attendee pool
app.post('/api/profiles/seed', (_req: Request, res: Response) => {
  for (const seed of SEED_PROFILES) {
    if (!profilesStore.some((p) => p.id === seed.id || p.name.toLowerCase() === seed.name.toLowerCase())) {
      profilesStore.push(seed);
    }
  }
  saveProfiles();
  res.json({
    success: true,
    total: profilesStore.length,
    profiles: profilesStore,
  });
});

// Endpoint for single negotiation turn
app.post('/api/negotiate-turn', async (req: Request, res: Response) => {
  try {
    const { profileA, profileB, transcript_so_far, speaker } = req.body;

    if (!profileA || !profileB || !speaker) {
      return res.status(400).json({ error: 'profileA, profileB, and speaker are required' });
    }

    // Hard Gate: Skip negotiation if either attendee is not open to talk
    if (profileA.open_to_talk === false || profileB.open_to_talk === false) {
      const ineligible = profileA.open_to_talk === false ? profileA.name : profileB.name;
      return res.status(400).json({
        error: 'not_eligible',
        message: `${ineligible} has indicated they are not open to introductions today.`,
      });
    }

    const currentProfile: CapturedProfile = speaker === 'A' ? profileA : profileB;
    const otherProfile: CapturedProfile = speaker === 'A' ? profileB : profileA;

    const ai = getGenAIClient();
    const useOpenRouter = !!getOpenRouterKey();
    if (!ai && !useOpenRouter) {
      // Fallback response if API key is not configured
      const fallbackMsgs = [
        `Hey! I hear you're focused on ${otherProfile.working_on}. My human ${currentProfile.name} is currently deep into ${currentProfile.working_on}.`,
        `That's interesting—${currentProfile.name} is looking to ${currentProfile.looking_for.toLowerCase()}, especially in spaces like ${(currentProfile.interest_tags || []).slice(0, 2).join(' and ')}.`,
        `There could be a great overlap here since ${otherProfile.name} wants to ${otherProfile.looking_for.toLowerCase()}.`,
        `Definitely sounds like something worth a quick conversation today!`
      ];
      const turnIndex = Array.isArray(transcript_so_far) ? transcript_so_far.length : 0;
      const message = fallbackMsgs[turnIndex % fallbackMsgs.length];
      return res.json({ message });
    }

    const formattedTranscript = Array.isArray(transcript_so_far) && transcript_so_far.length > 0
      ? transcript_so_far
          .map((item: any) => `${item.name || (item.speaker === 'A' ? profileA.name : profileB.name)}'s Agent: ${item.text || item.message}`)
          .join('\n')
      : '(Conversation just started)';

    const systemInstruction = PROMPTS.negotiateTurn.getSystemInstruction(
      speaker,
      currentProfile.name,
      otherProfile.name,
      currentProfile.agent_tone
    );
    const prompt = PROMPTS.negotiateTurn.buildUserPrompt({
      speaker,
      currentProfile,
      otherProfile,
      formattedTranscript,
    });

    let message = '';
    if (useOpenRouter) {
      message = await openRouterGenerate({
        system: systemInstruction,
        user: prompt,
        temperature: 0.7,
      });
    } else if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
      message = response.text?.trim() || '';
    }
    // Clean up any accidental prefixes
    message = message.replace(/^([A-Za-z0-9\s'_-]+agent\s*:\s*)/i, '').replace(/^"|"$/g, '').trim();

    if (!message) {
      message = `I'm exploring how ${currentProfile.name}'s focus on ${currentProfile.working_on} aligns with what ${otherProfile.name} is building.`;
    }

    return res.json({ message });
  } catch (error: any) {
    console.error('Negotiate turn error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate negotiation turn' });
  }
});

// Endpoint for match decision using function calling / schema evaluation
app.post('/api/negotiate-decide', async (req: Request, res: Response) => {
  try {
    const { profileA, profileB, full_transcript } = req.body;

    if (!profileA || !profileB) {
      return res.status(400).json({ error: 'profileA and profileB are required' });
    }

    // Hard Gate: Check in code if either profile's open_to_talk is false
    if (profileA.open_to_talk === false || profileB.open_to_talk === false) {
      return res.json({
        match: false,
        confidence: 0,
        reason: 'One or both attendees marked their preferences as not open to introductions today.',
        matched: false,
        eligible: false,
      });
    }

    const ai = getGenAIClient();
    let match = false;
    let confidence = 0.5;
    let reason = 'No clear synergy surfaced during the agent exchange.';

    const formattedTranscript = Array.isArray(full_transcript) && full_transcript.length > 0
      ? full_transcript
          .map((item: any) => `${item.name || (item.speaker === 'A' ? profileA.name : profileB.name)}'s Agent: ${item.text || item.message}`)
          .join('\n')
      : '(No exchange recorded)';

    // Confirm the full 4-turn transcript is logged
    console.log(`[negotiate-decide] Evaluating match for ${profileA.name} & ${profileB.name}`);
    console.log(`[negotiate-decide] Full transcript turns count: ${Array.isArray(full_transcript) ? full_transcript.length : 0}`);
    console.log(`[negotiate-decide] Full transcript passed:\n${formattedTranscript}`);

    if (getOpenRouterKey()) {
      try {
        const prompt = PROMPTS.negotiateDecide.buildUserPrompt({
          profileA,
          profileB,
          formattedTranscript,
        });
        const text = await openRouterGenerate({
          system: PROMPTS.negotiateDecide.getSystemInstruction(),
          user: `${prompt}

Return ONLY JSON: {"match": <boolean>, "confidence": <0.0-1.0>, "reason": "<concise 1-2 sentence introduction rationale grounded in the live exchange>"}`,
          json: true,
        });
        const parsed = extractJson(text);
        if (typeof parsed.match === 'boolean') match = parsed.match;
        if (typeof parsed.confidence === 'number') confidence = parsed.confidence;
        if (typeof parsed.reason === 'string' && parsed.reason.trim()) reason = parsed.reason.trim();
        console.log('[negotiate-decide] OpenRouter decision result:', { match, confidence, reason });
      } catch (e) {
        console.error('OpenRouter decide failed:', e);
      }
    } else if (ai) {
      const prompt = PROMPTS.negotiateDecide.buildUserPrompt({
        profileA,
        profileB,
        formattedTranscript,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: PROMPTS.negotiateDecide.getSystemInstruction(),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match: {
                type: Type.BOOLEAN,
                description: 'True if there is a genuine, specific reason these two people would want to talk based on what surfaced in the exchange',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence level between 0.0 and 1.0',
              },
              reason: {
                type: Type.STRING,
                description: 'A concise 1-2 sentence introduction rationale grounded in what surfaced during the live exchange',
              },
            },
            required: ['match', 'confidence', 'reason'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      try {
        const parsed = JSON.parse(responseText);
        if (typeof parsed.match === 'boolean') match = parsed.match;
        if (typeof parsed.confidence === 'number') confidence = parsed.confidence;
        if (typeof parsed.reason === 'string' && parsed.reason.trim()) reason = parsed.reason.trim();
        console.log('[negotiate-decide] Model decision result:', { match, confidence, reason });
      } catch (parseErr) {
        console.error('Failed to parse Gemini decision response:', parseErr, responseText);
      }
    } else {
      // Heuristic fallback if no API key
      const tagsA = new Set((profileA.interest_tags || []).map((t: string) => t.toLowerCase()));
      const tagsB = (profileB.interest_tags || []).map((t: string) => t.toLowerCase());
      const common = tagsB.filter((t: string) => tagsA.has(t));

      if (common.length > 0) {
        match = true;
        confidence = 0.85;
        reason = `Both surfaced complementary hackathon goals around ${common.join(' and ')}.`;
      } else {
        match = false;
        confidence = 0.4;
        reason = 'Distinct focus areas with limited immediate synergy during the exchange.';
      }
    }

    const isMatchSuccessful = match === true;
    let createdMatchRecord: MatchRecord | null = null;

    if (isMatchSuccessful) {
      createdMatchRecord = {
        matchId: crypto.randomUUID(),
        profileAId: profileA.id,
        profileBId: profileB.id,
        profileAName: profileA.name,
        profileBName: profileB.name,
        reason,
        timestamp: new Date().toISOString(),
        confidence,
      };
      matchesStore.push(createdMatchRecord);
      saveMatches();
      console.log('[negotiate-decide] Match record successfully persisted:', createdMatchRecord.matchId);
    }

    return res.json({
      match: isMatchSuccessful,
      confidence,
      reason,
      matched: isMatchSuccessful,
      eligible: true,
      matchRecord: createdMatchRecord,
    });
  } catch (error: any) {
    console.error('Negotiate decide error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to decide match' });
  }
});

// Stored matches query endpoint
app.get('/api/matches', (_req: Request, res: Response) => {
  res.json({
    total: matchesStore.length,
    matches: matchesStore,
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`smalltalk server running on http://localhost:${PORT}`);
  });
}

startServer();
