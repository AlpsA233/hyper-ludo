import React from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { COLORS } from "@/app/constants";
import type { Player, GamePhase } from "@/app/types";

interface WinScreenProps {
  players: Player[];
  setPhase: (phase: GamePhase) => void;
  t: any;
}

const RANK_BADGE = ["🥇", "🥈", "🥉"];

export default function WinScreen({ players, setPhase, t }: WinScreenProps) {
  if (players.length === 0) return null;

  // 按完赛排名排序（未完赛的排最后）
  const ranked = [...players].sort((a, b) => {
    const ra = a.finishRank ?? players.length + 1;
    const rb = b.finishRank ?? players.length + 1;
    return ra - rb;
  });

  const champion = ranked[0];
  const championColor = COLORS[champion.id]?.hex ?? "#facc15";

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-500/20 to-red-500/20 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
      <div
        className="bg-gradient-to-br from-yellow-900/80 via-orange-900/80 to-red-900/80 backdrop-blur-xl rounded-3xl border-4 border-yellow-400/50 shadow-2xl max-w-2xl w-full p-8 text-center space-y-6 animate-[fadeIn_0.5s_ease-out]"
        style={{ boxShadow: "0 0 80px rgba(251, 191, 36, 0.5)" }}>
        <div className="animate-bounce">
          <Trophy
            className="mx-auto text-yellow-300"
            size={80}
            strokeWidth={1.5}
          />
        </div>

        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 animate-pulse">
          {t.victory || "游戏结束"}!
        </h1>

        {/* 冠军 */}
        <div className="flex items-center justify-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-2xl"
            style={{
              background: championColor,
              borderColor: championColor,
              boxShadow: `0 0 30px ${championColor}`,
            }}>
            {champion.avatar?.startsWith("http") ? (
              <img
                src={champion.avatar}
                alt={champion.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl">{champion.avatar || "👤"}</span>
            )}
          </div>
          <div className="text-left">
            <p className="text-4xl font-bold text-white">🥇 {champion.name}</p>
            <p className="text-lg text-yellow-200">
              {t.victoryAchieved || "第一名完赛！"}
            </p>
          </div>
        </div>

        {/* 完整排名 */}
        {ranked.length > 1 && (
          <div className="space-y-2 text-left">
            {ranked.slice(1).map((p, i) => {
              const rank = i + 2;
              const color = COLORS[p.id]?.hex ?? "#888";
              const isLast = !p.finished;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/10">
                  <span className="text-2xl w-8 text-center">
                    {rank <= 3 ? RANK_BADGE[rank - 1] : `${rank}`}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg border-2"
                    style={{ background: color, borderColor: color }}>
                    {p.avatar?.startsWith("http") ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{p.avatar || "👤"}</span>
                    )}
                  </div>
                  <span className="text-white font-semibold flex-1">
                    {p.name}
                  </span>
                  {isLast && (
                    <span className="text-xs text-red-300 font-bold">
                      末位淘汰
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t border-white/20">
          <button
            onClick={() => setPhase("setup")}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 active:scale-95">
            <RotateCcw size={24} />
            {t.restartGame || "重新开始"}
          </button>
        </div>
      </div>
    </div>
  );
}
