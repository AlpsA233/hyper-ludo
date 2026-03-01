"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Copy, Check, X, LogOut, Settings } from "lucide-react";
import type { Translations } from "@/app/locales";
import { useRoom, type RoomInfo, type RoomPlayer } from "@/app/hooks/useRoom";

interface RoomLobbyProps {
  roomId: string;
  userId: string | null;
  onStartGame?: () => void;
  onLeaveRoom?: () => void;
  onCancel?: () => void;
  t: Translations;
}

export default function RoomLobby({
  roomId,
  userId,
  onStartGame,
  onLeaveRoom,
  onCancel,
  t,
}: RoomLobbyProps) {
  const {
    room,
    players,
    isCreator,
    startGame,
    leaveRoom,
    subscribe,
    error,
    loadRoom,
    updateRoomConfig,
  } = useRoom(userId);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [editingConfig, setEditingConfig] = useState({
    num_players: 4,
    dice_count: 1,
    laps_to_win: 3,
    initial_cards: 5,
    event_density: 40,
  });

  // 使用 ref 存储最新的回调，避免闭包问题
  const onStartGameRef = useRef(onStartGame);
  useEffect(() => {
    onStartGameRef.current = onStartGame;
  }, [onStartGame]);

  // 当房间配置改变时，更新编辑配置状态
  useEffect(() => {
    if (room) {
      setEditingConfig({
        num_players: room.num_players,
        dice_count: room.dice_count,
        laps_to_win: room.laps_to_win,
        initial_cards: room.initial_cards,
        event_density: room.event_density,
      });
    }
  }, [room?.id]); // 仅在房间ID改变时更新

  // 加载房间数据和订阅实时更新
  useEffect(() => {
    console.log("📍 RoomLobby: 加载房间数据", roomId);
    loadRoom(roomId);
    const unsubscribe = subscribe(roomId);

    // 备用轮询机制：每2秒重新加载一次，确保看到新加入的玩家
    // 这是为了解决 Realtime 在某些情况下可能延迟的问题
    const pollInterval = setInterval(() => {
      console.log("🔄 RoomLobby: 定期查询最新房间数据（轮询）");
      loadRoom(roomId);
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [roomId, loadRoom]);

  // 监听房间对象变化
  useEffect(() => {
    console.log("📍 RoomLobby: room 对象更新", {
      roomId: room?.id,
      state: room?.state,
      room: room,
    });
  }, [room]);

  // 监听玩家列表变化
  useEffect(() => {
    console.log("👥 RoomLobby: 玩家列表更新", {
      count: players.length,
      players: players.map((p) => ({
        id: p.id,
        name: p.player_name,
        index: p.player_index,
      })),
    });
  }, [players]);

  // 监听房间状态变化：当游戏开始时自动跳转
  useEffect(() => {
    console.log("📍 RoomLobby: 检查房间状态", {
      roomExists: !!room,
      state: room?.state,
      shouldStart: room && room.state === "playing",
    });
    if (room && room.state === "playing") {
      console.log("🎮 Room state changed to PLAYING, triggering onStartGame");
      onStartGameRef.current?.();
    }
  }, [room?.state]);

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      await updateRoomConfig(editingConfig);
      setShowConfigEditor(false);
      // 调用loadRoom以确保UI更新
      await loadRoom(roomId);
    } catch (err: any) {
      console.error("Failed to save config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await startGame();
      onStartGame?.();
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    onLeaveRoom?.();
  };

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!room) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110]">
        <div className="text-white text-center">
          <div className="animate-spin mb-4">⏳</div>
          <p>{t.common?.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
          <h2 className="text-2xl font-black italic bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            {t.room?.lobby || "Game Lobby"}
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* 房间信息 */}
        <div className="p-6 space-y-6">
          {/* 房间码 */}
          <div className="p-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-lg">
            <p className="text-xs font-bold text-gray-400 mb-2">
              {t.room?.roomCode || "Room Code"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono text-2xl font-black tracking-widest text-purple-300">
                {room.room_code}
              </div>
              <button
                onClick={copyRoomCode}
                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {t.room?.shareInfo || "Share this code with friends"}
            </p>
          </div>

          {/* 玩家列表 */}
          <div>
            <p className="text-xs font-bold text-gray-400 mb-3">
              {t.room?.players || "Players"} ({players.length}/
              {room.num_players || 4})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: room.num_players || 4 }).map((_, i) => {
                const player = players.find((p) => p.player_index === i);
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                      player
                        ? "bg-white/10 border-cyan-500/50"
                        : "bg-white/5 border-white/10 opacity-50"
                    }`}>
                    <div className="text-2xl">{player?.avatar || "❌"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">
                        {player?.player_name || `${t.common?.empty || "Empty"}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {player
                          ? `Player ${i + 1}`
                          : t.room?.waitingForPlayer || "Waiting..."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 游戏配置 */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400">
                {t.room?.config || "Game Config"}
              </p>
              {isCreator && (
                <button
                  onClick={() => setShowConfigEditor(true)}
                  disabled={loading}
                  className="p-1.5 px-2 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors">
                  <Settings size={14} />
                  Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">
                  {t.setup?.numPlayers || "Players"}:
                </span>
                <span className="text-white ml-2 font-bold">
                  {room.num_players}
                </span>
              </div>
              <div>
                <span className="text-gray-400">
                  {t.setup?.diceCount || "Dice"}:
                </span>
                <span className="text-white ml-2 font-bold">
                  {room.dice_count}
                </span>
              </div>
              <div>
                <span className="text-gray-400">
                  {t.setup?.lapsToWin || "Laps"}:
                </span>
                <span className="text-white ml-2 font-bold">
                  {room.laps_to_win}
                </span>
              </div>
              <div>
                <span className="text-gray-400">
                  🎴 {t.room?.config || "Cards"}:
                </span>
                <span className="text-white ml-2 font-bold">
                  {room.initial_cards}
                </span>
              </div>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            {isCreator ? (
              <>
                <button
                  onClick={handleStartGame}
                  disabled={loading || players.length < room.num_players}
                  title={
                    players.length < room.num_players
                      ? `需要 ${room.num_players} 个玩家，当前 ${players.length} 个`
                      : ""
                  }
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all">
                  <Play size={18} />
                  {loading
                    ? t.common?.starting || "Starting..."
                    : `${t.common?.startGame || "Start Game"} (${players.length}/${room.num_players})`}
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors">
                {t.common?.leaveGame || "Leave Game"}
              </button>
            )}
          </div>
        </div>

        {/* 编辑配置 Dialog */}
        {showConfigEditor && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-20">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Edit Config</h3>
                <button
                  onClick={() => setShowConfigEditor(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 玩家数 */}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
                    {t.setup?.numPlayers || "Players"}
                  </label>
                  <input
                    type="number"
                    value={editingConfig.num_players}
                    min="2"
                    max="8"
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        num_players: +e.target.value,
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  />
                </div>

                {/* 骰子数 */}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
                    {t.setup?.diceCount || "Dice"}
                  </label>
                  <input
                    type="number"
                    value={editingConfig.dice_count}
                    min="1"
                    max="3"
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        dice_count: +e.target.value,
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                </div>

                {/* 圈数 */}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
                    {t.setup?.lapsToWin || "Laps"}
                  </label>
                  <input
                    type="number"
                    value={editingConfig.laps_to_win}
                    min="1"
                    max="10"
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        laps_to_win: +e.target.value,
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                </div>

                {/* 初始卡牌数 */}
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
                    🎴 Cards
                  </label>
                  <input
                    type="number"
                    value={editingConfig.initial_cards}
                    min="0"
                    max="20"
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        initial_cards: +e.target.value,
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                {/* 事件密度 */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-white">
                      {t.setup?.eventDensity || "Event Density"}
                    </label>
                    <span className="text-sm font-bold text-cyan-400">
                      {editingConfig.event_density}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editingConfig.event_density}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        event_density: +e.target.value,
                      })
                    }
                    className="w-full"
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold text-white transition-colors">
                    {loading ? "保存中..." : t.common?.save || "Save"}
                  </button>
                  <button
                    onClick={() => setShowConfigEditor(false)}
                    disabled={loading}
                    className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg font-bold text-white transition-colors">
                    {t.common?.cancel || "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
