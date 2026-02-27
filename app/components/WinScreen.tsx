import React from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { COLORS } from "@/app/constants";
import type { Player, GamePhase } from "@/app/types";

interface WinScreenProps {
  winner: Player | null;
  winnerIndex: number;
  setPhase: (phase: GamePhase) => void;
  t: any;
}

export default function WinScreen({
  winner,
  winnerIndex,
  setPhase,
  t,
}: WinScreenProps) {
  if (!winner) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-500/20 to-red-500/20 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
      <div
        className="bg-gradient-to-br from-yellow-900/80 via-orange-900/80 to-red-900/80 backdrop-blur-xl rounded-3xl border-4 border-yellow-400/50 shadow-2xl max-w-2xl w-full p-12 text-center space-y-8 animate-[fadeIn_0.5s_ease-out]"
        style={{
          boxShadow: "0 0 80px rgba(251, 191, 36, 0.5)",
        }}>
        <div className="animate-bounce">
          <Trophy
            className="mx-auto text-yellow-300"
            size={120}
            strokeWidth={1.5}
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 animate-pulse">
            {t.victory || "胜利"}!
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl border-4 shadow-2xl"
              style={{
                background: COLORS[winnerIndex].hex,
                borderColor: COLORS[winnerIndex].hex,
                boxShadow: `0 0 30px ${COLORS[winnerIndex].hex}`,
              }}>
              {winner.avatar && winner.avatar.startsWith("http") ? (
                <img
                  src={winner.avatar}
                  alt={winner.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-5xl">{winner.avatar || "👤"}</span>
              )}
            </div>
            <div className="text-left">
              <p className="text-5xl font-bold text-white">{winner.name}</p>
              <p className="text-xl text-yellow-200 mt-2">
                {t.victoryAchieved}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/20">
          <button
            onClick={() => setPhase("setup")}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 active:scale-95">
            <RotateCcw size={24} />
            {t.restartGame || "重新开始"}
          </button>
        </div>
      </div>
    </div>
  );
}
