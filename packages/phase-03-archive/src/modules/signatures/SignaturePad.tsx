import { useEffect, useRef } from "react";

interface Props {
  onSave(blob: Blob): void;
  onCancel(): void;
}

export function SignaturePad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    let drawing = false;

    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e: PointerEvent) => {
      drawing = true;
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };

    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const p = point(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const up = () => {
      drawing = false;
      ctx.closePath();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="signature-wrap">
      <canvas ref={canvasRef} className="signature-canvas" />
      <div className="row">
        <button className="secondary" onClick={clear}>Clear</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button onClick={save}>Save signature</button>
      </div>
    </div>
  );
}
