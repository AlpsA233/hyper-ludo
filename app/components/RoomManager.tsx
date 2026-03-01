"use client";

import React, { useState } from "react";
import { Plus, LogIn, Copy, Check, X } from "lucide-react";
import type { Translations } from "@/app/locales";
import { useRoom } from "@/app/hooks/useRoom";

interface RoomManagerProps {
  userId: string | null;
  onRoomCreated?: (roomId: string) => void;
  onRoomJoined?: (roomId: string) => void;
  onCancel?: () => void;
  t: Translations;
}

export default function RoomManager({
  userId,
  onRoomCreated,
  onRoomJoined,
  onCancel,
  t,
}: RoomManagerProps) {
  const { createRoom, joinRoom } = useRoom(userId);

  const [mode, setMode] = useState<"select" | "create" | "join">("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);

    try {
      const roomId = await createRoom({
        num_players: 4,
        dice_count: 1,
        laps_to_win: 3,
        initial_cards: 5,
        event_density: 40,
      });

      // 获取房间码（需要从数据库查询）
      // 这里假设创建成功后返回roomId，需要在useRoom中修改
      setCreatedRoomCode("000001"); // 临时
      onRoomCreated?.(roomId);
    } catch (err: any) {
      setError(err.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError("Please enter room code");
      return;
    }
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await joinRoom(roomCode, playerName, "👤");
      onRoomJoined?.(roomCode);
    } catch (err: any) {
      setError(err.message || "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-fade-in">
      <div className="w-full max-w-[380px] bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl p-8 shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black italic bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            {mode === "select"
              ? "Game Room"
              : mode === "create"
                ? "Create Room"
                : "Join Room"}
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* 模式选择 */}
        {mode === "select" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("create")}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all shadow-lg">
              <Plus size={20} />➕ {t.common.create || "Create Room"}
            </button>

            <button
              onClick={() => setMode("join")}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all shadow-lg">
              <LogIn size={20} />
              🔗 {t.common.join || "Join Room"}
            </button>

            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors">
                {t.common.cancel || "Cancel"}
              </button>
            )}
          </div>
        )}

        {/* 创建房间模式 */}
        {mode === "create" && !createdRoomCode && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {t.room?.createInfo || "Create a new room to play with friends"}
            </p>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all">
              {loading ? "Creating..." : t.common?.create || "Create"}
            </button>

            <button
              onClick={() => {
                setMode("select");
                setError(null);
              }}
              className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors text-sm">
              {t.common?.back || "Back"}
            </button>
          </div>
        )}

        {/* 房间创建成功 */}
        {mode === "create" && createdRoomCode && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/50 rounded-lg text-center">
              <p className="text-sm text-gray-300 mb-2">
                {t.room?.roomCode || "Room Code"}
              </p>
              <p className="text-4xl font-black text-green-400 font-mono tracking-widest mb-4">
                {createdRoomCode}
              </p>

              <button
                onClick={copyToClipboard}
                className="w-full py-2 px-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-colors">
                {copied ? (
                  <>
                    <Check size={16} />
                    {t.common?.copied || "Copied"}
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    {t.common?.copy || "Copy"}
                  </>
                )}
              </button>
            </div>

            <p className="text-sm text-gray-400 text-center">
              {t.room?.shareCode || "Share this code with friends to join"}
            </p>

            <button
              onClick={() => {
                setCreatedRoomCode(null);
                setMode("select");
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-white transition-all">
              {t.common?.continue || "Continue"}
            </button>
          </div>
        )}

        {/* 加入房间模式 */}
        {mode === "join" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {t.room?.joinInfo || "Enter room code to join a game"}
            </p>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">
                {t.room?.roomCode || "Room Code"}
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 font-mono text-lg tracking-widest text-center focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block">
                {t.common?.playerName || "Your Name"}
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.common?.playerName || "Your Name"}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all">
              {loading ? "Joining..." : t.common?.join || "Join"}
            </button>

            <button
              onClick={() => {
                setMode("select");
                setError(null);
                setRoomCode("");
                setPlayerName("");
              }}
              className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors text-sm">
              {t.common?.back || "Back"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
