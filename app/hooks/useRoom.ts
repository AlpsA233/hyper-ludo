import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Player } from "../types";

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

  // 加载状态
  loading: boolean;
  error: string | null;

  // 操作方法
  createRoom: (config: {
    num_players: number;
    dice_count: number;
    laps_to_win: number;
    initial_cards: number;
    event_density: number;
  }) => Promise<string>; // 返回roomId
  joinRoom: (
    roomCode: string,
    playerName: string,
    avatar: string,
  ) => Promise<void>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  updatePlayerPosition: (
    playerIndex: number,
    position: number,
    lap: number,
  ) => Promise<void>;
  endGame: () => Promise<void>;
  loadRoom: (roomId: string) => Promise<void>;

  // 实时订阅
  subscribe: (roomId: string) => () => void; // 返回取消订阅函数
}

/**
 * 房间管理 Hook
 * 处理房间创建、加入、玩家同步等
 */
export function useRoom(userId: string | null): UseRoomReturn {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成房间码（6位数字）
  const generateRoomCode = (): string => {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  };

  // 创建房间
  const createRoom = async (config: {
    num_players: number;
    dice_count: number;
    laps_to_win: number;
    initial_cards: number;
    event_density: number;
  }): Promise<string> => {
    if (!userId) throw new Error("User not logged in");

    setLoading(true);
    setError(null);

    try {
      // 生成唯一房间码
      let roomCode = generateRoomCode();
      let codeExists = true;
      while (codeExists) {
        const { data: existing } = await supabase
          .from("rooms")
          .select("id")
          .eq("room_code", roomCode)
          .maybeSingle();
        if (!existing) codeExists = false;
        else roomCode = generateRoomCode();
      }

      // 创建房间
      const { data: newRoom, error: insertError } = await supabase
        .from("rooms")
        .insert({
          room_code: roomCode,
          creator_id: userId,
          state: "waiting",
          current_players: 1,
          ...config,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 创建者加入房间
      const { error: playerError } = await supabase
        .from("room_players")
        .insert({
          room_id: newRoom.id,
          user_id: userId,
          player_index: 0,
          player_name: "Host",
          avatar: "👤",
          color_index: 0,
        });

      if (playerError) throw playerError;

      // 设置房间信息和玩家列表
      setRoom(newRoom);
      setPlayers([
        {
          id: "", // 暂时空，实际会在订阅时更新
          room_id: newRoom.id,
          user_id: userId,
          player_index: 0,
          player_name: "Host",
          avatar: "👤",
          color_index: 0,
          position: -1,
          lap: 0,
        },
      ]);
      return newRoom.id;
    } catch (err: any) {
      const msg = err.message || "Failed to create room";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 加入房间
  const joinRoom = async (
    roomCode: string,
    playerName: string,
    avatar: string,
  ): Promise<void> => {
    if (!userId) throw new Error("User not logged in");

    setLoading(true);
    setError(null);

    try {
      // 查找房间
      const { data: targetRoom, error: findError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (findError || !targetRoom) throw new Error("Room not found");
      if (targetRoom.state !== "waiting")
        throw new Error("Game already started");
      if (targetRoom.current_players >= targetRoom.max_players)
        throw new Error("Room is full");

      // 检查玩家是否已在房间中
      const { data: existing } = await supabase
        .from("room_players")
        .select("id")
        .eq("room_id", targetRoom.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) throw new Error("Already in this room");

      // 获取当前玩家数量以分配index
      const { data: existingPlayers } = await supabase
        .from("room_players")
        .select("player_index")
        .eq("room_id", targetRoom.id);

      const playerIndex = existingPlayers?.length || 0;

      // 加入房间
      const { error: joinError } = await supabase.from("room_players").insert({
        room_id: targetRoom.id,
        user_id: userId,
        player_index: playerIndex,
        player_name: playerName,
        avatar: avatar,
        color_index: playerIndex,
      });

      if (joinError) throw joinError;

      // 更新房间玩家数量
      await supabase
        .from("rooms")
        .update({ current_players: playerIndex + 1 })
        .eq("id", targetRoom.id);

      setRoom(targetRoom);
    } catch (err: any) {
      const msg = err.message || "Failed to join room";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 离开房间
  const leaveRoom = async (): Promise<void> => {
    if (!userId || !room) return;

    try {
      // 删除玩家记录
      await supabase
        .from("room_players")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", userId);

      // 如果创建者离开，删除整个房间
      if (room.creator_id === userId) {
        await supabase.from("rooms").delete().eq("id", room.id);
      } else {
        // 更新房间玩家数量
        const { data: remaining } = await supabase
          .from("room_players")
          .select("id", { count: "exact" })
          .eq("room_id", room.id);

        await supabase
          .from("rooms")
          .update({ current_players: remaining?.length || 0 })
          .eq("id", room.id);
      }

      setRoom(null);
      setPlayers([]);
    } catch (err: any) {
      console.error("Failed to leave room:", err);
      setError(err.message);
    }
  };

  // 开始游戏
  const startGame = async (): Promise<void> => {
    if (!room || !userId) return;

    try {
      // 只有创建者能开始游戏
      if (room.creator_id !== userId)
        throw new Error("Only room creator can start");

      // 更新房间状态
      await supabase
        .from("rooms")
        .update({ state: "playing" })
        .eq("id", room.id);

      // 创建游戏状态记录
      await supabase.from("room_games").insert({
        room_id: room.id,
        turn: 0,
        phase: "playing",
        dice_value: 0,
        dice_results: [],
      });

      setRoom({ ...room, state: "playing" });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 更新玩家位置
  const updatePlayerPosition = async (
    playerIndex: number,
    position: number,
    lap: number,
  ): Promise<void> => {
    if (!room) return;

    try {
      const player = players.find((p) => p.player_index === playerIndex);
      if (player) {
        await supabase
          .from("room_players")
          .update({ position, lap })
          .eq("id", player.id);
      }
    } catch (err: any) {
      console.error("Failed to update player position:", err);
    }
  };

  // 结束游戏
  const endGame = async (): Promise<void> => {
    if (!room || !userId) return;

    try {
      if (room.creator_id !== userId)
        throw new Error("Only room creator can end game");

      await supabase
        .from("rooms")
        .update({ state: "finished" })
        .eq("id", room.id);

      setRoom({ ...room, state: "finished" });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 加载指定房间的数据
  const loadRoom = useCallback(async (roomId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // 加载房间信息
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (roomError || !roomData) throw new Error("Room not found");

      setRoom(roomData);

      // 加载房间玩家列表
      const { data: playersData, error: playersError } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomId);

      if (playersError) {
        console.error("Failed to load players:", playersError);
      } else {
        setPlayers(playersData || []);
      }
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
    const channel = supabase
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
          if (payload.new) {
            setPlayers((prev) => {
              const existing = prev.findIndex((p) => p.id === payload.new.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = payload.new;
                return updated;
              }
              return [...prev, payload.new];
            });
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const isCreator = room ? room.creator_id === userId : false;

  return {
    room,
    players,
    isCreator,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    updatePlayerPosition,
    endGame,
    loadRoom,
    subscribe,
  };
}
