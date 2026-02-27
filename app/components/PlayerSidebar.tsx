import React from "react";
import { ChevronLeft } from "lucide-react";
import { COLORS } from "@/app/constants";
import type { Player } from "@/app/types";

interface PlayerSidebarProps {
  players: Player[];
  turn: number;
  lapsToWin: number;
  totalSteps: number;
  isPC: boolean;
  t: any;
}

export default function PlayerSidebar({
  players,
  turn,
  lapsToWin,
  totalSteps,
  isPC,
  t,
}: PlayerSidebarProps) {
  const getRankingBadge = (rank: number) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return `${rank + 1}`;
  };

  const calculateProgress = (p: Player, i: number) => {
    const startIndex = i * (totalSteps / players.length);
    const relativePos =
      p.pos !== -1 ? (p.pos - startIndex + totalSteps) % totalSteps : 0;
    const totalProgress = p.lap * totalSteps + relativePos;
    const maxProgress = lapsToWin * totalSteps;
    return (totalProgress / maxProgress) * 100;
  };

  // PC端: 按照实际进度排序
  const displayPlayers = isPC
    ? [...players]
        .map((p, i) => ({ player: p, index: i }))
        .sort((a, b) => {
          const startIndexA = a.index * (totalSteps / players.length);
          const relPosA =
            a.player.pos !== -1
              ? (a.player.pos - startIndexA + totalSteps) % totalSteps
              : 0;
          const progressA = a.player.lap * totalSteps + relPosA;

          const startIndexB = b.index * (totalSteps / players.length);
          const relPosB =
            b.player.pos !== -1
              ? (b.player.pos - startIndexB + totalSteps) % totalSteps
              : 0;
          const progressB = b.player.lap * totalSteps + relPosB;

          return progressB - progressA;
        })
    : players.map((p, i) => ({ player: p, index: i }));

  // 计算排名
  const rankings = [...players]
    .map((p, i) => {
      const startIndex = i * (totalSteps / players.length);
      const relPos =
        p.pos !== -1 ? (p.pos - startIndex + totalSteps) % totalSteps : 0;
      return { index: i, progress: p.lap * totalSteps + relPos };
    })
    .sort((a, b) => b.progress - a.progress);

  const getRank = (playerIndex: number) => {
    return rankings.findIndex((r) => r.index === playerIndex);
  };

  if (isPC) {
    return (
      <div className="w-64 flex-shrink-0 flex flex-col gap-4 pt-4">
        {displayPlayers.map(({ player: p, index: i }) => {
          const progress = calculateProgress(p, i);
          const rank = getRank(i);

          return (
            <div
              key={i}
              className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 transition-all duration-300 hover:bg-white/15"
              style={{
                boxShadow: i === turn ? `0 0 20px ${COLORS[i].hex}` : "none",
              }}>
              {/* Turn Indicator */}
              {i === turn && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 -translate-x-8">
                  <ChevronLeft
                    className="text-cyan-400 animate-pulse"
                    size={24}
                  />
                </div>
              )}

              {/* Ranking Badge */}
              <div
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg"
                style={{
                  background:
                    rank < 3
                      ? "linear-gradient(135deg, #FFD700, #FFA500)"
                      : "rgba(255,255,255,0.2)",
                  border: "2px solid white",
                }}>
                {getRankingBadge(rank)}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-full shadow-lg relative overflow-hidden flex items-center justify-center shrink-0 border-2 text-xl"
                    style={{
                      borderColor: COLORS[i].hex,
                      backgroundColor: `${COLORS[i].hex}20`,
                    }}>
                    {p.avatar && p.avatar.startsWith("http") ? (
                      <img
                        src={p.avatar}
                        alt={`Player ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{p.avatar || "👤"}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-white/60">
                    {p.lap}/{lapsToWin} {t.circle}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: `linear-gradient(90deg, ${COLORS[i].hex}, ${COLORS[i].hex}dd)`,
                  }}
                />
              </div>
              <div className="text-right text-xs text-white/60 mt-1">
                {progress.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Mobile: horizontal scroll
  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="flex gap-3 px-4">
        {displayPlayers.map(({ player: p, index: i }) => {
          const progress = calculateProgress(p, i);
          const rank = getRank(i);

          return (
            <div
              key={i}
              className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 min-w-[160px] flex-shrink-0"
              style={{
                boxShadow: i === turn ? `0 0 20px ${COLORS[i].hex}` : "none",
              }}>
              {/* Turn Indicator */}
              {i === turn && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4">
                  <ChevronLeft
                    className="text-cyan-400 animate-pulse rotate-90"
                    size={20}
                  />
                </div>
              )}

              {/* Ranking Badge */}
              <div
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-lg"
                style={{
                  background:
                    rank < 3
                      ? "linear-gradient(135deg, #FFD700, #FFA500)"
                      : "rgba(255,255,255,0.2)",
                  border: "2px solid white",
                }}>
                {getRankingBadge(rank)}
              </div>

              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-10 h-10 rounded-full shadow-lg relative overflow-hidden flex items-center justify-center shrink-0 border-2 text-xl"
                  style={{
                    borderColor: COLORS[i].hex,
                    backgroundColor: `${COLORS[i].hex}20`,
                  }}>
                  {p.avatar && p.avatar.startsWith("http") ? (
                    <img
                      src={p.avatar}
                      alt={`Player ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{p.avatar || "👤"}</span>
                  )}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-white text-sm truncate max-w-[120px]">
                    {p.name}
                  </div>
                  <div className="text-xs text-white/60">
                    {p.lap}/{lapsToWin} {t.circle}
                  </div>
                </div>
                <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      background: COLORS[i].hex,
                    }}
                  />
                </div>
                <div className="text-xs text-white/60">
                  {progress.toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
