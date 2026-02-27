import React from "react";
import type { GameEvent } from "@/app/types";

interface EventModalProps {
  activeEvent: GameEvent | null;
  applyEventEffect: () => void;
  t: any;
}

export default function EventModal({
  activeEvent,
  applyEventEffect,
  t,
}: EventModalProps) {
  if (!activeEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
      <div
        className="bg-gradient-to-br from-purple-900 via-violet-900 to-fuchsia-900 rounded-3xl border-4 border-purple-400/50 shadow-2xl max-w-lg w-full p-8 animate-[fadeIn_0.3s_ease-out]"
        style={{
          boxShadow: "0 0 60px rgba(168, 85, 247, 0.4)",
        }}>
        <div className="text-center space-y-6">
          <div className="text-7xl animate-bounce">⚡</div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">事件触发</h2>
            <p className="text-lg text-white/90 leading-relaxed">
              {activeEvent.text}
            </p>
          </div>

          <div className="pt-4 border-t border-white/20">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-sm text-white/70">影响目标:</span>
              <span className="text-sm font-semibold text-white">
                {activeEvent.target === "SELF" && "👤 自己"}
                {activeEvent.target === "ALL_PLAYERS" && "🌟 所有玩家"}
                {activeEvent.target === "RANDOM_OTHER" && "🎲 随机对手"}
              </span>
            </div>
          </div>

          <button
            onClick={applyEventEffect}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 active:scale-95">
            {t.taskComplete || "继续"}
          </button>
        </div>
      </div>
    </div>
  );
}
