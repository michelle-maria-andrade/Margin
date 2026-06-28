'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface fiber {
  x: number; y: number; a: number; r: number;
}
interface stroke {
  segments: fiber[][];
  drawnAt: number;
}

const fade_delay = 2000;
const fade_dur = 600;
const spacing = 36;

export default function LandingPage() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Load Quicksand before anything renders
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = window.devicePixelRatio || 1;
    let W = 0, H = 0;

    const state = {
      drawing: false,
      last: null as { x: number; y: number } | null,
      strokes: [] as stroke[],
      currentstroke: null as stroke | null,
      animFrame: 0,
      transitioning: false,
      transitionStart: 0,
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
      const fontSize = Math.min(W * 0.12, 120);
      const text_w = W * 0.48;
      const text_h = fontSize * 1.3;
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
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MARGIN', W / 2, H / 2);
    }

    // arrow
    function draw_arrow(alpha: number) {
      const cx = W / 2;
      const baseY = H * 0.82;
      const len = 38;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // shaft
      ctx.beginPath();
      ctx.moveTo(cx + (Math.random() - 0.5) * 1.5, baseY);
      ctx.bezierCurveTo(
        cx + 3 + (Math.random() - 0.5) * 3, baseY + len * 0.3,
        cx - 3 + (Math.random() - 0.5) * 3, baseY + len * 0.65,
        cx + (Math.random() - 0.5) * 2,     baseY + len
      );
      ctx.stroke();

      // left arrowhead
      ctx.beginPath();
      ctx.moveTo(cx + (Math.random() - 0.5) * 1.5, baseY + len);
      ctx.lineTo(cx - 10 + (Math.random() - 0.5) * 3, baseY + len - 12 + (Math.random() - 0.5) * 3);
      ctx.stroke();

      // right arrowhead
      ctx.beginPath();
      ctx.moveTo(cx + (Math.random() - 0.5) * 1.5, baseY + len);
      ctx.lineTo(cx + 10 + (Math.random() - 0.5) * 3, baseY + len - 12 + (Math.random() - 0.5) * 3);
      ctx.stroke();

      ctx.restore();
    }

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    let arrowPulse = 0;

    function loop() {
      const now = Date.now();
      ctx.fillStyle = '#F0EDE8';
      ctx.fillRect(0, 0, W, H);
      dot_maker();

      state.strokes = state.strokes.filter(s => now - s.drawnAt < fade_delay + fade_dur);

      let globalAlpha = 1;
      if (state.transitioning) {
        const elapsed = now - state.transitionStart;
        const t = Math.min(elapsed / 700, 1);
        globalAlpha = 1 - easeInOut(t);
        if (t >= 1) {
          router.push('/auth/login');
          return;
        }
      }

      ctx.save();
      ctx.globalAlpha = globalAlpha;

      for (const s of state.strokes) {
        const age = now - s.drawnAt;
        const alpha = age > fade_delay ? 1 - (age - fade_delay) / fade_dur : 1;
        for (const seg of s.segments) drawfibers(seg, alpha);
      }
      ctx.restore();

      draw_text();

      // pulse for arrow like my headache
      arrowPulse += 0.035;
      const arrowAlpha = (0.45 + 0.35 * Math.sin(arrowPulse)) * globalAlpha;
      draw_arrow(arrowAlpha);

      state.animFrame = requestAnimationFrame(loop);
    }

    function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect();
      const src = 'touches' in e ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function isOnArrow(x: number, y: number) {
      return Math.abs(x - W / 2) < 32 && y > H * 0.78 && y < H * 0.92;
    }

    function startstroke(e: MouseEvent | TouchEvent) {
      if (state.transitioning) return;
      const pos = getPos(e);
      if (isOnArrow(pos.x, pos.y)) return; // don't draw on arrow zone
      state.drawing = true;
      state.last = pos;
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

    function handleClick(e: MouseEvent) {
      const pos = getPos(e);
      if (isOnArrow(pos.x, pos.y) && !state.transitioning) {
        state.transitioning = true;
        state.transitionStart = Date.now();
        setLeaving(true);
      }
    }

    // trans for scroll
    function handleWheel(e: WheelEvent) {
      if (state.transitioning) return;
      if (e.deltaY > 40) {
        state.transitioning = true;
        state.transitionStart = Date.now();
        setLeaving(true);
      }
    }

    resize();
    loop();

    const mo = new ResizeObserver(resize);
    mo.observe(canvas);

    canvas.addEventListener('mousedown', startstroke);
    canvas.addEventListener('mouseup', endstroke);
    canvas.addEventListener('mouseleave', endstroke);
    canvas.addEventListener('mousemove', continuestroke);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: true });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startstroke(e); }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      endstroke();
      // swipe detection
      const touch = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const y = touch.clientY - rect.top;
      if (y > H * 0.78 && !state.transitioning) {
        state.transitioning = true;
        state.transitionStart = Date.now();
        setLeaving(true);
      }
    });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); continuestroke(e); }, { passive: false });

    return () => {
      cancelAnimationFrame(state.animFrame);
      mo.disconnect();
    };
  }, [router]);

  return (
    <main style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#F0EDE8' }}>
      <canvas
        ref={canvas_ref}
        style={{
          display: 'block', width: '100%', height: '100%',
          cursor: leaving ? 'default' : 'crosshair',
        }}
      />
    </main>
  );
}