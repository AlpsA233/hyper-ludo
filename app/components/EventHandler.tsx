"use client";

import React from "react";
import EventModal from "@/app/components/EventModal";
import type { GameEvent, Player } from "@/app/types";

interface EventHandlerProps {
  activeEvent: GameEvent | null;
  isCurrentPlayerTurn: boolean;
  players: Player[];
  turn: number;
  numPlayers: number;
  totalSteps: number;
  isMultiplayer: boolean;
  roomId: string | null;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setTurn: (v: number) => void;
  setPhase: (v: any) => void;
  setIsMoving: (v: boolean) => void;
  setActiveEvent: (e: GameEvent | null) => void;
  setHasUsedCard: (v: boolean) => void;
  calculateNewPosition: (player: Player, steps: number) => { pos: number; lap: number };
  animatePieceMove: (idx: number, cb: () => void) => void;
  addLog: (msg: string) => void;
  roomMovePlayer: (pos: number, lap: number, targetIdx?: number) => Promise<any>;
  endPlayerTurn: () => Promise<any>;
  t: any;
}

export default function EventHandler({
  activeEvent, isCurrentPlayerTurn, players, turn, numPlayers, totalSteps,
  isMultiplayer, roomId, setPlayers, setTurn, setPhase, setIsMoving,
  setActiveEvent, setHasUsedCard, calculateNewPosition, animatePieceMove,
  addLog, roomMovePlayer, endPlayerTurn, t,
}: EventHandlerProps) {

  const applyEventEffect = async () => {
    if (!activeEvent) return;

    if (isMultiplayer && !isCurrentPlayerTurn) {
      setActiveEvent(null);
      setPhase("playing");
      return;
    }

    const getAffectedIndices = (): number[] => {
      const target = activeEvent.target || "SELF";
      if (target === "ALL_PLAYERS") return Array.from({ length: numPlayers }, (_, i) => i);
      if (target === "RANDOM_OTHER") {
        const others = Array.from({ length: numPlayers }, (_, i) => i).filter((i) => i !== turn);
        return others.length === 0 ? [] : [others[Math.floor(Math.random() * others.length)]];
      }
      return [turn];
    };

    const affected = getAffectedIndices();

    const syncEventAndEndTurn = async (
      updates: Array<{ playerIndex: number; position?: number; lap?: number; skipTurn?: boolean }>,
    ) => {
      if (!isMultiplayer || !roomId) return;
      for (const upd of updates) {
        if (upd.position !== undefined || upd.skipTurn !== undefined) {
          await roomMovePlayer(
            upd.position ?? players[upd.playerIndex]?.pos ?? 0,
            upd.lap ?? players[upd.playerIndex]?.lap ?? 0,
            upd.playerIndex,
          ).catch(console.error);
        }
      }
      try { const d = await endPlayerTurn(); setTurn(d.turn); }
      catch { setTurn((turn + 1) % numPlayers); }
      setHasUsedCard(false);
    };

    const advanceTurn = async (updates: any[]) => {
      if (!isMultiplayer || !roomId) { setTurn((turn + 1) % numPlayers); }
      else { await syncEventAndEndTurn(updates); }
      setIsMoving(false);
      setActiveEvent(null);
      setHasUsedCard(false);
    };

    if (activeEvent.type === "MOVE" && activeEvent.val !== 0) {
      const newPositions: Array<{ playerIndex: number; position: number; lap: number }> = [];
      setPlayers((prev) => {
        const next = [...prev];
        affected.forEach((idx) => {
          const np = calculateNewPosition(prev[idx], activeEvent.val);
          next[idx] = { ...next[idx], pos: np.pos, lap: np.lap };
          newPositions.push({ playerIndex: idx, position: np.pos, lap: np.lap });
        });
        return next;
      });
      addLog(`Event: ${affected.map((i) => `Player ${i + 1}`).join(", ")} moved ${activeEvent.val > 0 ? "+" : ""}${activeEvent.val}`);
      animatePieceMove(affected[0] ?? turn, async () => {
        setPhase("playing");
        await advanceTurn(newPositions);
      });

    } else if (activeEvent.type === "SKIP") {
      setPlayers((prev) => {
        const next = [...prev];
        affected.forEach((idx) => { next[idx] = { ...next[idx], skipTurn: true }; });
        return next;
      });
      addLog(`Event: ${affected.map((i) => `Player ${i + 1}`).join(", ")} will skip next turn`);
      setPhase("playing");
      await advanceTurn(affected.map((idx) => ({ playerIndex: idx, skipTurn: true })));

    } else if (activeEvent.type === "RESTART_LAP") {
      const newPositions: Array<{ playerIndex: number; position: number; lap: number }> = [];
      setPlayers((prev) => {
        const next = [...prev];
        affected.forEach((idx) => {
          const cp = next[idx];
          const lapStartPos = (cp.startPos + cp.lap * totalSteps) % totalSteps;
          next[idx] = { ...next[idx], pos: lapStartPos };
          newPositions.push({ playerIndex: idx, position: lapStartPos, lap: cp.lap });
        });
        return next;
      });
      addLog(`Event: ${affected.map((i) => `Player ${i + 1}`).join(", ")} returned to lap start`);
      animatePieceMove(affected[0] ?? turn, async () => {
        setPhase("playing");
        await advanceTurn(newPositions);
      });

    } else {
      addLog(`Event: ${activeEvent.text}`);
      setPhase("playing");
      await advanceTurn([]);
    }
  };

  return (
    <EventModal
      activeEvent={activeEvent}
      isCurrentPlayerTurn={isCurrentPlayerTurn}
      applyEventEffect={applyEventEffect}
      t={t}
    />
  );
}
