"use client";

import { useEffect } from "react";
import { COLORS } from "@/app/constants";
import type { Player, GameEvent } from "@/app/types";

interface UseMultiplayerSyncOptions {
  roomId: string | null;
  room: any;
  roomPlayers: any[];
  gameState: any;
  isMultiplayer: boolean;
  phase: string;
  turn: number;
  diceValue: number;
  diceResults: number[];
  lapsToWin: number;
  activeEvent: GameEvent | null;
  currentPlayerIndex: number | null;
  isMoving: boolean;
  isRolling: boolean;
  effectiveUserId: string | null;
  initialCards: number;
  // Setters
  setIsMultiplayer: (v: boolean) => void;
  setCurrentPlayerIndex: (v: number | null) => void;
  setNumPlayers: (v: number) => void;
  setDiceCount: (v: number) => void;
  setLapsToWin: (v: number) => void;
  setInitialCards: (v: number) => void;
  setEventDensity: (v: number) => void;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setTurn: (v: number) => void;
  setBoardTiles: (v: any[]) => void;
  setPhase: (v: any) => void;
  setDiceValue: (v: number) => void;
  setDiceResults: (v: number[]) => void;
  setActiveEvent: (e: GameEvent | null) => void;
  subscribe: (roomId: string) => () => void;
  addLog: (msg: string) => void;
  // User data
  cardDatabase: any[];
  userData: any;
}

