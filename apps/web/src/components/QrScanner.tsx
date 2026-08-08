import { useEffect, useRef, useState } from "react";

type Props = {
  onDetected(value: string): void;
  onCancel?(): void;
};

export default function QrScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let frame = 0;

    async function start() {
      const Detector = (window as any).BarcodeDetector;

      if (!Detector) {
        setStarting(false);
        setError("Camera QR detection is not available in this browser. Use manual asset lookup below.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError("Camera access is not available in this browser. Use manual asset lookup below.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        if (cancelled || !videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStarting(false);

        const detector = new Detector({ formats: ["qr_code"] });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;

          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes?.[0]?.rawValue;
            if (raw) {
              cancelled = true;
              stream?.getTracks().forEach(t => t.stop());
              onDetectedRef.current(String(raw));
              return;
            }
          } catch {
            // Continue scanning; transient detector failures should not end the workflow.
          }

          frame = requestAnimationFrame(scan);
        };

        frame = requestAnimationFrame(scan);
      } catch (e: any) {
        setStarting(false);
        setError(e?.message || "Unable to access the camera. Use manual asset lookup below.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="qr-scanner">
      <div className="scanner-frame">
        <video ref={videoRef} playsInline muted />
        <div className="scanner-target" aria-hidden="true" />
        {starting && <div className="scanner-message">Starting camera...</div>}
      </div>

      {error && <div className="warning">{error}</div>}

      {onCancel && (
        <button className="secondary" type="button" onClick={onCancel}>
          Use manual lookup
        </button>
      )}
    </div>
  );
}
