import React from "react";
import type { Player } from "@/app/types";

interface GameInfoSidebarProps {
  turn: number;
  numPlayers: number;
  lapsToWin: number;
  diceValue: number;
  t: any;
}

export default function GameInfoSidebar({
  turn,
  numPlayers,
  lapsToWin,
  diceValue,
  t,
}: GameInfoSidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 pt-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          {t.gameInfo || "游戏信息"}
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white/60">
              {t.currentRound || "当前回合"}:
            </span>
            <span className="text-white font-semibold">
              {turn + 1} / {numPlayers}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60">{t.totalLaps || "目标圈数"}:</span>
            <span className="text-white font-semibold">{lapsToWin}</span>
          </div>
          {diceValue > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-white/60">{t.lastDice || "上次掷骰"}:</span>
              <span className="text-white font-semibold text-xl">
                🎲 {diceValue}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
