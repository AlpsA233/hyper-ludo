"use client";

import React from "react";
import {
  Target,
  CreditCard,
  MessageSquare,
  Settings,
  Upload,
} from "lucide-react";
import type { Translations } from "@/app/locales";

interface GameSetupProps {
  numPlayers: number;
  lapsToWin: number;
  cardCount: number;
  eventCount: number;
  onNumPlayersChange: (num: number) => void;
  onLapsToWinChange: (laps: number) => void;
  onEditCards: () => void;
  onEditEvents: () => void;
  onOpenSettings: () => void;
  onManageConfig: () => void;
  onStartGame: () => void;
  t: Translations;
}

export default function GameSetup({
  numPlayers,
  lapsToWin,
  cardCount,
  eventCount,
  onNumPlayersChange,
  onLapsToWinChange,
  onEditCards,
  onEditEvents,
  onOpenSettings,
  onManageConfig,
  onStartGame,
  t,
}: GameSetupProps) {
  return (
    <div className="w-[90%] max-w-sm p-6 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <Target size={32} className="text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold">{t.setup.title}</h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
              {t.setup.numPlayers}
            </label>
            <input
              type="number"
              value={numPlayers}
              min="2"
              max="8"
              onChange={(e) => onNumPlayersChange(+e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1 font-bold uppercase tracking-wider">
              {t.setup.lapsToWin}
            </label>
            <input
              type="number"
              value={lapsToWin}
              min="1"
              max="10"
              onChange={(e) => onLapsToWinChange(+e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onOpenSettings}
            className="w-full py-3 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:from-pink-500/20 hover:to-purple-500/20 transition-all shadow-lg active:scale-95">
            <Settings size={14} /> 游戏设置
          </button>
          <button
            onClick={onManageConfig}
            className="w-full py-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:from-orange-500/20 hover:to-red-500/20 transition-all shadow-lg active:scale-95">
            <Upload size={14} /> 配置导入导出
          </button>
          <button
            onClick={onEditCards}
            className="w-full py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-cyan-500/20 transition-all shadow-lg active:scale-95">
            <CreditCard size={14} /> {t.setup.cardLibrary} ({cardCount})
          </button>
          <button
            onClick={onEditEvents}
            className="w-full py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-all shadow-lg active:scale-95">
            <MessageSquare size={14} /> {t.setup.eventLibrary} ({eventCount})
          </button>
        </div>
        <button
          onClick={onStartGame}
          className="w-full py-4 bg-white text-black font-black rounded-xl active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] mt-4 transition-all">
          {t.setup.startGame}
        </button>
      </div>
    </div>
  );
}
