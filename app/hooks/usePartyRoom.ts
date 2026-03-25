"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { BoardTile, GameEvent, Card } from "../types";

// PartyKit 消息类型
type ServerMessage =
  | { type: "player_joined"; payload: { players: PartyPlayer[] } }
  | { type: "player_left"; payload: { playerIndex: number; players: PartyPlayer[] } }
  | { type: "game_start"; payload: { boardTiles: BoardTile[]; players: PartyPlayer[]; currentTurn: number; numPlayers: number; lapsToWin: number } }
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

// PartyKit 玩家状态
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

// PartyKit 房间状态
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

// 客户端消息
type ClientMessage =
  | { type: "join"; payload: { userId: string; playerName: string; playerIndex: number; colorIndex: number; avatar: string } }
  | { type: "start_game"; payload: { lapsToWin: number; eventDensity: number } }
  | { type: "roll_dice"; payload: { playerIndex: number; diceCount: number } }
  | { type: "move_done"; payload: { playerIndex: number; position: number; lap: number } }
  | { type: "event_confirm"; payload: { playerIndex: number } }
  | { type: "use_card"; payload: { playerIndex: number; card: Card; targetIndex?: number } }
  | { type: "sync_state"; payload: { roomId: string } };

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

// 获取 PartyKit host
function getPartyKitHost(): string {
  if (typeof window === "undefined") return "localhost:1999";
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";
}

export function usePartyRoom(roomId: string | null): UsePartyRoomReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [roomState, setRoomState] = useState<PartyRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);

  // 派生状态
  const players = roomState?.players || [];
  const currentTurn = roomState?.currentTurn ?? 0;
  const phase = roomState?.phase ?? "waiting";
  const boardTiles = roomState?.boardTiles || [];
  const diceValue = roomState?.diceValue ?? null;
  const diceResults = roomState?.diceResults || [];
  const activeEvent = roomState?.activeEvent ?? null;
  const winner = roomState?.winner ?? null;

  // 发送消息
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[PartyRoom] Cannot send message, WebSocket not connected");
    }
  }, []);

  // 处理服务器消息
  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.error("[PartyRoom] Failed to parse message");
      return;
    }

    console.log("[PartyRoom] Received:", msg.type, msg.payload);

    switch (msg.type) {
      case "player_joined":
      case "player_left":
        setRoomState(prev => prev ? { ...prev, players: msg.payload.players } : prev);
        break;

      case "game_start":
        setRoomState(prev => prev ? {
          ...prev,
          boardTiles: msg.payload.boardTiles,
          players: msg.payload.players,
          currentTurn: msg.payload.currentTurn,
          phase: "playing",
        } : null);
        break;

      case "dice_rolled":
        setRoomState(prev => prev ? {
          ...prev,
          diceValue: msg.payload.diceValue,
          diceResults: msg.payload.diceResults,
          diceRollerIndex: msg.payload.playerIndex,
          currentTurn: msg.payload.currentTurn,
          phase: msg.payload.phase as any,
        } : null);
        break;

      case "player_moved":
        setRoomState(prev => prev ? {
          ...prev,
          players: msg.payload.players,
          phase: msg.payload.phase as any,
        } : null);
        break;

      case "event_triggered":
        setRoomState(prev => prev ? {
          ...prev,
          activeEvent: msg.payload.event,
          players: msg.payload.players,
          phase: msg.payload.phase as any,
        } : null);
        break;

      case "event_applied":
        setRoomState(prev => prev ? {
          ...prev,
          activeEvent: null,
          players: msg.payload.players,
          currentTurn: msg.payload.currentTurn,
          phase: msg.payload.phase as any,
          diceValue: null,
          diceResults: [],
        } : null);
        break;

      case "card_used":
        setRoomState(prev => prev ? {
          ...prev,
          activeCard: msg.payload.card,
          players: msg.payload.players,
          phase: msg.payload.phase as any,
        } : null);
        break;

      case "turn_ended":
        setRoomState(prev => prev ? {
          ...prev,
          currentTurn: msg.payload.currentTurn,
          phase: msg.payload.phase as any,
          diceValue: null,
          diceResults: [],
        } : null);
        break;

      case "game_win":
        setRoomState(prev => prev ? {
          ...prev,
          winner: msg.payload.winnerIndex,
          phase: "win",
        } : null);
        break;

      case "state_sync":
        setRoomState(msg.payload.roomState as PartyRoomState);
        setConnectionCount(msg.payload.connectionCount);
        break;

      case "error":
        console.error("[PartyRoom] Server error:", msg.payload.message);
        setError(msg.payload.message);
        break;

      case "log":
        console.log("[PartyRoom] Log:", msg.payload.message);
        break;
    }
  }, []);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!roomId) return;
    
    isManualDisconnect.current = false;
    const host = getPartyKitHost();
    const wsUrl = `ws://${host}/parties/main/${roomId}`;
    
    console.log("[PartyRoom] Connecting to:", wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("[PartyRoom] Connected");
        setIsConnected(true);
        setError(null);
        
        // 请求同步状态
        send({ type: "sync_state", payload: { roomId } });
      };
      
      ws.onmessage = handleMessage;
      
      ws.onclose = () => {
        console.log("[PartyRoom] Disconnected");
        setIsConnected(false);
        wsRef.current = null;
        
        // 自动重连（如果不是手动断开）
        if (!isManualDisconnect.current && roomId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[PartyRoom] Reconnecting...");
            connect();
          }, 2000);
        }
      };
      
      ws.onerror = (err) => {
        console.error("[PartyRoom] WebSocket error:", err);
        setError("Connection error");
      };
    } catch (err) {
      console.error("[PartyRoom] Failed to connect:", err);
      setError("Failed to connect");
    }
  }, [roomId, send, handleMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setRoomState(null);
  }, []);

  // 当 roomId 变化时，自动连接
  useEffect(() => {
    if (roomId) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [roomId, connect, disconnect]);

  // 动作方法
  const join = useCallback((
    userId: string,
    playerName: string,
    playerIndex: number,
    colorIndex: number,
    avatar: string
  ) => {
    send({
      type: "join",
      payload: { userId, playerName, playerIndex, colorIndex, avatar },
    });
  }, [send]);

  const startGame = useCallback((lapsToWin: number, eventDensity: number) => {
    send({ type: "start_game", payload: { lapsToWin, eventDensity } });
  }, [send]);

  const rollDice = useCallback((playerIndex: number, diceCount: number) => {
    send({ type: "roll_dice", payload: { playerIndex, diceCount } });
  }, [send]);

  const moveDone = useCallback((playerIndex: number, position: number, lap: number) => {
    send({ type: "move_done", payload: { playerIndex, position, lap } });
  }, [send]);

  const confirmEvent = useCallback((playerIndex: number) => {
    send({ type: "event_confirm", payload: { playerIndex } });
  }, [send]);

  const useCard = useCallback((playerIndex: number, card: Card, targetIndex?: number) => {
    send({ type: "use_card", payload: { playerIndex, card, targetIndex } });
  }, [send]);

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
