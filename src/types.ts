export type AgentTone = 'cool' | 'warm' | 'quirky' | 'direct' | 'curious';

export interface Profile {
  id: string;
  name: string;
  working_on: string;
  interest_tags: string[];
  looking_for: string;
  open_to_talk: boolean;
  agent_tone?: AgentTone;
  photo?: string;
  captured_at: string;
}

export interface TranscriptMessage {
  speaker: 'A' | 'B';
  name: string;
  text: string;
  timestamp: number;
}

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

export interface MatchDecision {
  match: boolean;
  confidence: number;
  reason: string;
  matched: boolean;
  eligible?: boolean;
  matchRecord?: MatchRecord;
}

export interface AgentChatSession {
  id: string;
  targetProfile: Profile;
  myProfile: Profile;
  status: 'queued' | 'talking' | 'completed' | 'failed' | 'ineligible';
  currentTurn: number;
  currentSpeaker?: 'A' | 'B';
  transcript: TranscriptMessage[];
  decision?: MatchDecision | null;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

