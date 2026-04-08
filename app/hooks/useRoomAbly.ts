/**
 * Ably-based room hook — drop-in replacement for useRoomWs.
 * Actions go via HTTP POST to /api/game.
 * Real-time state updates come via Ably channel subscription.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import Ably from "ably";

export interface RoomInfo {
  id: string;
  room_code: string;
  creator_id: string;
  state: "waiting" | "playing" | "finished";
  num_players: number;
  dice_count: number;
  laps_to_win: number;
  initial_cards: number;
  event_density: number;
  current_players: number;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string;
  player_index: number;
  player_name: string;
  avatar: string;
  color_index: number;
  position: number;
  lap: number;
  skip_turn?: boolean;
  cards?: any[];
  shield?: boolean;
}

interface UseRoomReturn {
  room: RoomInfo | null;
  players: RoomPlayer[];
  isCreator: boolean;
  gameState: any | null;
  loading: boolean;
  error: string | null;

  createRoom: (
    config: {
      num_players: number;
      dice_count: number;
      laps_to_win: number;
      initial_cards: number;
      event_density: number;
    },
    playerName?: string,
  ) => Promise<string>;
  joinRoom: (
    roomCode: string,
    playerName: string,
    avatar: string,
  ) => Promise<string>;
  leaveRoom: () => Promise<void>;
  startGame: (config?: {
    cardDatabase?: any[];
    eventDatabase?: any[];
  }) => Promise<void>;
  rollDice: (diceCount: number) => Promise<any>;
  movePlayer: (
    position: number,
    lapCount: number,
    targetPlayerIndex?: number,
  ) => Promise<any>;
  triggerEvent: (event: any) => Promise<any>;
  useCard: (cardEffect: { card: any; playerUpdates: any[] }) => Promise<any>;
  setWinner: (winnerIndex: number) => Promise<any>;
  endPlayerTurn: () => Promise<any>;
  updateRoomConfig: (config: {
    num_players: number;
    dice_count: number;
    laps_to_win: number;
    initial_cards: number;
    event_density: number;
  }) => Promise<any>;
  loadRoom: (roomId: string) => Promise<void>;
  subscribe: (roomId: string) => () => void;
}

// ── Ably singleton ─────────────────────────────────────────────────────────
let ablyInstance: Ably.Realtime | null = null;

function getAbly(clientId: string): Ably.Realtime {
  if (!ablyInstance) {
    ablyInstance = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${encodeURIComponent(clientId)}`,
      clientId,
      autoConnect: true,
    });
  }
  return ablyInstance;
}

// ── HTTP helper ────────────────────────────────────────────────────────────
async function gameAction(
  action: string,
  userId: string,
  roomId?: string | null,
  payload?: any,
): Promise<any> {
  const res = await fetch("/api/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId, roomId, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useRoom(userId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [gameState, setGameState] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const handlersRef = useRef<{
    onRoom: any;
    onPlayers: any;
    onGame: any;
  } | null>(null);

  const isCreator = !!(userId && room?.creator_id === userId);

  // Subscribe to Ably channel whenever room.id changes
  useEffect(() => {
    if (!userId || !room?.id) return;
    if (roomIdRef.current === room.id) return; // already subscribed

    // Unsubscribe from old channel (only OUR handlers)
    if (channelRef.current && handlersRef.current) {
      channelRef.current.unsubscribe("room_update", handlersRef.current.onRoom);
      channelRef.current.unsubscribe(
        "players_update",
        handlersRef.current.onPlayers,
      );
      channelRef.current.unsubscribe("game_update", handlersRef.current.onGame);
      channelRef.current = null;
      handlersRef.current = null;
    }

    const ably = getAbly(userId);
    const channel = ably.channels.get(`game:${room.id}`);
    channelRef.current = channel;
    roomIdRef.current = room.id;

    // Store specific handler references so we only remove OUR handlers
    // (channel.unsubscribe() with no args removes ALL handlers including other hook instances)
    const onRoom = (msg: any) => setRoom(msg.data);
    const onPlayers = (msg: any) => setPlayers(msg.data);
    const onGame = (msg: any) => setGameState(msg.data);
    handlersRef.current = { onRoom, onPlayers, onGame };

    channel.subscribe("room_update", onRoom);
    channel.subscribe("players_update", onPlayers);
    channel.subscribe("game_update", onGame);

    return () => {
      channel.unsubscribe("room_update", onRoom);
      channel.unsubscribe("players_update", onPlayers);
      channel.unsubscribe("game_update", onGame);
      channelRef.current = null;
      roomIdRef.current = null;
    };
  }, [userId, room?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const createRoom = async (
    config: {
      num_players: number;
      dice_count: number;
      laps_to_win: number;
      initial_cards: number;
      event_density: number;
    },
    playerName = "Host",
  ): Promise<string> => {
    if (!userId) throw new Error("No user ID");
    setLoading(true);
    setError(null);
    try {
      const result = await gameAction("createRoom", userId, null, {
        config,
        playerName,
      });
      setRoom(result.room);
      setPlayers(result.players);
      return result.room.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (
    roomCode: string,
    playerName: string,
    _avatar: string,
  ): Promise<string> => {
    if (!userId) throw new Error("No user ID");
    setLoading(true);
    setError(null);
    try {
      const result = await gameAction("joinRoom", userId, null, {
        roomCode,
        playerName,
      });
      setRoom(result.room);
      setPlayers(result.players);
      return result.room.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async (): Promise<void> => {
    if (!userId || !room) return;
    try {
      await gameAction("leaveRoom", userId, room.id);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        roomIdRef.current = null;
      }
      setRoom(null);
      setPlayers([]);
      setGameState(null);
    } catch (err: any) {
      console.error("Failed to leave room:", err);
      setError(err.message);
    }
  };

  const startGame = async (config?: {
    cardDatabase?: any[];
    eventDatabase?: any[];
  }): Promise<void> => {
    if (!room || !userId) return;
    try {
      const result = await gameAction(
        "startGame",
        userId,
        room.id,
        config || {},
      );
      setRoom(result.room);
      setPlayers(result.players);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const rollDice = async (diceCount: number): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await gameAction("rollDice", userId, room.id, { diceCount });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const movePlayer = async (
    position: number,
    lapCount: number,
    targetPlayerIndex?: number,
  ): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      const result = await gameAction("movePlayer", userId, room.id, {
        position,
        lapCount,
        targetPlayerIndex,
      });
      if (result.players) setPlayers(result.players);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const triggerEvent = async (event: any): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await gameAction("triggerEvent", userId, room.id, { event });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const useCardAction = async (cardEffect: {
    card: any;
    playerUpdates: any[];
  }): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await gameAction("useCard", userId, room.id, { cardEffect });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const setWinner = async (winnerIndex: number): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await gameAction("setWinner", userId, room.id, { winnerIndex });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const endPlayerTurn = async (): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await gameAction("endPlayerTurn", userId, room.id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateRoomConfig = async (config: {
    num_players: number;
    dice_count: number;
    laps_to_win: number;
    initial_cards: number;
    event_density: number;
  }): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      const result = await gameAction("updateRoomConfig", userId, room.id, {
        config,
      });
      setRoom(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const loadRoom = useCallback(
    async (rId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await gameAction("getRoomInfo", userId!, rId);
        setRoom(result.room);
        setPlayers(result.players);
        if (result.gameState) setGameState(result.gameState);
      } catch (err: any) {
        setError(err.message || "Failed to load room");
        console.error("Room load error:", err);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const subscribe = useCallback(
    (rId: string): (() => void) => {
      if (!userId) return () => {};
      const ably = getAbly(userId);
      const channel = ably.channels.get(`game:${rId}`);
      const onRoom = (msg: any) => setRoom(msg.data);
      const onPlayers = (msg: any) => setPlayers(msg.data);
      const onGame = (msg: any) => setGameState(msg.data);
      channel.subscribe("room_update", onRoom);
      channel.subscribe("players_update", onPlayers);
      channel.subscribe("game_update", onGame);
      return () => {
        channel.unsubscribe("room_update", onRoom);
        channel.unsubscribe("players_update", onPlayers);
        channel.unsubscribe("game_update", onGame);
      };
    },
    [userId],
  );

  return {
    room,
    players,
    isCreator,
    gameState,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    rollDice,
    movePlayer,
    triggerEvent,
    useCard: useCardAction,
    setWinner,
    endPlayerTurn,
    updateRoomConfig,
    loadRoom,
    subscribe,
  };
}
