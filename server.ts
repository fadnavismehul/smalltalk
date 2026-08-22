import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

export interface CapturedProfile {
  id: string;
  name: string;
  working_on: string;
  interest_tags: string[];
  looking_for: string;
  open_to_talk: boolean;
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

// Load existing profiles if any
if (fs.existsSync(PROFILES_FILE)) {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      profilesStore.push(...parsed);
    }
  } catch (err) {
    console.error('Failed reading profiles.json:', err);
  }
}

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
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/capture', async (req: Request, res: Response) => {
  try {
    const { name, working_on_raw, looking_for_raw, open_to_talk } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const ai = getGenAIClient();
    let working_on = (working_on_raw || '').trim() || 'Working on various projects';
    let looking_for = (looking_for_raw || '').trim() || 'Looking to connect with fellow attendees';
    let interest_tags: string[] = ['Networking', 'Tech'];

    if (ai) {
      const prompt = `Convert the following attendee preferences into clean 1-sentence summaries and 3-6 short interest tags:
Attendee Name: ${name.trim()}
What are you building / working on today?: "${working_on_raw || ''}"
What do you want to get out of today?: "${looking_for_raw || ''}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You extract and clean structured profile preferences for event networking.',
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
    }

    const profile: CapturedProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      working_on,
      interest_tags,
      looking_for,
      open_to_talk: typeof open_to_talk === 'boolean' ? open_to_talk : true,
      captured_at: new Date().toISOString(),
    };

    profilesStore.push(profile);
    saveProfiles();

    // Plain confirmation only - do not display extracted tags or profile back to user
    return res.status(200).json({
      success: true,
      id: profile.id,
    });
  } catch (error: any) {
    console.error('Capture profile error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to capture preferences',
    });
  }
});

// Stored profiles query endpoint for future steps / diagnostics
app.get('/api/profiles', (_req: Request, res: Response) => {
  res.json({
    total: profilesStore.length,
    profiles: profilesStore,
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
