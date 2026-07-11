"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  OverlayMessage,
  GoalStateMsg,
  TipWarStateMsg,
  BossStateMsg,
  ThanksAlertMsg,
  SpotlightStateMsg,
  PredictionStateMsg,
  OracleStateMsg,
} from "@blaze-ignite/shared";
import { z } from "zod";

type Alert = z.infer<typeof ThanksAlertMsg> & { _id: number };
type Goal = z.infer<typeof GoalStateMsg>;
type War = z.infer<typeof TipWarStateMsg>;
type Boss = z.infer<typeof BossStateMsg>;
type Spotlight = z.infer<typeof SpotlightStateMsg>;
type Prediction = z.infer<typeof PredictionStateMsg>;
type Oracle = z.infer<typeof OracleStateMsg>;

export interface OverlayState {
  connected: boolean;
  /** FIFO queue of alerts to show; consumer shifts as each finishes. */
  alerts: Alert[];
  goals: Map<string, Goal>;
  wars: Map<string, War>;
  bosses: Map<string, Boss>;
  spotlight: Spotlight | null;
  prediction: Prediction | null;
  oracle: Oracle | null;
  /** Remove a consumed alert by its synthetic id. */
  dismissAlert: (id: number) => void;
}

/**
 * Connects an OBS overlay to the bridge using the channel's overlayToken and
 * reduces the incoming wire protocol into render-ready state. A `state` snapshot
 * (sent on every (re)connect) rehydrates progress so an OBS source refresh never
 * loses goals/wars/bosses/spotlight.
 */
export function useOverlaySocket(bridgeUrl: string, overlayToken: string): OverlayState {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [goals, setGoals] = useState<Map<string, Goal>>(new Map());
  const [wars, setWars] = useState<Map<string, War>>(new Map());
  const [bosses, setBosses] = useState<Map<string, Boss>>(new Map());
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const alertSeq = useRef(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(bridgeUrl, {
      transports: ["websocket", "polling"],
      auth: { overlayToken },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("overlay", (msg: OverlayMessage) => {
      switch (msg.type) {
        case "state":
          setGoals(new Map(msg.goals.map((g) => [g.goalId, g])));
          setWars(new Map(msg.wars.map((w) => [w.warId, w])));
          setBosses(new Map(msg.bosses.map((b) => [b.bossId, b])));
          if (msg.spotlight) setSpotlight(msg.spotlight);
          setPrediction(msg.prediction ?? null);
          if (msg.oracle) setOracle(msg.oracle);
          break;
        case "alert":
          setAlerts((prev) => [...prev, { ...msg, _id: alertSeq.current++ }]);
          break;
        case "goal":
          setGoals((prev) => new Map(prev).set(msg.goalId, msg));
          break;
        case "tipwar":
          setWars((prev) => new Map(prev).set(msg.warId, msg));
          break;
        case "boss":
          setBosses((prev) => new Map(prev).set(msg.bossId, msg));
          break;
        case "spotlight":
          setSpotlight(msg);
          break;
        case "prediction":
          setPrediction(msg);
          break;
        case "oracle":
          setOracle(msg);
          break;
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bridgeUrl, overlayToken]);

  const dismissAlert = (id: number) => setAlerts((prev) => prev.filter((a) => a._id !== id));

  return { connected, alerts, goals, wars, bosses, spotlight, prediction, oracle, dismissAlert };
}

// Re-export the pure display helpers so existing imports keep working.
export { formatAmount, posClass } from "./format";
