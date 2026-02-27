import React from "react";
import { X } from "lucide-react";
import type { Player, Card } from "@/app/types";

interface CardDrawerProps {
  players: Player[];
  turn: number;
  hasUsedCard: boolean;
  showCardDrawer: boolean;
  useCard: (card: Card) => void;
  setShowCardDrawer: (show: boolean) => void;
  t: any;
}

export default function CardDrawer({
  players,
  turn,
  hasUsedCard,
  showCardDrawer,
  useCard,
  setShowCardDrawer,
  t,
}: CardDrawerProps) {
  if (!showCardDrawer) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 z-[100]"
      onClick={() => setShowCardDrawer(false)}>
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-t-3xl md:rounded-3xl border-2 border-purple-500/50 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-violet-900 p-6 flex justify-between items-center rounded-t-3xl border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {t.handCardsListTitle || "选择卡牌"}
          </h2>
          <button
            onClick={() => setShowCardDrawer(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="text-white" size={24} />
          </button>
        </div>

        <div className="p-6">
          {players[turn] &&
          players[turn].cards &&
          players[turn].cards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players[turn].cards.map((card) => (
                <button
                  key={card.instanceId}
                  disabled={hasUsedCard}
                  onClick={() => {
                    useCard(card);
                    setShowCardDrawer(false);
                  }}
                  className="group relative bg-gradient-to-br from-purple-600 to-violet-700 p-6 rounded-xl border-2 border-purple-400/30 hover:border-purple-300 hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95">
                  <div className="absolute top-2 right-2 text-3xl group-hover:scale-110 transition-transform">
                    {card.pattern}
                  </div>
                  <div className="space-y-2 pr-12">
                    <h3 className="text-xl font-bold text-white">
                      {card.name}
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-3 py-1 rounded-full">
                      {card.target === "SELF" && "👤 自己"}
                      {card.target === "PICK_ONE" && "🎯 选择目标"}
                      {card.target === "RANDOM_OTHER" && "🎲 随机对手"}
                      {card.target === "ALL_OTHERS" && "💫 所有对手"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/60">
              {t.noAvailableCards || "没有可用卡牌"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
