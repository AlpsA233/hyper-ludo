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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-[100]"
      onClick={() => setShowCardDrawer(false)}>
      <div
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-t-3xl md:rounded-3xl border-t-2 md:border-2 border-purple-500/50 shadow-2xl w-full sm:w-96 md:max-w-2xl md:max-h-[80vh] max-h-[92vh] overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out] md:animate-none relative"
        style={{ animation: "slideUp 0.3s ease-out" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-900 to-violet-900 px-4 py-3 md:p-6 flex justify-between items-center border-b border-white/10">
          <h2 className="text-lg md:text-2xl font-bold text-white flex-1">
            {t.handCardsListTitle || "选择卡牌"}
          </h2>
        </div>

        {/* Close Button - Floating */}
        <button
          onClick={() => setShowCardDrawer(false)}
          className="absolute top-3 right-3 md:top-6 md:right-6 z-50 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors active:bg-white/30 backdrop-blur-sm">
          <X className="text-white" size={24} />
        </button>

        {/* Content - Grid Layout */}
        <div className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4">
          {players[turn] &&
          players[turn].cards &&
          players[turn].cards.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3">
              {players[turn].cards.map((card) => (
                <button
                  key={card.instanceId}
                  disabled={hasUsedCard}
                  onClick={() => {
                    useCard(card);
                    setShowCardDrawer(false);
                  }}
                  className="group relative bg-gradient-to-br from-purple-600 to-violet-700 px-2 py-2.5 md:p-4 rounded-lg md:rounded-xl border border-purple-400/30 md:border-2 active:border-purple-300 active:shadow-lg active:shadow-purple-500/20 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center md:items-start gap-1.5 md:gap-2 min-h-fit">
                  <div className="text-xl md:text-3xl">{card.pattern}</div>
                  <div className="w-full text-center md:text-left">
                    <h3 className="text-xs md:text-base font-bold text-white truncate">
                      {card.name}
                    </h3>
                    <p className="text-xs md:text-xs text-white/70 line-clamp-1 md:line-clamp-2 mt-0.5">
                      {card.desc}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <span className="inline-flex items-center gap-0.5 text-xs bg-white/20 text-white px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex-shrink-0">
                      {card.target === "SELF" && "👤"}
                      {card.target === "PICK_ONE" && "🎯"}
                      {card.target === "RANDOM_OTHER" && "🎲"}
                      {card.target === "ALL_OTHERS" && "💫"}
                      <span className="hidden md:inline text-xs">
                        {card.target === "SELF" && "自己"}
                        {card.target === "PICK_ONE" && "选择"}
                        {card.target === "RANDOM_OTHER" && "随机"}
                        {card.target === "ALL_OTHERS" && "全体"}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 md:h-40 text-white/60 text-sm md:text-base">
              {t.noAvailableCards || "没有可用卡牌"}
            </div>
          )}
        </div>

        {/* Footer Spacer */}
        <div className="flex-shrink-0 h-2 md:h-0" />
      </div>
    </div>
  );
}
