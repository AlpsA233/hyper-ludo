/**
 * WebSocket-based room hook.
 * Drop-in replacement for useRoom — same interface, no Supabase dependency.
 * All communication goes through the standalone WS server (server/ws-server.mjs).
 */

import { useEffect, useState, useCallback } from "react";
import { wsClient } from "../lib/wsClient";

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
  startGame: () => Promise<void>;
  rollDice: (diceCount: number) => Promise<any>;
  movePlayer: (position: number, lapCount: number, targetPlayerIndex?: number) => Promise<any>;
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

export function useRoom(userId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [gameState, setGameState] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect and listen for broadcasts
  useEffect(() => {
    if (!userId) return;

    wsClient.connect(userId);

    const onRoomUpdate = (data: any) => setRoom(data);
    const onPlayersUpdate = (data: any) => setPlayers(data);
    const onGameUpdate = (data: any) => setGameState(data);

    wsClient.on("room_update", onRoomUpdate);
    wsClient.on("players_update", onPlayersUpdate);
    wsClient.on("game_update", onGameUpdate);

    return () => {
      wsClient.off("room_update", onRoomUpdate);
      wsClient.off("players_update", onPlayersUpdate);
      wsClient.off("game_update", onGameUpdate);
    };
  }, [userId]);

  const createRoom = async (
    config: {
      num_players: number;
      dice_count: number;
      laps_to_win: number;
      initial_cards: number;
      event_density: number;
    },
    playerName: string = "Host",
  ): Promise<string> => {
    if (!userId) throw new Error("User not logged in");
    setLoading(true);
    setError(null);
    try {
      const result = await wsClient.send("createRoom", { config, playerName });
      setRoom(result.room);
      setPlayers(result.players);
      return result.room.id;
    } catch (err: any) {
      const msg = err.message || "Failed to create room";
      setError(msg);
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
    if (!userId) throw new Error("User not logged in");
    setLoading(true);
    setError(null);
    try {
      const result = await wsClient.send("joinRoom", {
        roomCode,
        playerName,
      });
      setRoom(result.room);
      setPlayers(result.players);
      return result.room.id;
    } catch (err: any) {
      const msg = err.message || "Failed to join room";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async (): Promise<void> => {
    if (!userId || !room) return;
    try {
      await wsClient.send("leaveRoom", { roomId: room.id });
      setRoom(null);
      setPlayers([]);
      setGameState(null);
    } catch (err: any) {
      console.error("Failed to leave room:", err);
      setError(err.message);
    }
  };

  const startGame = async (): Promise<void> => {
    if (!room || !userId) return;
    try {
      const result = await wsClient.send("startGame", { roomId: room.id });
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
      return await wsClient.send("rollDice", {
        roomId: room.id,
        diceCount,
      });
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
      const payload: any = { roomId: room.id, position, lapCount };
      if (targetPlayerIndex !== undefined) payload.targetPlayerIndex = targetPlayerIndex;
      const result = await wsClient.send("movePlayer", payload);
      if (result.players) setPlayers(result.players);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const useCard = async (cardEffect: { card: any; playerUpdates: any[] }): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await wsClient.send("useCard", { roomId: room.id, cardEffect });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const setWinnerWs = async (winnerIndex: number): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await wsClient.send("setWinner", { roomId: room.id, winnerIndex });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const triggerEvent = async (event: any): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await wsClient.send("triggerEvent", {
        roomId: room.id,
        event,
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const endPlayerTurn = async (): Promise<any> => {
    if (!room || !userId) throw new Error("Not in a room");
    try {
      return await wsClient.send("endPlayerTurn", { roomId: room.id });
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
      const result = await wsClient.send("updateRoomConfig", {
        roomId: room.id,
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
    async (roomId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await wsClient.send("getRoomInfo", { roomId });
        setRoom(result.room);
        setPlayers(result.players);
      } catch (err: any) {
        const msg = err.message || "Failed to load room";
        setError(msg);
        console.error("Room load error:", err);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // Subscribe to room updates via WebSocket
  const subscribe = useCallback((roomId: string): (() => void) => {
    // Tell the server we want updates for this room
    wsClient.send("subscribe", { roomId }).catch(() => {});

    return () => {
      // Unsubscribe is handled by disconnect / leave
    };
  }, []);

  const isCreator = room ? room.creator_id === userId : false;

  return {
    room,
    players,
    gameState,
    isCreator,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    rollDice,
    movePlayer,
    triggerEvent,
    useCard,
    setWinner: setWinnerWs,
    endPlayerTurn,
    updateRoomConfig,
    loadRoom,
    subscribe,
  };
}
