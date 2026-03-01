import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Player } from "../types";

// 调用本地的 API Routes
async function callRoomService(action: string, data: any) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("User not authenticated");
  }

  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Room service error");
  }

  return response.json();
}

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
}

interface UseRoomReturn {
  // 房间信息
  room: RoomInfo | null;
  players: RoomPlayer[];
  isCreator: boolean;
  gameState: any | null; // 游戏状态（从 room_games 表）

  // 加载状态
  loading: boolean;
  error: string | null;

  // 操作方法
  createRoom: (
    config: {
      num_players: number;
      dice_count: number;
      laps_to_win: number;
      initial_cards: number;
      event_density: number;
    },
    playerName?: string,
  ) => Promise<string>; // 返回roomId
  joinRoom: (
    roomCode: string,
    playerName: string,
    avatar: string,
  ) => Promise<string>; // 返回roomId
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  rollDice: (diceCount: number) => Promise<any>;
  movePlayer: (position: number, lapCount: number) => Promise<any>;
  triggerEvent: (event: any) => Promise<any>;
  loadRoom: (roomId: string) => Promise<void>;
  subscribe: (roomId: string) => () => void; // 返回取消订阅函数
}

/**
 * 房间管理 Hook
 * 所有操作都通过服务端 API 进行，确保数据一致性
 */
export function useRoom(userId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [gameState, setGameState] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建房间（通过服务端 API）
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
      // 调用服务端 API，获取完整的房间和玩家数据
      const { room: newRoom, players: newPlayers } = await callRoomService(
        "createRoom",
        {
          config,
          playerName,
        },
      );

      setRoom(newRoom);
      setPlayers(newPlayers);

      return newRoom.id;
    } catch (err: any) {
      const msg = err.message || "Failed to create room";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 加入房间（通过服务端 API）
  const joinRoom = async (
    roomCode: string,
    playerName: string,
    avatar: string,
  ): Promise<string> => {
    if (!userId) throw new Error("User not logged in");

    setLoading(true);
    setError(null);

    try {
      // 调用服务端 API，获取完整的房间和玩家数据
      const { room: targetRoom, players: newPlayers } = await callRoomService(
        "joinRoom",
        {
          roomCode,
          playerName,
        },
      );

      setRoom(targetRoom);
      setPlayers(newPlayers);

      return targetRoom.id;
    } catch (err: any) {
      const msg = err.message || "Failed to join room";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 离开房间（通过服务端 API）
  const leaveRoom = async (): Promise<void> => {
    if (!userId || !room) return;

    try {
      // 调用服务端 API
      await callRoomService("leaveRoom", {
        roomId: room.id,
      });

      setRoom(null);
      setPlayers([]);
    } catch (err: any) {
      console.error("Failed to leave room:", err);
      setError(err.message);
    }
  };

  // 开始游戏（通过服务端 API）
  const startGame = async (): Promise<void> => {
    if (!room || !userId) return;

    try {
      const { room: updatedRoom, players: updatedPlayers } =
        await callRoomService("startGame", {
          roomId: room.id,
        });

      setRoom(updatedRoom);
      setPlayers(updatedPlayers);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // 掷骰子（通过服务端 API）
  const rollDice = async (diceCount: number): Promise<any> => {
    if (!room || !userId) {
      throw new Error("Not in a room");
    }

    try {
      const result = await callRoomService("rollDice", {
        roomId: room.id,
        diceCount,
      });

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // 移动玩家（通过服务端 API）
  const movePlayer = async (
    position: number,
    lapCount: number,
  ): Promise<any> => {
    if (!room || !userId) {
      throw new Error("Not in a room");
    }

    try {
      const result = await callRoomService("movePlayer", {
        roomId: room.id,
        position,
        lapCount,
      });

      // 更新本地玩家列表
      if (result.players) {
        setPlayers(result.players);
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // 触发事件（通过服务端 API）
  const triggerEvent = async (event: any): Promise<any> => {
    if (!room || !userId) {
      throw new Error("Not in a room");
    }

    try {
      const result = await callRoomService("triggerEvent", {
        roomId: room.id,
        event,
      });

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // 加载房间数据（通过服务端 API）
  const loadRoom = useCallback(async (roomId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // 调用服务端 API，获取完整的房间和玩家数据
      const { room: roomData, players: playersData } = await callRoomService(
        "getRoomInfo",
        {
          roomId,
        },
      );

      setRoom(roomData);
      setPlayers(playersData);
    } catch (err: any) {
      const msg = err.message || "Failed to load room";
      setError(msg);
      console.error("Room load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 订阅房间实时更新
  const subscribe = useCallback((roomId: string): (() => void) => {
    const unsubscribers: Array<() => void> = [];

    // 订阅房间状态变化（rooms 表）
    const roomChannel = supabase
      .channel(`rooms:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload: any) => {
          console.log("📍 Realtime: rooms 表更新", payload.new);
          if (payload.new) {
            setRoom(payload.new);
          }
        },
      )
      .subscribe();

    unsubscribers.push(() => {
      roomChannel.unsubscribe();
    });

    // 订阅房间玩家变化
    const playersChannel = supabase
      .channel(`room_players:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            // 新增或更新玩家
            setPlayers((prev) => {
              const existing = prev.findIndex((p) => p.id === payload.new.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = payload.new;
                return updated;
              }
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "DELETE") {
            // 删除玩家（玩家退出房间）
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    unsubscribers.push(() => {
      playersChannel.unsubscribe();
    });

    // 订阅房间游戏状态变化
    const gameStateChannel = supabase
      .channel(`room_games:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            // 更新游戏状态
            setGameState(payload.new);
          }
        },
      )
      .subscribe();

    unsubscribers.push(() => {
      gameStateChannel.unsubscribe();
    });

    // 返回取消所有订阅的函数
    return () => {
      unsubscribers.forEach((unsub) => unsub());
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
    loadRoom,
    subscribe,
  };
}
