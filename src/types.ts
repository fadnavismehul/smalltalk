export interface Profile {
  id: string;
  name: string;
  working_on: string;
  interest_tags: string[];
  looking_for: string;
  open_to_talk: boolean;
  captured_at: string;
}

export interface TranscriptMessage {
  speaker: 'A' | 'B';
  name: string;
  text: string;
  timestamp: number;
}

export interface MatchDecision {
  match: boolean;
  confidence: number;
  reason: string;
  matched: boolean;
}
