"use client";

/** Interim stub helper — each module file replaces this usage when built. */
import { ScreenHeader } from "../common/ScreenHeader";
import { Panel, Badge } from "../common/primitives";
import { Cog } from "lucide-react";

export function StubScreen({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader kicker={`MODULE ${code}`} title={title} description={description} />
      <Panel title="Module calibration" icon={Cog} right={<Badge tone="amber" dot>in progress</Badge>}>
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Cog className="size-6 animate-spin" strokeWidth={1.5} />
          <span className="text-xs">Telemetry relays for this module are being provisioned…</span>
        </div>
      </Panel>
    </div>
  );
}
