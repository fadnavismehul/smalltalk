import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check } from 'lucide-react';

interface SelfieCaptureProps {
  photo: string | null;
  onCapture: (dataUrl: string | null) => void;
}

export default function SelfieCapture({ photo, onCapture }: SelfieCaptureProps) {
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera access to take a selfie.'
          : 'Could not open the camera.'
      );
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Center-crop the video frame to a square
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    // Mirror to match the preview
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    onCapture(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  return (
    <div className="space-y-2">
      {!cameraOn && (
        <div className="flex items-center gap-3">
          {photo ? (
            <img
              src={photo}
              alt="Your profile"
              className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5 text-stone-400" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold border border-stone-200/80 transition cursor-pointer"
            >
              {photo ? <RefreshCw className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{photo ? 'Retake selfie' : 'Take a selfie'}</span>
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => onCapture(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-stone-700 text-xs font-semibold border border-stone-200/70 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      )}

      {cameraOn && (
        <div className="space-y-2">
          <div className="relative w-full max-w-[240px] aspect-square rounded-2xl overflow-hidden border border-stone-300 bg-stone-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={snap}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-semibold transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Capture</span>
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold border border-stone-200/80 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
