import React, { useEffect, useRef } from 'react';

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  phase: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: string;
}

export const AuthAmbientBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const pointer = {
      x: width * 0.5,
      y: height * 0.45,
      targetX: width * 0.5,
      targetY: height * 0.45,
      active: false,
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
      pointer.active = true;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 1. Dynamic Volumetric Aurora Orbs (Canva / YouTube Ambient style)
    const orbColors = [
      'rgba(79, 70, 229, 0.24)',   // Royal Indigo
      'rgba(6, 182, 212, 0.18)',   // Cyber Cyan
      'rgba(124, 58, 237, 0.20)',  // Electric Violet
      'rgba(37, 99, 235, 0.18)',   // Deep Sapphire
      'rgba(16, 185, 129, 0.10)',  // Subtle Emerald Accent
    ];

    const orbs: Orb[] = orbColors.map((color, idx) => ({
      x: width * (0.18 + idx * 0.16),
      y: height * (0.25 + (idx % 2) * 0.45),
      vx: (idx % 2 === 0 ? 1 : -1) * (0.35 + idx * 0.08),
      vy: (idx % 3 === 0 ? -1 : 1) * (0.28 + idx * 0.06),
      radius: Math.min(width, height) * (0.32 + (idx % 3) * 0.08),
      color,
      phase: idx * 1.3,
      speed: 0.008 + idx * 0.002,
    }));

    // 2. Interactive Constellation Particles
    const particleCount = Math.min(65, Math.max(36, Math.floor((width * height) / 26000)));
    const particles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.48,
      vy: (Math.random() - 0.5) * 0.48,
      size: 1.2 + (i % 3) * 0.65,
      alpha: 0.25 + Math.random() * 0.55,
      hue: i % 3 === 0 ? '#38bdf8' : i % 2 === 0 ? '#818cf8' : '#c084fc',
    }));

    let tick = 0;

    const render = () => {
      tick += 1;

      // Smooth spring interpolation for cursor spotlight
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;

      // Base Obsidian Canvas Fill
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      // Draw Drifting Volumetric Aurora Orbs
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const orb of orbs) {
        orb.phase += orb.speed;
        orb.x += orb.vx + Math.sin(orb.phase) * 0.35;
        orb.y += orb.vy + Math.cos(orb.phase * 0.8) * 0.35;

        if (orb.x < -orb.radius * 0.4) orb.vx = Math.abs(orb.vx);
        if (orb.x > width + orb.radius * 0.4) orb.vx = -Math.abs(orb.vx);
        if (orb.y < -orb.radius * 0.4) orb.vy = Math.abs(orb.vy);
        if (orb.y > height + orb.radius * 0.4) orb.vy = -Math.abs(orb.vy);

        const pulseRadius = orb.radius * (1 + Math.sin(orb.phase) * 0.08);
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, pulseRadius);
        grad.addColorStop(0, orb.color);
        grad.addColorStop(0.55, orb.color.replace(/[\d.]+\)$/g, '0.06)'));
        grad.addColorStop(1, 'rgba(3, 7, 18, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cursor-Tracking Interactive Ambient Spotlight
      const cursorGrad = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        Math.min(width, height) * 0.48
      );
      cursorGrad.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
      cursorGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.09)');
      cursorGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
      ctx.fillStyle = cursorGrad;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, Math.min(width, height) * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic Flowing Sine Wave Ribbon across the canvas horizon
      ctx.beginPath();
      for (let x = 0; x <= width; x += 24) {
        const waveY =
          height * 0.52 +
          Math.sin(x * 0.0028 + tick * 0.015) * 65 +
          Math.cos(x * 0.0014 - tick * 0.01) * 40;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      for (let x = 0; x <= width; x += 24) {
        const waveY =
          height * 0.48 +
          Math.cos(x * 0.0024 + tick * 0.012) * 75 +
          Math.sin(x * 0.0018 + tick * 0.009) * 35;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();

      // Update & Draw Interactive Constellation Nodes + Connecting Filaments
      const connectionDist = 145;
      const cursorDist = 210;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Subtle attraction/repulsion to cursor
        const dxCursor = pointer.x - p.x;
        const dyCursor = pointer.y - p.y;
        const distCursor = Math.sqrt(dxCursor * dxCursor + dyCursor * dyCursor);

        if (distCursor < cursorDist) {
          const opacity = (1 - distCursor / cursorDist) * 0.32;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = `rgba(56, 189, 248, ${opacity.toFixed(3)})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Connect neighboring particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const lineAlpha = (1 - dist / connectionDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${lineAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Draw glowing node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.hue;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#030712]"
      aria-hidden="true"
    >
      {/* 60fps Interactive HTML5 Canvas Engine */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Precision Architectural Grid Overlay with Radial Vignette */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:56px_56px]"
        style={{
          maskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%, #000 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 75% at 50% 50%, #000 30%, transparent 100%)',
        }}
      />

      {/* Top & Bottom Subtle Horizon Light Hairlines */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent" />
    </div>
  );
};

export default AuthAmbientBackground;
