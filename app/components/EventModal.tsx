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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-8 py-2 sm:p-4 z-[90]">
      <div
        className="bg-gradient-to-br from-purple-900 via-violet-900 to-fuchsia-900 rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-purple-400/50 shadow-2xl max-w-sm w-full p-4 sm:p-8 animate-[fadeIn_0.3s_ease-out]"
        style={{
          boxShadow: "0 0 60px rgba(168, 85, 247, 0.4)",
        }}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="text-5xl sm:text-7xl animate-bounce">⚡</div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
              {t.eventTriggered}
            </h2>
            <p className="text-sm sm:text-lg text-white/90 leading-relaxed">
              {activeEvent.text}
            </p>
          </div>

          <div className="pt-3 sm:pt-4 border-t border-white/20">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
              <span className="text-xs sm:text-sm text-white/70">
                {t.eventTarget}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {activeEvent.target === "SELF" && t.targetSelfEmoji}
                {activeEvent.target === "ALL_PLAYERS" &&
                  t.targetAllPlayersEmoji}
                {activeEvent.target === "RANDOM_OTHER" &&
                  t.targetRandomOtherEmoji}
              </span>
            </div>
          </div>

          <button
            onClick={applyEventEffect}
            className="w-full py-2.5 sm:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 active:scale-95">
            {t.taskComplete || "继续"}
          </button>
        </div>
      </div>
    </div>
  );
}
