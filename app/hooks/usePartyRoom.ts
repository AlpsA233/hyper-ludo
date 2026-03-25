"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as Ably from "ably";
import type { BoardTile, GameEvent, Card } from "../types";

// Ably 消息类型
type ServerMessage =
  | { type: "player_joined"; payload: { players: PartyPlayer[] } }
  | { type: "player_left"; payload: { playerIndex: number; players: PartyPlayer[] } }
  | { type: "game_start"; payload: PartyRoomState }
  | { type: "dice_rolled"; payload: { playerIndex: number; diceValue: number; diceResults: number[]; currentTurn: number; phase: string } }
  | { type: "player_moved"; payload: { playerIndex: number; position: number; lap: number; players: PartyPlayer[]; phase: string } }
  | { type: "event_triggered"; payload: { playerIndex: number; event: GameEvent; players: PartyPlayer[]; phase: string } }
  | { type: "event_applied"; payload: { players: PartyPlayer[]; currentTurn: number; phase: string } }
  | { type: "card_used"; payload: { playerIndex: number; card: Card; players: PartyPlayer[]; phase: string } }
  | { type: "turn_ended"; payload: { currentTurn: number; phase: string } }
  | { type: "game_win"; payload: { winnerIndex: number } }
  | { type: "state_sync"; payload: { roomState: PartyRoomState; connectionCount: number } }
  | { type: "error"; payload: { message: string } }
  | { type: "log"; payload: { message: string } };

// 玩家状态
interface PartyPlayer {
  id: string;
  playerIndex: number;
  playerName: string;
  avatar: string;
  colorIndex: number;
  position: number;
  lap: number;
  skipTurn?: boolean;
  cards?: Card[];
  connected: boolean;
}

// 房间状态
interface PartyRoomState {
  id: string;
  boardTiles: BoardTile[];
  players: PartyPlayer[];
  currentTurn: number;
  phase: "waiting" | "playing" | "moving" | "event" | "win";
  diceValue: number | null;
  diceResults: number[];
  diceRollerIndex: number | null;
  activeEvent: GameEvent | null;
  activeCard: Card | null;
  lapsToWin: number;
  totalSteps: number;
  numPlayers: number;
  eventDensity: number;
  winner: number | null;
  logs: string[];
}

export interface UsePartyRoomReturn {
  // 连接状态
  isConnected: boolean;
  connectionCount: number;

  // 游戏状态
  roomState: PartyRoomState | null;
  players: PartyPlayer[];
  currentTurn: number;
  phase: string;
  boardTiles: BoardTile[];
  diceValue: number | null;
  diceResults: number[];
  activeEvent: GameEvent | null;
  winner: number | null;

  // 操作方法
  join: (userId: string, playerName: string, playerIndex: number, colorIndex: number, avatar: string) => void;
  startGame: (lapsToWin: number, eventDensity: number) => void;
  rollDice: (playerIndex: number, diceCount: number) => void;
  moveDone: (playerIndex: number, position: number, lap: number) => void;
  confirmEvent: (playerIndex: number) => void;
  useCard: (playerIndex: number, card: Card, targetIndex?: number) => void;

  // 错误
  error: string | null;

  // 断开连接
  disconnect: () => void;
}

// 获取 Ably API Key
function getAblyApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return process.env.NEXT_PUBLIC_ABLY_API_KEY || null;
}

// Ably client singleton
let ablyClient: Ably.Realtime | null = null;
let ablyChannel: Ably.RealtimeChannel | null = null;

