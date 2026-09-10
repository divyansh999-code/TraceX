"use client";

/** Minimal SVG sparkline — deterministic, zero dependencies. */
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  color = "#5FA1C4",
  width = 88,
  height = 26,
  strokeWidth = 1.5,
  area = true,
  baseline,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  area?: boolean;
  baseline?: number; // optional dashed reference y value
  className?: string;
}) {
  const gid = useId().replace(/[:]/g, "");
  if (!data.length) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data, baseline ?? Infinity);
  const max = Math.max(...data, baseline ?? -Infinity);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i / (data.length - 1 || 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = `${line} L${x(data.length - 1).toFixed(1)},${height - pad} L${pad},${height - pad} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#sg-${gid})`} />
        </>
      )}
      {baseline !== undefined && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="currentColor"
          className="text-muted-foreground/50"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="1.8" fill={color} />
    </svg>
  );
}
