"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  onSign: (signatureDataUrl: string) => void;
  onCancel?: () => void;
}

// Canvas de signature électronique : capture le tracé doigt/stylet,
// renvoie une image PNG en base64 data URL.
export default function SignaturePad({ onSign, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }, []);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const { x, y } = position(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasInk(true);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const { x, y } = position(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function up() {
    setDrawing(false);
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function submit() {
    const c = canvasRef.current!;
    onSign(c.toDataURL("image/png"));
  }

  return (
    <div className="pj-signpad">
      <canvas
        ref={canvasRef}
        width={420}
        height={140}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="pj-signpad-canvas"
      />
      <div className="pj-signpad-actions">
        <button type="button" onClick={clear} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          Effacer
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!hasInk}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
        >
          Signer
        </button>
      </div>
    </div>
  );
}
