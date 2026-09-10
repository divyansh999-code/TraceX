"use client";

/** Skeleton compositions + the refresh-flash hook used on screen/filter switches. */
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";

/**
 * Returns `ready=false` for ~260ms whenever deps change (mount included),
 * producing the console's "re-queried telemetry" flash.
 */
export function useRefresh(dep?: string): boolean {
  const { refreshKey } = useApp();
  const key = `${refreshKey}:${dep ?? ""}`;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t0 = setTimeout(() => setReady(false), 0);
    const t1 = setTimeout(() => setReady(true), 280);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [key]);
  return ready;
}

/** Ticking clock, mount-guarded (avoids SSR hydration drift). */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-4">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-28 mt-3" />
          <Skeleton className="h-[30px] w-full mt-3" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className, height = "h-56" }: { className?: string; height?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className={cn("w-full", height)} />
    </div>
  );
}

export function PanelSkeleton({ height = "h-56", className }: { height?: string; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className={cn("w-full", height)} />
    </div>
  );
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <Skeleton className="h-2.5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function ScreenSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-6 w-64" />
        </div>
        <Skeleton className="h-6 w-40" />
      </div>
      <KpiRowSkeleton />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <PanelSkeleton className="xl:col-span-8" height="h-64" />
        <PanelSkeleton className="xl:col-span-4" height="h-64" />
      </div>
    </div>
  );
}
