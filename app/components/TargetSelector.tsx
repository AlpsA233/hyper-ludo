"use client";

import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";
import type { Player } from "@/app/types";
import type { Translations } from "@/app/locales";

interface TargetSelectorProps {
  players: Player[];
  currentPlayerId: number;
  targetType: "PICK_ONE" | "RANDOM_OTHER" | "ALL_OTHERS";
  onSelect: (targetId: number) => void;
  onComplete: () => void;
  t: Translations;
}

export default function TargetSelector({
  players,
  currentPlayerId,
  targetType,
  onSelect,
  onComplete,
  t,
}: TargetSelectorProps) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [randomIndex, setRandomIndex] = useState(0);

  const otherPlayers = players.filter((p) => p.id !== currentPlayerId);

  useEffect(() => {
    if (targetType === "RANDOM_OTHER") {
      // 随机动画：3秒轮播
      const interval = setInterval(() => {
        setRandomIndex((prev) => (prev + 1) % otherPlayers.length);
      }, 150);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        const finalTarget =
          otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        setSelectedTarget(finalTarget.id);
        onSelect(finalTarget.id);
        setTimeout(() => {
          onComplete();
        }, 2000);
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (targetType === "ALL_OTHERS") {
      // 全部玩家：2秒后自动关闭
      setSelectedTarget(-1); // -1 表示全部
      otherPlayers.forEach((p) => onSelect(p.id));
      const timeout = setTimeout(() => {
        onComplete();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [targetType]);

  const handleManualSelect = (playerId: number) => {
    if (targetType !== "PICK_ONE") return;
    setSelectedTarget(playerId);
    onSelect(playerId);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 border-2 border-white/20 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-center mb-6 text-white">
          {targetType === "PICK_ONE"
            ? t.game.selectTarget || "选择目标"
            : targetType === "RANDOM_OTHER"
              ? t.game.randomizing || "随机选择中..."
              : t.game.allTargets || "所有玩家"}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {otherPlayers.map((player, index) => {
            const isHighlighted =
              targetType === "RANDOM_OTHER"
                ? index === randomIndex
                : selectedTarget === player.id ||
                  (targetType === "ALL_OTHERS" && selectedTarget === -1);

            const isClickable = targetType === "PICK_ONE";

            return (
              <button
                key={player.id}
                onClick={() => isClickable && handleManualSelect(player.id)}
                disabled={!isClickable}
                className={`relative p-4 rounded-xl transition-all ${
                  isHighlighted
                    ? "bg-yellow-400/30 border-2 border-yellow-400 scale-105 shadow-lg shadow-yellow-400/50"
                    : "bg-white/10 border border-white/20"
                } ${isClickable ? "hover:bg-white/20 cursor-pointer" : "cursor-default"}`}>
                <div className="flex flex-col items-center gap-2">
                  {/* 头像 */}
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-all ${
                      isHighlighted ? "ring-4 ring-yellow-400" : ""
                    }`}
                    style={{
                      backgroundColor: player.color.hex,
                      backgroundImage:
                        player.avatar &&
                        ![
                          "👤",
                          "🎭",
                          "🎨",
                          "🎯",
                          "🎪",
                          "🎸",
                          "🎮",
                          "🎲",
                        ].includes(player.avatar)
                          ? `url(${player.avatar})`
                          : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}>
                    {player.avatar &&
                      ["👤", "🎭", "🎨", "🎯", "🎪", "🎸", "🎮", "🎲"].includes(
                        player.avatar,
                      ) &&
                      player.avatar}
                  </div>

                  {/* 名称 */}
                  <div className="text-sm font-bold text-white text-center">
                    {player.name || `${t.player} ${player.id + 1}`}
                  </div>

                  {/* 选中标记 */}
                  {isHighlighted && selectedTarget !== null && (
                    <div className="absolute top-2 right-2 bg-yellow-400 rounded-full p-1">
                      <Check size={16} className="text-black" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 手动选择时的取消按钮 */}
        {targetType === "PICK_ONE" && (
          <button
            onClick={onComplete}
            className="mt-6 w-full py-2 rounded-lg bg-red-500/50 hover:bg-red-500 border border-red-400 text-white font-bold transition-colors">
            {t.cancel || "取消"}
          </button>
        )}
      </div>
    </div>
  );
}
