import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { MotionActor, MotionGraphicSpec, VisualColorToken } from '../types/cms';
import { MathText } from './MathText';

interface MotionGraphicPlayerProps {
  spec: MotionGraphicSpec;
}

const COLOR_MAP: Record<VisualColorToken, { stroke: string; fill: string }> = {
  primary: { stroke: '#1B6B46', fill: '#D6F0E1' },
  secondary: { stroke: '#0F766E', fill: '#CCFBF1' },
  warning: { stroke: '#B4690E', fill: '#FEF3C7' },
  danger: { stroke: '#B9382C', fill: '#FCECEA' },
};

function interpolateActor(actor: MotionActor, t: number) {
  const eased = t; // clear uniform progression synced to stage timestamps
  const x = actor.startX + (actor.endX - actor.startX) * eased;
  const y = actor.startY + (actor.endY - actor.startY) * eased;
  return { x, y };
}

export function MotionGraphicPlayer({ spec }: MotionGraphicPlayerProps) {
  const [progress, setProgress] = useState<number>(0); // 0..100
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);

  useEffect(() => {
    setProgress(0);
    setIsPlaying(true);
  }, [spec.id]);

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const pctPerSec = (100 / Math.max(1, spec.durationSec)) * speed;
      setProgress((prev) => {
        const next = prev + dt * pctPerSec;
        return next >= 100 ? 0 : next;
      });
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, speed, spec.durationSec]);

  const sortedStages = useMemo(
    () => [...spec.stages].sort((a, b) => a.atPercent - b.atPercent),
    [spec.stages],
  );

  const activeStage = useMemo(() => {
    let current = sortedStages[0];
    for (const s of sortedStages) {
      if (progress >= s.atPercent) current = s;
    }
    return current;
  }, [progress, sortedStages]);

  const t = Math.max(0, Math.min(1, progress / 100));

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {spec.title}
            </h4>
            <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
              <MathText text={spec.caption} />
            </p>
          </div>
          <span className="font-mono-tabular text-[11px] font-semibold text-[#1B6B46] dark:text-[#6CD19B]">
            Interactive Motion ({spec.durationSec}s)
          </span>
        </div>
      </div>

      {/* Strict 2-Zone Simulation Sandbox: ~65% SVG Visual Canvas / ~35% Controls & Stage Readout */}
      <div className="grid lg:grid-cols-[1.75fr_1fr]">
        <div className="border-b border-neutral-200 bg-white p-4 lg:border-r lg:border-b-0 dark:border-neutral-800 dark:bg-[#141A17]">
          <svg
            viewBox="0 0 360 190"
            className="h-auto w-full select-none"
            role="img"
            aria-label={spec.title}
          >
            {/* Reference Grid */}
            {[38, 76, 114, 152].map((y) => (
              <line
                key={`gy_${y}`}
                x1="18"
                y1={y}
                x2="342"
                y2={y}
                stroke="currentColor"
                className="text-neutral-200/70 dark:text-neutral-800"
                strokeWidth="1"
              />
            ))}
            {[72, 144, 216, 288].map((x) => (
              <line
                key={`gx_${x}`}
                x1={x}
                y1="18"
                x2={x}
                y2="172"
                stroke="currentColor"
                className="text-neutral-200/70 dark:text-neutral-800"
                strokeWidth="1"
              />
            ))}

            {/* Track / Baseline depending on sceneType */}
            {spec.sceneType === 'kinematics_track' && (
              <line
                x1="28"
                y1="126"
                x2="332"
                y2="126"
                stroke="currentColor"
                className="text-neutral-400 dark:text-neutral-600"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}
            {spec.sceneType === 'reaction_flow' && (
              <g>
                <line x1="125" y1="88" x2="235" y2="88" stroke="#1B6B46" strokeWidth="2" />
                <line
                  x1="235"
                  y1="100"
                  x2="125"
                  y2="100"
                  stroke="#B4690E"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              </g>
            )}
            {spec.sceneType === 'orbit_cycle' && (
              <ellipse
                cx="180"
                cy="95"
                rx="115"
                ry="56"
                fill="none"
                stroke="currentColor"
                className="text-neutral-300 dark:text-neutral-700"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )}
            {spec.sceneType === 'wave_oscillation' && (
              <path
                d={Array.from({ length: 48 }, (_, idx) => {
                  const px = 28 + idx * 6.5;
                  const py = 95 + Math.sin(idx * 0.45 + t * Math.PI * 2) * 38;
                  return `${idx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
                }).join(' ')}
                fill="none"
                stroke="#1B6B46"
                strokeWidth="2.5"
              />
            )}

            {/* Actors */}
            {spec.actors.map((actor) => {
              const { x, y } = interpolateActor(actor, t);
              const cx = 18 + (x / 100) * 324;
              const cy = 18 + (y / 100) * 154;
              const colors = COLOR_MAP[actor.colorToken] ?? COLOR_MAP.primary;
              const size = Math.max(10, Math.min(24, actor.size ?? 14));

              return (
                <g key={actor.id}>
                  {/* Motion path guide */}
                  <line
                    x1={18 + (actor.startX / 100) * 324}
                    y1={18 + (actor.startY / 100) * 154}
                    x2={18 + (actor.endX / 100) * 324}
                    y2={18 + (actor.endY / 100) * 154}
                    stroke={colors.stroke}
                    strokeOpacity="0.25"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {actor.shape === 'box' && (
                    <rect
                      x={cx - size}
                      y={cy - size * 0.7}
                      width={size * 2}
                      height={size * 1.4}
                      rx="5"
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="2"
                    />
                  )}

                  {actor.shape === 'circle' && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={size * 0.75}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="2"
                    />
                  )}

                  {actor.shape === 'molecule' && (
                    <g>
                      <circle
                        cx={cx - size * 0.45}
                        cy={cy}
                        r={size * 0.65}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth="2"
                      />
                      <circle
                        cx={cx + size * 0.45}
                        cy={cy}
                        r={size * 0.65}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth="2"
                      />
                    </g>
                  )}

                  {actor.shape === 'arrow' && (
                    <g>
                      <line
                        x1={cx - size}
                        y1={cy}
                        x2={cx + size}
                        y2={cy}
                        stroke={colors.stroke}
                        strokeWidth="2.5"
                      />
                      <polygon
                        points={`${cx + size + 5},${cy} ${cx + size - 3},${cy - 4} ${cx + size - 3},${cy + 4}`}
                        fill={colors.stroke}
                      />
                    </g>
                  )}

                  {actor.shape === 'wave' && (
                    <circle
                      cx={cx}
                      cy={95 + Math.sin(t * Math.PI * 2) * 36}
                      r={size * 0.6}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="2"
                    />
                  )}

                  <text
                    x={cx}
                    y={cy - size - 6}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="600"
                    fill={colors.stroke}
                  >
                    {actor.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Control Deck */}
        <div className="flex flex-col justify-between gap-4 p-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1B6B46] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155537]"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
                {([0.5, 1, 1.5] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`font-mono-tabular rounded px-2 py-1 text-[11px] font-semibold ${
                      speed === s
                        ? 'bg-[#1B6B46] text-white'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Timeline Scrubber</span>
                <span className="font-mono-tabular">{Math.round(progress)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(progress)}
                aria-label="Animation progress scrubber"
                onChange={(e) => {
                  setIsPlaying(false);
                  setProgress(Number(e.target.value));
                }}
                className="w-full accent-[#1B6B46]"
              />
            </div>

            {activeStage && (
              <div className="space-y-1.5 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xs font-bold text-[#1B6B46] dark:text-[#6CD19B]">
                  {activeStage.label}
                </div>
                {activeStage.formulaLatex && (
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    <MathText text={activeStage.formulaLatex} />
                  </div>
                )}
                <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {activeStage.callout}
                </p>
              </div>
            )}
          </div>

          {/* Clickable Stage Jumps */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Jump to Stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sortedStages.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setProgress(s.atPercent);
                  }}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                    activeStage?.label === s.label
                      ? 'border-[#1B6B46] bg-[#D6F0E1]/50 text-[#0A3320] dark:border-[#6CD19B] dark:bg-[#174F33] dark:text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
