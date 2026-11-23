import { useId } from 'react';
import type { UptimeSegment } from '../types';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = '#4f46e5',
  height = 28,
  width = 112,
  className = '',
}: SparklineProps) {
  const gradId = useId();
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 3;
  const innerH = height - padY * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = padY + innerH - ((val - min) / range) * innerH;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.25" fill={color} />
    </svg>
  );
}

interface UptimeTrackerProps {
  segments: UptimeSegment[];
}

export function UptimeTracker({ segments }: UptimeTrackerProps) {
  if (!segments || segments.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1" role="list" aria-label="14-day Make scenario execution health">
        {segments.map((seg) => {
          const barColor =
            seg.status === 'nominal'
              ? 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500/85 dark:hover:bg-emerald-400'
              : seg.status === 'warning'
                ? 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-500/85 dark:hover:bg-amber-400'
                : 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-500/85 dark:hover:bg-rose-400';

          return (
            <div
              key={seg.label}
              role="listitem"
              title={`${seg.label}: ${seg.detail}`}
              className={`h-6 flex-1 rounded-xs transition-colors cursor-default ${barColor}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
        <span>{segments[0]?.label}</span>
        <span>14-day scenario execution strip (hover bars for detail)</span>
        <span>{segments[segments.length - 1]?.label}</span>
      </div>
    </div>
  );
}
