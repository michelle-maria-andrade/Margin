'use client';

import { useEffect, useRef } from 'react';

interface fiber {
  x: number;
  y: number;
  a: number;
  r: number;
}

interface stroke {
  segments: fiber[][];
  drawnAt: number;
}

const fade_delay = 2000;
const fade_dur = 600;
const spacing = 36;


export default function landing_pg() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    let W = 0;
    let H = 0;

    const state = {
      drawing: false,
      last: null as { x: number; y: number } | null,
      strokes: [] as stroke[],
      currentstroke: null as stroke | null,
      animFrame: 0,
    };

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.scale(DPR, DPR);
    }

    function buildfibers(x0: number, y0: number, x1: number, y1: number): fiber[] {
      const dist = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      const steps = Math.max(Math.floor(dist * 2), 1);
      const fibers: fiber[] = [];
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        for (let f = 0; f < 6; f++) {
          fibers.push({
            x: x + (Math.random() - 0.5) * 2.8,
            y: y + (Math.random() - 0.5) * 2.8,
            a: 0.08 + Math.random() * 0.18,
            r: 0.4 + Math.random() * 0.9,
          });
        }
      }
      return fibers;
    }

    function drawfibers(fibers: fiber[], alpha: number) {
      for (const f of fibers) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(28,26,24,${f.a * alpha})`;
        ctx.fill();
      }
    }

    function dot_maker() {
      const text_w = W * 0.45;
      const text_h = W * 0.1;
      const cols = Math.floor(W / spacing);
      const rows = Math.floor(H / spacing);
      const offset_x = (W - (cols - 1) * spacing) / 2;
      const offset_y = (H - (rows - 1) * spacing) / 2;
      const text_x = W / 2 - text_w / 2;
      const text_y = H / 2 - text_h / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offset_x + c * spacing;
          const y = offset_y + r * spacing;
          const inText = x > text_x && x < text_x + text_w && y > text_y && y < text_y + text_h;
          if (!inText) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(160,160,160,0.55)';
            ctx.fill();
          }
        }
      }
    }

    function draw_text() {
      const fontSize = Math.min(W * 0.12, 120);
      ctx.font = `300 ${fontSize}px 'Quicksand', sans-serif`;
      ctx.letterspacing = `${fontSize * 0.08}px`;
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MARGIN', W / 2, H / 2);
    }

    function loop() {
      const now = Date.now();
      ctx.fillStyle = '#F0EDE8';
      ctx.fillRect(0, 0, W, H);
      dot_maker();

      state.strokes = state.strokes.filter(
        (s) => now - s.drawnAt < fade_delay + fade_dur
      );

      for (const stroke of state.strokes) {
        const age = now - stroke.drawnAt;
        const alpha = age > fade_delay ? 1 - (age - fade_delay) / fade_dur : 1;
        for (const seg of stroke.segments) {
          drawfibers(seg, alpha);
        }
      }

      draw_text();
      state.animFrame = requestAnimationFrame(loop);
    }

    function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect();
      const src = 'touches' in e ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function startstroke(e: MouseEvent | TouchEvent) {
      state.drawing = true;
      state.last = getPos(e);
      state.currentstroke = { segments: [], drawnAt: Date.now() };
      state.strokes.push(state.currentstroke);
    }

    function continuestroke(e: MouseEvent | TouchEvent) {
      if (!state.drawing || !state.last || !state.currentstroke) return;
      const pos = getPos(e);
      const fibers = buildfibers(state.last.x, state.last.y, pos.x, pos.y);
      state.currentstroke.segments.push(fibers);
      state.currentstroke.drawnAt = Date.now();
      state.last = pos;
    }

    function endstroke() {
      state.drawing = false;
      state.last = null;
      state.currentstroke = null;
    }

    resize();
    loop();

    const mo = new ResizeObserver(resize);
    mo.observe(canvas);

    canvas.addEventListener('mousedown', startstroke);
    canvas.addEventListener('mouseup', endstroke);
    canvas.addEventListener('mouseleave', endstroke);
    canvas.addEventListener('mousemove', continuestroke);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startstroke(e); }, { passive: false });
    canvas.addEventListener('touchend', endstroke);
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); continuestroke(e); }, { passive: false });

    return () => {
      cancelAnimationFrame(state.animFrame);
      mo.disconnect();
      canvas.removeEventListener('mousedown', startstroke);
      canvas.removeEventListener('mouseup', endstroke);
      canvas.removeEventListener('mouseleave', endstroke);
      canvas.removeEventListener('mousemove', continuestroke);
    };
  }, []);

  return (
    <main style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#F0EDE8' }}>
      <canvas
        ref={canvas_ref}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
      />
    </main>
  );
}