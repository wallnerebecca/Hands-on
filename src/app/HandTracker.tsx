"use client";

import { useEffect, useRef, useState } from "react";
import type { Results } from "@mediapipe/hands";

// Bypassing Next.js Turbopack strict ESM checks for older UMD modules
const camera_utils = require("@mediapipe/camera_utils");
const hands_module = require("@mediapipe/hands");
const drawing_utils = require("@mediapipe/drawing_utils");

const Camera =
  camera_utils.Camera ||
  (typeof window !== "undefined" && (window as any).Camera);
const Hands =
  hands_module.Hands ||
  (typeof window !== "undefined" && (window as any).Hands);
const HAND_CONNECTIONS =
  hands_module.HAND_CONNECTIONS ||
  (typeof window !== "undefined" && (window as any).HAND_CONNECTIONS);
const drawConnectors =
  drawing_utils.drawConnectors ||
  (typeof window !== "undefined" && (window as any).drawConnectors);
const drawLandmarks =
  drawing_utils.drawLandmarks ||
  (typeof window !== "undefined" && (window as any).drawLandmarks);

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  angularVelocity: number;
  color: string;
  active: boolean;
}

const drawPetal = (
  ctx: CanvasRenderingContext2D,
  p: Particle
) => {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(p.size, -p.size, p.size * 2, -p.size / 2, p.size * 2, 0);
  ctx.bezierCurveTo(p.size * 2, p.size / 2, p.size, p.size, 0, 0);
  ctx.fill();
  ctx.restore();
};

const drawSakuraFlower = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) => {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 183, 197, 0.9)";
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size, -size, size * 2, -size / 2, size * 2, 0);
    ctx.bezierCurveTo(size * 2, size / 2, size, size, 0, 0);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#FF1493";
  ctx.fill();
  ctx.restore();
};

export default function HandTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // References for the rAF loop
  const landmarksRef = useRef<any[] | null>(null);
  const fingertipsRef = useRef<{ x: number; y: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const pileHeightsRef = useRef<Float32Array | null>(null);
  const isClearingRef = useRef<boolean>(false);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    let isRunning = true;

    // The continuously running rAF loop for drawing + logic
    const renderLoop = () => {
      if (!isRunning) return;
      
      const W = canvasElement.width;
      const H = canvasElement.height;
      
      // Make sure our pile heightmap aligns with canvas size
      if (W > 0 && H > 0) {
        if (!pileHeightsRef.current || pileHeightsRef.current.length !== W) {
          pileHeightsRef.current = new Float32Array(W);
        }

        const pileHeights = pileHeightsRef.current!;

        // 1. Particle Spawning
        if (fingertipsRef.current && fingertipsRef.current.length > 0) {
          fingertipsRef.current.forEach((ft) => {
            // About 15% chance to spawn a particle per fingertip per frame
            if (Math.random() < 0.15) {
              const size = Math.random() * 8 + 4; // size from 4 to 12
              // ft.y is normalized 0 (top) to 1 (bottom).
              // lightness goes from 50 (darker) to 95 (pale pink)
              const lightness = 50 + ft.y * 45;
              particlesRef.current.push({
                x: ft.x * W,
                y: ft.y * H,
                vx: (Math.random() - 0.5) * 3, // slightly dispersed
                vy: Math.random() * 2 + 1, // down
                size: size,
                angle: Math.random() * Math.PI * 2,
                angularVelocity: (Math.random() - 0.5) * 0.1,
                // Pinkish random colors
                color: `hsl(${Math.random() * 20 + 330}, 100%, ${lightness}%)`,
                active: true,
              });
            }
          });
        }

        // 2. Clear state checks
        let maxPile = 0;
        for (let i = 0; i < W; i++) {
          if (pileHeights[i] > maxPile) maxPile = pileHeights[i];
        }

        if (maxPile > H / 2 && !isClearingRef.current) {
          isClearingRef.current = true;
          // Reactivate all resting particles to fall off the screen
          particlesRef.current.forEach((p) => {
            if (!p.active) {
              p.active = true;
              p.vy = Math.random() * 3 + 4; // give them a push down
            }
          });
          pileHeights.fill(0); // reset pile map

          // Return to normal mode after 4 seconds to let them fall out
          setTimeout(() => {
            isClearingRef.current = false;
          }, 4000);
        }

        // 3. Update particle physics
        const nextParticles: Particle[] = [];
        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          if (p.active) {
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.angularVelocity;
            // Swaying logic (horizontal drift)
            p.vx += (Math.random() - 0.5) * 0.3;
            // Cap horizontal speed
            if (p.vx > 2) p.vx = 2;
            if (p.vx < -2) p.vx = -2;

            if (!isClearingRef.current) {
              const px = Math.floor(Math.max(0, Math.min(W - 1, p.x)));
              const floorY = H - pileHeights[px];

              // Check if particle hits the pile height
              if (p.y + p.size >= floorY) {
                p.y = floorY - p.size;
                p.active = false;

                // Expand pile locally using a bell-curve spread
                const radius = Math.floor(p.size * 2.5);
                for (let dx = -radius; dx <= radius; dx++) {
                  let tx = px + dx;
                  if (tx >= 0 && tx < W) {
                    let add = Math.max(0, p.size - Math.abs(dx) * 0.4) * 0.8;
                    pileHeights[tx] += add;
                  }
                }
              }
            }

            // Remove particles that go out of bounding box entirely
            if (p.y > H + p.size * 5) {
              continue; // Drop from the tracking array
            }
          }
          nextParticles.push(p);
        }
        particlesRef.current = nextParticles;

        // 4. Drawing Phase
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, W, H);

        // Draw MediaPipe Landmarks first
        if (landmarksRef.current) {
          for (const landmarks of landmarksRef.current) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
              color: "#5C4033", // Brown branch color
              lineWidth: 4,
            });
            // Draw cherry blossom flowers instead of standard landmarks
            for (const lm of landmarks) {
              drawSakuraFlower(canvasCtx, lm.x * W, lm.y * H, 4);
            }
          }
        }

        // Draw Sakuras on top
        for (const p of particlesRef.current) {
          drawPetal(canvasCtx, p);
        }

        canvasCtx.restore();
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    // The MediaPipe Results Hook
    const onResults = (results: Results) => {
      // Sync canvas width
      if (
        canvasElement.width !== videoElement.videoWidth ||
        canvasElement.height !== videoElement.videoHeight
      ) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
      }

      // 1. Pass the landmarks over for the rAF loop to draw
      landmarksRef.current = results.multiHandLandmarks || null;

      // 2. Extract fingertips (indexes 4, 8, 12, 16, 20) for easy emission
      const newFingertips = [];
      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          const indices = [4, 8, 12, 16, 20];
          for (const index of indices) {
            if (landmarks[index]) {
               newFingertips.push({ x: landmarks[index].x, y: landmarks[index].y });
            }
          }
        }
      }
      fingertipsRef.current = newFingertips;
    };

    const hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        setIsLoading(false);
        await hands.send({ image: videoElement });
      },
      width: 1280,
      height: 720,
    });

    camera.start();
    // Start rAF loop immediately
    animationRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationRef.current);
      camera.stop();
      hands.close();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-20">
          <p className="text-xl font-bold animate-pulse">
            Loading Camera & Vision Models...
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-0"
        playsInline
      ></video>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-10 pointer-events-none"
      ></canvas>
    </main>
  );
}
