"use client";

import { useSearchParams } from "next/navigation";
import { useOverlaySocket } from "@/lib/useOverlaySocket";
import { AlertWidget } from "@/components/overlay/AlertWidget";
import { GoalWidget } from "@/components/overlay/GoalWidget";
import { BossWidget } from "@/components/overlay/BossWidget";
import { TipWarWidget } from "@/components/overlay/TipWarWidget";
import { SpotlightWidget } from "@/components/overlay/SpotlightWidget";

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:4000";

const WIDGETS = ["alert", "goal", "boss", "tipwar", "spotlight"] as const;
type Widget = (typeof WIDGETS)[number];

export function OverlayClient({ token, widget }: { token: string; widget: string }) {
  const state = useOverlaySocket(BRIDGE_URL, token);
  // Optional ?pos=top-left|top-center|top-right|center|bottom-left|... override.
  const pos = useSearchParams().get("pos");

  if (!WIDGETS.includes(widget as Widget)) {
    return (
      <div className="overlay-root flex h-screen items-center justify-center text-sm text-zinc-500">
        Unknown overlay “{widget}”. Use one of: {WIDGETS.join(", ")}.
      </div>
    );
  }

  switch (widget as Widget) {
    case "alert":
      return <AlertWidget state={state} pos={pos} />;
    case "goal":
      return <GoalWidget state={state} pos={pos} />;
    case "boss":
      return <BossWidget state={state} pos={pos} />;
    case "tipwar":
      return <TipWarWidget state={state} pos={pos} />;
    case "spotlight":
      return <SpotlightWidget state={state} pos={pos} />;
  }
}