export function useMultiplayerSync(opts: UseMultiplayerSyncOptions) {
  const {
    roomId,
    room,
    roomPlayers,
    gameState,
    isMultiplayer,
    phase,
    turn,
    diceValue,
    diceResults,
    lapsToWin,
    activeEvent,
    currentPlayerIndex,
    isMoving,
    isRolling,
    effectiveUserId,
    initialCards,
    setIsMultiplayer,
    setCurrentPlayerIndex,
    setNumPlayers,
    setDiceCount,
    setLapsToWin,
    setInitialCards,
    setEventDensity,
    setPlayers,
    setTurn,
    setBoardTiles,
    setPhase,
    setDiceValue,
    setDiceResults,
    setActiveEvent,
    subscribe,
    addLog,
    cardDatabase,
    userData,
  } = opts;

  // ── Subscribe & cleanup ───────────────────────────────────
  useEffect(() => {
    if (!roomId) {
      setIsMultiplayer(false);
      setCurrentPlayerIndex(null);
      return;
    }
    setIsMultiplayer(true);
    const unsubscribe = subscribe(roomId);
    return () => {
      unsubscribe();
      setIsMultiplayer(false);
      setCurrentPlayerIndex(null);
    };
  }, [roomId, subscribe]);

  // ── Compute current player index ─────────────────────────
  useEffect(() => {
    if (!roomId || !room || roomPlayers.length === 0 || !effectiveUserId)
      return;
    const idx = roomPlayers.findIndex((p) => p.user_id === effectiveUserId);
    setCurrentPlayerIndex(idx >= 0 ? idx : null);
  }, [roomPlayers, effectiveUserId, room, roomId]);

  // ── Init game when room transitions to "playing" ─────────
  useEffect(() => {
    if (!room || !roomId || phase !== "room_lobby") return;
    if (room.state !== "playing") return;
    if (!roomPlayers.length || !gameState) return;

    setNumPlayers(room.num_players);
    setDiceCount(room.dice_count);
    setLapsToWin(room.laps_to_win);
    setInitialCards(room.initial_cards);
    setEventDensity(room.event_density);

    const gamePlayers: Player[] = [...roomPlayers]
      .sort((a, b) => a.player_index - b.player_index)
      .map((rp) => {
        const cardDb = gameState.card_database?.length
          ? gameState.card_database
          : cardDatabase;
        return {
          id: rp.player_index,
          color: COLORS[rp.color_index % COLORS.length],
          pos: -1,
          lap: 0,
          startPos: 10 * rp.player_index,
          shield: false,
          skipTurn: false,
          cards: Array.from({ length: room.initial_cards || initialCards }).map(
            () => {
              const base = cardDb[Math.floor(Math.random() * cardDb.length)];
              return {
                id: base.id,
                rarity: base.rarity as "NR" | "R" | "SR" | "SSR",
                name: base.name,
                desc: base.desc,
                pattern: base.pattern,
                target: base.target,
                effect: base.effect,
              };
            },
          ),
          avatar: rp.avatar || ["🔵", "🟣", "🟡", "🟢"][rp.player_index % 4],
          name: rp.player_name || `Player ${rp.player_index + 1}`,
        };
      });

    setPlayers(gamePlayers);
    setTurn(0);
    if (gameState.board_tiles?.length > 0) setBoardTiles(gameState.board_tiles);
    setPhase("playing");
  }, [room?.state, roomId, phase, roomPlayers, gameState]);

  // ── Sync gameState changes ────────────────────────────────
  useEffect(() => {
    if (!gameState || !isMultiplayer) return;

    if (gameState.turn !== undefined && gameState.turn !== turn)
      setTurn(gameState.turn);

    if (gameState.dice_results?.length > 0) {
      if (
        JSON.stringify(gameState.dice_results) !== JSON.stringify(diceResults)
      )
        setDiceResults(gameState.dice_results);
    }
    if (
      gameState.dice_value !== undefined &&
      gameState.dice_value !== diceValue
    )
      setDiceValue(gameState.dice_value);

    if (gameState.phase === "moving" && !isMoving && !isRolling) {
      const r = gameState.dice_results;
      addLog(
        `Player ${gameState.turn + 1} rolled ${r?.length === 1 ? gameState.dice_value : r?.join(", ") + ` (总计: ${gameState.dice_value})`}`,
      );
    }

    if (
      gameState.phase === "event" &&
      gameState.active_event &&
      currentPlayerIndex !== gameState.turn
    ) {
      setActiveEvent({
        id: gameState.active_event.id,
        text: gameState.active_event.text,
        type: gameState.active_event.type,
        val: gameState.active_event.val,
        target: gameState.active_event.target || "SELF",
        color: gameState.active_event.color || "#8b5cf6",
      });
      setPhase("event");
    }

    if (
      gameState.phase === "playing" &&
      !gameState.active_event &&
      activeEvent
    ) {
      setActiveEvent(null);
      if (phase === "event") setPhase("playing");
    }

    if (gameState.phase === "win" && phase !== "win") {
      setPlayers((prev) => {
        const sorted = [...prev]
          .map((p, i) => ({ p, i }))
          .sort((a, b) => b.p.lap - a.p.lap);
        let rank = 1;
        const next = [...prev];
        sorted.forEach(({ p, i }) => {
          if (p.lap >= lapsToWin)
            next[i] = { ...p, finished: true, finishRank: rank++ };
        });
        const lastIdx = next.findIndex((p) => !p.finished);
        if (lastIdx !== -1)
          next[lastIdx] = { ...next[lastIdx], finishRank: next.length };
        return next;
      });
      setPhase("win");
    }

    // Pause / resume sync
    if (gameState.phase === "paused" && phase !== "paused" && phase !== "win") {
      setPhase("paused");
    }
    if (gameState.phase === "playing" && phase === "paused") {
      setPhase("playing");
    }
  }, [gameState, isMultiplayer, isMoving, isRolling]);

  // ── Sync roomPlayers → local players ─────────────────────
  useEffect(() => {
    if (!isMultiplayer || !roomPlayers?.length) return;
    if (phase !== "playing" && phase !== "event") return;
    setPlayers((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      roomPlayers.forEach((rp) => {
        const idx = rp.player_index;
        if (idx < 0 || idx >= next.length) return;
        if (isMoving && idx === turn) return;
        const ep = next[idx];
        if (!ep) return;
        next[idx] = {
          ...ep,
          pos: rp.position ?? ep.pos,
          lap: rp.lap ?? ep.lap,
          skipTurn: rp.skip_turn ?? ep.skipTurn,
          cards: rp.cards?.length > 0 ? rp.cards : ep.cards,
        };
      });
      return next;
    });
  }, [roomPlayers, isMultiplayer, phase]);
}
