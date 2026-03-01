"use client";

import React, { useEffect, useState } from "react";
import { Play, Copy, Check, X, LogOut } from "lucide-react";
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
  const { room, players, isCreator, startGame, leaveRoom, subscribe, error } =
    useRoom(userId);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // 订阅房间实时更新
  useEffect(() => {
    const unsubscribe = subscribe(roomId);
    return unsubscribe;
  }, [roomId, subscribe]);

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
            <p className="text-xs font-bold text-gray-400 mb-3">
              {t.room?.config || "Game Config"}
            </p>
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
                  disabled={loading || players.length === 0}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all">
                  <Play size={18} />
                  {loading
                    ? t.common?.starting || "Starting..."
                    : t.common?.startGame || "Start Game"}
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
      </div>
    </div>
  );
}