export function usePartyRoom(roomId: string | null): UsePartyRoomReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [roomState, setRoomState] = useState<PartyRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // 派生状态
  const players = roomState?.players || [];
  const currentTurn = roomState?.currentTurn ?? 0;
  const phase = roomState?.phase ?? "waiting";
  const boardTiles = roomState?.boardTiles || [];
  const diceValue = roomState?.diceValue ?? null;
  const diceResults = roomState?.diceResults || [];
  const activeEvent = roomState?.activeEvent ?? null;
  const winner = roomState?.winner ?? null;

  // 处理 Ably 消息
  const handleAblyMessage = useCallback((msg: import("ably").Message) => {
    const data = msg.data as ServerMessage;
    if (!data?.type) return;

    console.log("[Ably] Received:", data.type, data.payload);

    switch (data.type) {
      case "player_joined":
      case "player_left":
        setRoomState(prev => prev ? { ...prev, players: (data.payload as any).players } : prev);
        break;

      case "game_start":
        setRoomState({ ...(data.payload as PartyRoomState), phase: "playing" });
        break;

      case "dice_rolled": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          diceValue: p.diceValue,
          diceResults: p.diceResults,
          diceRollerIndex: p.playerIndex,
          currentTurn: p.currentTurn,
          phase: p.phase as any,
        } : null);
        break;
      }

      case "player_moved": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          players: p.players,
          phase: p.phase as any,
        } : null);
        break;
      }

      case "event_triggered": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          activeEvent: p.event,
          players: p.players,
          phase: p.phase as any,
        } : null);
        break;
      }

      case "event_applied": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          activeEvent: null,
          players: p.players,
          currentTurn: p.currentTurn,
          phase: p.phase as any,
          diceValue: null,
          diceResults: [],
        } : null);
        break;
      }

      case "card_used": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          activeCard: p.card,
          players: p.players,
          phase: p.phase as any,
        } : null);
        break;
      }

      case "turn_ended": {
        const p = data.payload as any;
        setRoomState(prev => prev ? {
          ...prev,
          currentTurn: p.currentTurn,
          phase: p.phase as any,
          diceValue: null,
          diceResults: [],
        } : null);
        break;
      }

      case "game_win":
        setRoomState(prev => prev ? {
          ...prev,
          winner: (data.payload as any).winnerIndex,
          phase: "win",
        } : null);
        break;

      case "state_sync": {
        const p = data.payload as any;
        setRoomState(p.roomState as PartyRoomState);
        setConnectionCount(p.connectionCount ?? 0);
        break;
      }

      case "error":
        setError((data.payload as any).message);
        break;

      case "log":
        console.log("[Ably] Log:", (data.payload as any).message);
        break;
    }
  }, []);

  // 订阅 Ably 频道
  const subscribe = useCallback(async (rid: string) => {
    const apiKey = getAblyApiKey();
    if (!apiKey) {
      console.warn("[Ably] API key not available, skipping subscription");
      return;
    }

    // 清理旧连接
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
    }
    if (ablyClientRef.current) {
      try { ablyClientRef.current.close(); } catch {}
      ablyClientRef.current = null;
    }

    const client = new Ably.Realtime({ key: apiKey });
    ablyClientRef.current = client;

    const channelName = `game:${rid}`;
    const ch = client.channels.get(channelName);
    channelRef.current = ch;

    client.connection.on("connected", () => {
      console.log("[Ably] Connected to channel:", channelName);
      setIsConnected(true);
      setError(null);

      // 请求同步状态
      fetch("/api/ably", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_state", roomId: rid, userId: userIdRef.current }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.roomState) {
            setRoomState(data.roomState);
            setConnectionCount(data.connectionCount ?? 0);
          }
        }
      }).catch(console.error);
    });

    client.connection.on("disconnected", () => {
      console.log("[Ably] Disconnected");
      setIsConnected(false);
    });

    client.connection.on("suspended", () => {
      console.warn("[Ably] Connection suspended");
      setIsConnected(false);
    });

    // 订阅所有事件
    ch.subscribe("*", handleAblyMessage);
  }, [handleAblyMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
    }
    if (ablyClientRef.current) {
      try { ablyClientRef.current.close(); } catch {}
      ablyClientRef.current = null;
    }
    setIsConnected(false);
    setRoomState(null);
    setConnectionCount(0);
  }, []);

  // 当 roomId 变化时，自动连接
  useEffect(() => {
    if (!roomId) {
      disconnect();
      return;
    }

    isManualDisconnect.current = false;
    subscribe(roomId);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [roomId, subscribe, disconnect]);

  // 调用 Ably action API
  const callAction = useCallback(async (action: string, extraPayload: Record<string, any> = {}) => {
    if (!roomId || !userIdRef.current) {
      setError("Not connected to room");
      return;
    }

    try {
      const res = await fetch("/api/ably", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          roomId,
          userId: userIdRef.current,
          payload: extraPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Action failed");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [roomId]);

  // 动作方法
  const join = useCallback((
    userId: string,
    playerName: string,
    playerIndex: number,
    colorIndex: number,
    avatar: string
  ) => {
    userIdRef.current = userId;
    callAction("join", { playerName, playerIndex, colorIndex, avatar });
  }, [callAction]);

  const startGame = useCallback((lapsToWin: number, eventDensity: number) => {
    callAction("start_game", { lapsToWin, eventDensity });
  }, [callAction]);

  const rollDice = useCallback((playerIndex: number, diceCount: number) => {
    callAction("roll_dice", { diceCount });
  }, [callAction]);

  const moveDone = useCallback((playerIndex: number, position: number, lap: number) => {
    callAction("move_done", { position, lap });
  }, [callAction]);

  const confirmEvent = useCallback((playerIndex: number) => {
    callAction("event_confirm", {});
  }, [callAction]);

  const useCard = useCallback((playerIndex: number, card: Card, targetIndex?: number) => {
    callAction("use_card", { card, targetIndex });
  }, [callAction]);

  return {
    isConnected,
    connectionCount,
    roomState,
    players,
    currentTurn,
    phase,
    boardTiles,
    diceValue,
    diceResults,
    activeEvent,
    winner,
    join,
    startGame,
    rollDice,
    moveDone,
    confirmEvent,
    useCard,
    error,
    disconnect,
  };
}
