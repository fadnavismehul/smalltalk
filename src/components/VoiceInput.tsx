import { useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export interface VoiceExtraction {
  name: string;
  working_on: string;
  looking_for: string;
}

interface VoiceInputProps {
  onExtracted: (data: VoiceExtraction) => void;
}

type VoiceState = 'idle' | 'recording' | 'processing';

export default function VoiceInput({ onExtracted }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopTracks = () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await processAudio(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setState('recording');
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone access denied. Allow mic access to use voice input.'
          : 'Could not start recording.'
      );
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      setState('processing');
      recorderRef.current.stop();
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed reading audio'));
        reader.readAsDataURL(blob);
      });

      if (!base64) throw new Error('Empty recording');

      const res = await fetch('/api/capture-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: blob.type || 'audio/webm' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to process voice input');

      if (!data.working_on && !data.looking_for && !data.name) {
        throw new Error("Couldn't catch that — try speaking a bit longer.");
      }
      onExtracted(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to process voice input');
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={state === 'processing'}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer disabled:cursor-not-allowed ${
          state === 'recording'
            ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
            : 'bg-stone-100 text-stone-800 border-stone-200/80 hover:bg-stone-200'
        }`}
      >
        {state === 'recording' ? (
          <>
            <Square className="w-4 h-4 fill-red-600 text-red-600" />
            <span>Stop &amp; transcribe</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </>
        ) : state === 'processing' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Listening back &amp; filling the form...</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            <span>Speak instead — describe yourself in ~15 seconds</span>
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
