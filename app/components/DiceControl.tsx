import React from "react";
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  CreditCard,
} from "lucide-react";
import type { Player, Card } from "@/app/types";

interface DiceControlProps {
  diceValue: number;
  diceResults: number[];
  diceCount: number;
  isRolling: boolean;
  isMoving: boolean;
  pickingTargetFor: Card | null;
  hasUsedCard: boolean;
  players: Player[];
  turn: number;
  diceRefs: React.RefObject<(HTMLDivElement | null)[]>;
  handleRollDice: () => void;
  setShowCardDrawer: (show: boolean) => void;
  t: any;
  isPC: boolean;
}

export default function DiceControl({
  diceValue,
  diceResults,
  diceCount,
  isRolling,
  isMoving,
  pickingTargetFor,
  hasUsedCard,
  players,
  turn,
  diceRefs,
  handleRollDice,
  setShowCardDrawer,
  t,
  isPC,
}: DiceControlProps) {
  // 生成单个骰子面的函数
  const renderDiceFaces = () => {
    // 根据diceCount决定icon大小
    const iconSize = isPC
      ? 32
      : diceCount === 1
        ? 32
        : diceCount === 2
          ? 24
          : 16;

    return (
      <>
        <div className="dice-face dice-face-1 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-400/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
          <Dice1 size={iconSize} />
        </div>
        <div className="dice-face dice-face-2 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-400/50 text-purple-400">
          <Dice2 size={iconSize} />
        </div>
        <div className="dice-face dice-face-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-400/50 text-green-400">
          <Dice3 size={iconSize} />
        </div>
        <div className="dice-face dice-face-4 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border-yellow-400/50 text-yellow-400">
          <Dice4 size={iconSize} />
        </div>
        <div className="dice-face dice-face-5 bg-gradient-to-br from-red-500/20 to-rose-600/20 border-red-400/50 text-red-400">
          <Dice5 size={iconSize} />
        </div>
        <div className="dice-face dice-face-6 bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border-indigo-400/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
          <Dice6 size={iconSize} />
        </div>
      </>
    );
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4 sm:gap-8 pointer-events-auto">
        {/* 骰子容器 - 响应式布局 */}
        <div
          className={`flex ${isPC ? "gap-4" : "gap-2"} items-center ${diceCount > 2 && !isPC ? "flex-wrap justify-center max-w-[90vw]" : ""}`}>
          {Array.from({ length: diceCount }).map((_, idx) => (
            <div
              key={idx}
              className={`dice-container cursor-pointer flex-shrink-0 ${
                isPC
                  ? "w-24 h-24"
                  : diceCount === 1
                    ? "w-16 h-16"
                    : diceCount === 2
                      ? "w-14 h-14"
                      : "w-12 h-12"
              }`}
              onClick={handleRollDice}>
              <div
                ref={(el) => {
                  if (diceRefs.current && el) {
                    diceRefs.current[idx] = el;
                  }
                }}
                className="dice-3d w-full h-full relative preserve-3d">
                {renderDiceFaces()}
              </div>
            </div>
          ))}
        </div>

        {/* 显示掷骰结果 */}
        {!isRolling && diceResults.length > 0 && (
          <div className="text-center">
            {diceResults.length > 1 ? (
              <>
                <div
                  className={`text-gray-400 mb-1 ${isPC ? "text-xs" : "text-[10px]"}`}>
                  {diceResults.join(" + ")}
                </div>
                <div
                  className={`font-bold text-cyan-400 ${isPC ? "text-lg" : "text-sm"}`}>
                  {t.game?.total || "总计"}: {diceValue}
                </div>
              </>
            ) : (
              <div
                className={`font-bold text-cyan-400 ${isPC ? "text-lg" : "text-base"}`}>
                {diceValue}
              </div>
            )}
          </div>
        )}

        {!isRolling && !isMoving && !pickingTargetFor && (
          <button
            onClick={() => setShowCardDrawer(true)}
            className="glass-btn px-4 py-2 sm:px-8 sm:py-3 rounded-full text-[10px] sm:text-xs font-bold tracking-[0.2em] flex items-center gap-2 sm:gap-3 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] border-purple-500/30 animate-float bg-gradient-to-r from-purple-900/40 to-blue-900/40">
            <CreditCard size={12} className="sm:size-[14px] text-purple-300" />
            {t.handCards || "使用卡牌"}
          </button>
        )}
      </div>
    </div>
  );
}
