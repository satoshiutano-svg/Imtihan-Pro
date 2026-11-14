import { useMemo, useState } from 'react';
import type { GraphSpec, VisualColorToken } from '../types/cms';
import { MathText } from './MathText';

interface MathGraphViewProps {
  spec: GraphSpec;
}

const SERIES_COLORS: Record<VisualColorToken, string> = {
  primary: '#1B6B46',
  secondary: '#0F766E',
  warning: '#B4690E',
  danger: '#B9382C',
};

function interpolateY(points: { x: number; y: number }[], targetX: number): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return 0;
  if (targetX <= sorted[0].x) return sorted[0].y;
  if (targetX >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (targetX >= a.x && targetX <= b.x) {
      const span = b.x - a.x;
      if (span === 0) return a.y;
      const ratio = (targetX - a.x) / span;
      return a.y + (b.y - a.y) * ratio;
    }
  }
  return sorted[0].y;
}

export function MathGraphView({ spec }: MathGraphViewProps) {
  const midpoint = useMemo(() => (spec.xMin + spec.xMax) / 2, [spec.xMin, spec.xMax]);
  const [traceX, setTraceX] = useState<number>(midpoint);

  const padLeft = 46;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 38;
  const width = 360;
  const height = 210;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toSvgX = (x: number) =>
    padLeft + ((x - spec.xMin) / Math.max(1e-6, spec.xMax - spec.xMin)) * plotW;
  const toSvgY = (y: number) =>
    padTop + plotH - ((y - spec.yMin) / Math.max(1e-6, spec.yMax - spec.yMin)) * plotH;

  const traceSvgX = toSvgX(traceX);

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
            Interactive Plot
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.75fr_1fr]">
        <div className="border-b border-neutral-200 bg-white p-4 lg:border-r lg:border-b-0 dark:border-neutral-800 dark:bg-[#141A17]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full select-none"
            role="img"
            aria-label={spec.title}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const gx = padLeft + f * plotW;
              const gy = padTop + f * plotH;
              const yTick = spec.yMax - f * (spec.yMax - spec.yMin);
              const xTick = spec.xMin + f * (spec.xMax - spec.xMin);
              return (
                <g key={f}>
                  <line
                    x1={padLeft}
                    y1={gy}
                    x2={padLeft + plotW}
                    y2={gy}
                    stroke="currentColor"
                    className="text-neutral-200 dark:text-neutral-800"
                    strokeWidth="1"
                  />
                  <line
                    x1={gx}
                    y1={padTop}
                    x2={gx}
                    y2={padTop + plotH}
                    stroke="currentColor"
                    className="text-neutral-200 dark:text-neutral-800"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={gy + 3}
                    textAnchor="end"
                    fontSize="9.5"
                    fill="currentColor"
                    className="font-mono-tabular text-neutral-500 dark:text-neutral-400"
                  >
                    {Number.isInteger(yTick) ? yTick : yTick.toFixed(1)}
                  </text>
                  <text
                    x={gx}
                    y={padTop + plotH + 13}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="currentColor"
                    className="font-mono-tabular text-neutral-500 dark:text-neutral-400"
                  >
                    {Number.isInteger(xTick) ? xTick : xTick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={padLeft}
              y1={padTop}
              x2={padLeft}
              y2={padTop + plotH}
              stroke="currentColor"
              className="text-neutral-500 dark:text-neutral-400"
              strokeWidth="1.5"
            />
            <line
              x1={padLeft}
              y1={padTop + plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH}
              stroke="currentColor"
              className="text-neutral-500 dark:text-neutral-400"
              strokeWidth="1.5"
            />

            {/* Axis Labels */}
            <text
              x={padLeft + plotW / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="currentColor"
              className="text-neutral-700 dark:text-neutral-300"
            >
              {spec.xLabel}
            </text>
            <text
              x={13}
              y={padTop + plotH / 2}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="currentColor"
              className="text-neutral-700 dark:text-neutral-300"
              transform={`rotate(-90 13 ${padTop + plotH / 2})`}
            >
              {spec.yLabel}
            </text>

            {/* Series Curves & Optional Shaded Area */}
            {spec.series.map((s) => {
              const color = SERIES_COLORS[s.colorToken] ?? SERIES_COLORS.primary;
              const sorted = [...s.points].sort((a, b) => a.x - b.x);
              const linePath = sorted
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toSvgX(p.x).toFixed(1)} ${toSvgY(p.y).toFixed(1)}`)
                .join(' ');
              const areaPath = `${linePath} L ${toSvgX(sorted[sorted.length - 1].x).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${toSvgX(sorted[0].x).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

              return (
                <g key={s.name}>
                  {s.showArea && <path d={areaPath} fill={color} fillOpacity="0.14" />}
                  <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
                </g>
              );
            })}

            {/* Highlight Markers */}
            {spec.highlights.map((hl, idx) => {
              const hx = toSvgX(hl.x);
              const hy = toSvgY(hl.y);
              return (
                <g key={idx}>
                  <circle cx={hx} cy={hy} r="4" fill="#B4690E" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text
                    x={Math.min(width - 42, hx)}
                    y={Math.max(padTop + 10, hy - 8)}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="#B4690E"
                  >
                    {hl.label}
                  </text>
                </g>
              );
            })}

            {/* Interactive Trace Cursor */}
            <line
              x1={traceSvgX}
              y1={padTop}
              x2={traceSvgX}
              y2={padTop + plotH}
              stroke="#1B6B46"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            {spec.series.map((s) => {
              const valY = interpolateY(s.points, traceX);
              const color = SERIES_COLORS[s.colorToken] ?? SERIES_COLORS.primary;
              return (
                <circle
                  key={`tr_${s.name}`}
                  cx={traceSvgX}
                  cy={toSvgY(valY)}
                  r="4.5"
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Trace Scrubber & Readouts */}
        <div className="flex flex-col justify-between gap-3 p-4 text-xs">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Trace Value ({spec.xLabel})</span>
                <span className="font-mono-tabular font-semibold text-neutral-900 dark:text-neutral-100">
                  {traceX.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={spec.xMin}
                max={spec.xMax}
                step={(spec.xMax - spec.xMin) / 40}
                value={traceX}
                aria-label="Trace X value on graph"
                onChange={(e) => setTraceX(Number(e.target.value))}
                className="w-full accent-[#1B6B46]"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Values at x = {traceX.toFixed(2)}
              </div>
              {spec.series.map((s) => {
                const yVal = interpolateY(s.points, traceX);
                const color = SERIES_COLORS[s.colorToken] ?? SERIES_COLORS.primary;
                return (
                  <div key={s.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {s.name}
                    </span>
                    <span className="font-mono-tabular font-bold text-neutral-900 dark:text-white">
                      {yVal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {spec.highlights.length > 0 && (
            <div className="space-y-1 border-t border-neutral-200 pt-2.5 dark:border-neutral-800">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Key Points
              </div>
              {spec.highlights.map((hl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTraceX(hl.x)}
                  className="mr-1.5 mb-1 inline-flex rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  {hl.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
