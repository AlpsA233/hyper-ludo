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
import type { Player } from "@/app/types";

interface DiceControlProps {
  diceValue: number;
  isRolling: boolean;
  isMoving: boolean;
  pickingTargetFor: string | null;
  hasUsedCard: boolean;
  players: Player[];
  turn: number;
  diceRef: React.RefObject<HTMLDivElement>;
  handleRollDice: () => void;
  setShowCardDrawer: (show: boolean) => void;
  t: any;
  isPC: boolean;
}

export default function DiceControl({
  diceValue,
  isRolling,
  isMoving,
  pickingTargetFor,
  hasUsedCard,
  players,
  turn,
  diceRef,
  handleRollDice,
  setShowCardDrawer,
  t,
  isPC,
}: DiceControlProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-8 pointer-events-auto">
        <div
          className="dice-container w-16 h-16 sm:w-24 sm:h-24 cursor-pointer"
          onClick={handleRollDice}>
          <div
            ref={diceRef}
            className="dice-3d w-full h-full relative preserve-3d">
            <div className="dice-face dice-face-1 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-400/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Dice1 size={32} className="sm:size-[48px]" />
            </div>
            <div className="dice-face dice-face-2 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-400/50 text-purple-400">
              <Dice2 size={32} className="sm:size-[48px]" />
            </div>
            <div className="dice-face dice-face-3 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-400/50 text-green-400">
              <Dice3 size={32} className="sm:size-[48px]" />
            </div>
            <div className="dice-face dice-face-4 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border-yellow-400/50 text-yellow-400">
              <Dice4 size={32} className="sm:size-[48px]" />
            </div>
            <div className="dice-face dice-face-5 bg-gradient-to-br from-red-500/20 to-rose-600/20 border-red-400/50 text-red-400">
              <Dice5 size={32} className="sm:size-[48px]" />
            </div>
            <div className="dice-face dice-face-6 bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border-indigo-400/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <Dice6 size={32} className="sm:size-[48px]" />
            </div>
          </div>
        </div>

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
