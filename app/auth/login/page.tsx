'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

interface fiber { x: number; y: number; a: number; r: number; }
interface stroke { segments: fiber[][]; drawnAt: number; }

const fade_delay = 2000;
const fade_dur = 600;
const spacing = 36;

export default function LoginPage() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  // ── Drawing canvas (same pencil engine) ──────────────────────────────────
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
        const bx = x0 + (x1 - x0) * t;
        const by = y0 + (y1 - y0) * t;
        for (let f = 0; f < 6; f++) {
          fibers.push({
            x: bx + (Math.random() - 0.5) * 2.8,
            y: by + (Math.random() - 0.5) * 2.8,
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

    function loop() {
      const now = Date.now();
      // transparent — the CSS background shows through
      ctx.clearRect(0, 0, W, H);

      state.strokes = state.strokes.filter(s => now - s.drawnAt < fade_delay + fade_dur);
      for (const s of state.strokes) {
        const age = now - s.drawnAt;
        const alpha = age > fade_delay ? 1 - (age - fade_delay) / fade_dur : 1;
        for (const seg of s.segments) drawfibers(seg, alpha);
      }

      state.animFrame = requestAnimationFrame(loop);
    }

    function getPos(e: MouseEvent | TouchEvent) {
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
    };
  }, []);

  // ── Auth handlers ────────────────────────────────────────────────────────
  async function handleEmailLogin() {
    if (!email) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    setMessage(error ? error.message : 'Check your email for a magic link!');
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          width: 100%;
          min-height: 100vh;
          background: #F0EDE8;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Quicksand', sans-serif;
        }

        /* Full-page drawing canvas — sits above bg, below UI */
        .draw-canvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          cursor: crosshair;
          pointer-events: all;
        }

        /* Dot grid — pure CSS, matches canvas spacing */
        .dots-bg {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, rgba(160,160,160,0.55) 2.5px, transparent 2.5px);
          background-size: 36px 36px;
          background-position: center center;
          pointer-events: none;
          z-index: 0;
        }

        /* Title sits above canvas; plain bg patch behind it */
        .margin-title-wrap {
          position: relative;
          z-index: 10;
          padding: 0 48px;
          /* The plain background patch — same color as page bg */
          background: #F0EDE8;
          pointer-events: none;
          margin-bottom: 32px;
        }

        .margin-title {
          font-family: 'Quicksand', sans-serif;
          font-weight: 300;
          font-size: clamp(36px, 7vw, 80px);
          letter-spacing: 0.1em;
          color: #1a1a1a;
          white-space: nowrap;
        }

        /* Card sits on top of canvas — pointer-events let drawing happen around it */
        .login-card {
          position: relative;
          z-index: 10;
          background: #EBE8E3;
          border: 3px solid rgba(28,26,24,0.10);
          border-radius: 14px;
          padding: 36px 40px 32px;
          width: min(380px, 90vw);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 2px 24px rgba(28,26,24,0.07);
          /* Only block drawing inside the card */
          pointer-events: all;
        }

        .login-heading {
          font-size: 18px;
          font-weight: 400;
          color: #1a1a1a;
          text-align: center;
          margin-bottom: 4px;
          letter-spacing: 0.02em;
        }

        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: transparent;
          border: 1.5px solid rgba(28,26,24,0.22);
          border-radius: 8px;
          padding: 11px 16px;
          font-family: 'Quicksand', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: background 0.15s, border-color 0.15s;
        }
        .oauth-btn:hover {
          background: rgba(28,26,24,0.05);
          border-color: rgba(28,26,24,0.35);
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 2px 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: repeating-linear-gradient(
            to right,
            rgba(28,26,24,0.3) 0px, rgba(28,26,24,0.3) 4px,
            transparent 4px, transparent 8px
          );
        }
        .divider-text {
          font-size: 12px;
          color: rgba(28,26,24,0.5);
          white-space: nowrap;
          letter-spacing: 0.04em;
        }

        .email-input {
          border: 1.5px solid rgba(28,26,24,0.18);
          border-radius: 8px;
          padding: 11px 14px;
          font-family: 'Quicksand', sans-serif;
          font-size: 14px;
          color: #1a1a1a;
          background: transparent;
          outline: none;
          transition: border-color 0.15s;
          letter-spacing: 0.02em;
        }
        .email-input::placeholder { color: rgba(28,26,24,0.38); }
        .email-input:focus { border-color: rgba(28,26,24,0.5); }

        .continue-btn {
          background: rgba(28,26,24,0.12);
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-family: 'Quicksand', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          cursor: pointer;
          letter-spacing: 0.05em;
          transition: background 0.15s;
        }
        .continue-btn:hover:not(:disabled) { background: rgba(28,26,24,0.2); }
        .continue-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .message {
          font-size: 12px;
          color: rgba(28,26,24,0.6);
          text-align: center;
        }

        .signup-text {
          font-size: 13px;
          color: rgba(28,26,24,0.55);
          text-align: center;
          margin-top: 4px;
        }
        .signup-link {
          font-weight: 600;
          color: #1a1a1a;
          text-decoration: none;
        }
        .signup-link:hover { text-decoration: underline; }
      `}</style>

      <main className="login-root">
        <div className="dots-bg" />

        {/* Drawing canvas — full page, behind UI */}
        <canvas ref={canvas_ref} className="draw-canvas" />

        {/* MARGIN heading with plain background patch */}
        <div className="margin-title-wrap">
          <h1 className="margin-title">MARGIN</h1>
        </div>

        {/* Login card */}
        <div className="login-card">
          <p className="login-heading">
            <strong>Login</strong> in with
          </p>

          <button className="oauth-btn" onClick={handleGoogle}>
            <GoogleIcon /> Continue with Google
          </button>

          <button className="oauth-btn" onClick={handleApple}>
            <AppleIcon /> Continue with Apple
          </button>

          <div className="divider">
            <span className="divider-line" />
            <span className="divider-text">Or continue with email</span>
            <span className="divider-line" />
          </div>

          <input
            className="email-input"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
          />

          <button className="continue-btn" onClick={handleEmailLogin} disabled={loading}>
            {loading ? 'Sending…' : 'Continue'}
          </button>

          {message && <p className="message">{message}</p>}

          <p className="signup-text">
            Don&apos;t you have an account?{' '}
            <a href="/auth/signup" className="signup-link">Sign up</a>
          </p>
        </div>
      </main>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="18" viewBox="0 0 814 1000" fill="#1a1a1a">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 439.8 41.3 285.7 41.3 226.8c0-193.7 125.4-296.1 248.2-296.1 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
  );
}