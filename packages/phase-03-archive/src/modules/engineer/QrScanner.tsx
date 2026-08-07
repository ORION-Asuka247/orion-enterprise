import { useEffect, useRef, useState } from "react";

interface Props {
  onDetected(value: string): void;
  onCancel(): void;
}

export function QrScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setError("QR scanning is not supported by this browser. Use manual asset search.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.[0]?.rawValue) {
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {}
          requestAnimationFrame(scan);
        };

        scan();
      } catch (e: any) {
        setError(e?.message ?? "Unable to access the camera.");
      }
    }

    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      {error && <p className="warning">{error}</p>}
      <button className="secondary" onClick={onCancel}>Use manual search</button>
    </div>
  );
}
