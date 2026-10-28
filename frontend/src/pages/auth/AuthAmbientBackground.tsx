import React, { useEffect, useState } from 'react';

export const AuthAmbientBackground: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#050814]"
      aria-hidden="true"
    >
      {/* Interactive Cursor Spotlight */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.13), rgba(34, 211, 238, 0.05) 40%, transparent 70%)`,
        }}
      />

      {/* Deep Atmospheric Aurora & Volumetric Light Cones */}
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[520px] rounded-full bg-gradient-to-b from-indigo-600/22 via-cyan-500/10 to-transparent blur-[130px] animate-float-slow" />
      <div className="absolute -bottom-56 left-1/4 w-[700px] h-[420px] rounded-full bg-indigo-700/15 blur-[140px] animate-float-reverse" />
      <div className="absolute top-1/4 -right-32 w-[550px] h-[550px] rounded-full bg-cyan-500/10 blur-[130px] animate-float-medium" />

      {/* Angled Top-Down Architectural Light Rays */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'conic-gradient(from 180deg at 50% -10%, transparent 140deg, rgba(99, 102, 241, 0.16) 168deg, rgba(34, 211, 238, 0.14) 180deg, rgba(99, 102, 241, 0.16) 192deg, transparent 220deg)',
        }}
      />

      {/* Fine Isometric / Architectural Coordinate Grid with Radial Vignette */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px]"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 75% at 50% 50%, #000 35%, transparent 100%)',
        }}
      />

      {/* Sub-grid precision hairlines */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:192px_192px]"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 70% at 50% 50%, #000 40%, transparent 100%)',
        }}
      />

      {/* Centered Geometric Vault Rings & Animated Circuit Light Beams */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="w-[1200px] h-[1200px] max-w-none opacity-65"
          viewBox="0 0 1200 1200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="vaultRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="beamGradIndigo" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="beamGradCyan" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer Static Horizon Ring */}
          <circle
            cx="600"
            cy="600"
            r="520"
            stroke="url(#vaultRingGrad)"
            strokeWidth="1"
            strokeOpacity="0.3"
          />

          {/* Slowly Rotating Precision Dashed Vault Ring */}
          <g className="origin-center animate-spin-slow" style={{ transformOrigin: '600px 600px' }}>
            <circle
              cx="600"
              cy="600"
              r="430"
              stroke="url(#vaultRingGrad)"
              strokeWidth="1.2"
              strokeDasharray="6 14 24 14"
            />
            <circle cx="600" cy="170" r="3.5" fill="#818cf8" fillOpacity="0.8" />
            <circle cx="1030" cy="600" r="3.5" fill="#22d3ee" fillOpacity="0.8" />
            <circle cx="600" cy="1030" r="3.5" fill="#818cf8" fillOpacity="0.8" />
            <circle cx="170" cy="600" r="3.5" fill="#22d3ee" fillOpacity="0.8" />
          </g>

          {/* Counter-Rotating Inner Security Ring */}
          <g
            className="origin-center animate-spin-reverse-slow"
            style={{ transformOrigin: '600px 600px' }}
          >
            <circle
              cx="600"
              cy="600"
              r="335"
              stroke="url(#vaultRingGrad)"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
            <circle
              cx="600"
              cy="600"
              r="310"
              stroke="#6366f1"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="80 180"
            />
          </g>

          {/* Animated Data Traces Converging Toward the Vault Center */}
          <path
            d="M 60 360 L 340 360 L 440 460"
            stroke="rgba(99, 102, 241, 0.14)"
            strokeWidth="1.2"
          />
          <path
            d="M 60 360 L 340 360 L 440 460"
            stroke="url(#beamGradIndigo)"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-beam-1"
          />

          <path
            d="M 1140 380 L 860 380 L 760 480"
            stroke="rgba(34, 211, 238, 0.14)"
            strokeWidth="1.2"
          />
          <path
            d="M 1140 380 L 860 380 L 760 480"
            stroke="url(#beamGradCyan)"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-beam-2"
          />

          <path
            d="M 100 840 L 360 840 L 450 750"
            stroke="rgba(34, 211, 238, 0.12)"
            strokeWidth="1.2"
          />
          <path
            d="M 100 840 L 360 840 L 450 750"
            stroke="url(#beamGradCyan)"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-beam-3"
          />

          <path
            d="M 1100 820 L 840 820 L 750 730"
            stroke="rgba(99, 102, 241, 0.12)"
            strokeWidth="1.2"
          />
          <path
            d="M 1100 820 L 840 820 L 750 730"
            stroke="url(#beamGradIndigo)"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-beam-1"
          />

          {/* Glowing Intersection Nodes */}
          <circle cx="340" cy="360" r="3" fill="#6366f1" fillOpacity="0.5" />
          <circle cx="860" cy="380" r="3" fill="#22d3ee" fillOpacity="0.5" />
          <circle cx="360" cy="840" r="3" fill="#22d3ee" fillOpacity="0.5" />
          <circle cx="840" cy="820" r="3" fill="#6366f1" fillOpacity="0.5" />
        </svg>
      </div>

      {/* Bottom Horizon Glow */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </div>
  );
};

export default AuthAmbientBackground;
