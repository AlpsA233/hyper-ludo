import React from "react";
import { COLORS } from "@/app/constants";
import type { Player, BoardTile, Position } from "@/app/types";

interface GameBoardProps {
  trackCoords: Position[];
  boardTiles: BoardTile[];
  totalSteps: number;
  numPlayers: number;
  trackRadius: number;
  decorativeRadius1: number;
  decorativeRadius2: number;
  trackWidth: number;
  innerRadius: number;
  innerRadius2: number;
  eventDensity: number;
  center: { x: number; y: number };
  isPC: boolean;
}

export default function GameBoard({
  trackCoords,
  boardTiles,
  totalSteps,
  numPlayers,
  trackRadius,
  decorativeRadius1,
  decorativeRadius2,
  trackWidth,
  innerRadius,
  innerRadius2,
  eventDensity,
  isPC,
}: GameBoardProps) {
  return (
    <div
      className={`relative ${isPC ? "flex-1 max-w-[min(70vh,750px)]" : "w-full max-w-[min(95vw,450px)] md:max-w-[min(85vw,650px)]"} aspect-square`}>
      <svg
        viewBox="0 0 800 800"
        className="w-full h-full drop-shadow-2xl overflow-visible filter drop-shadow-[0_0_30px_rgba(5,217,232,0.1)]">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient
            id="trackGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%">
            <stop offset="0%" stopColor="rgba(5, 217, 232, 0.05)" />
            <stop offset="100%" stopColor="rgba(211, 85, 255, 0.05)" />
          </linearGradient>
        </defs>

        {/* Decorative Rings */}
        <circle
          cx="400"
          cy="400"
          r={decorativeRadius1}
          fill="none"
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="1"
          strokeDasharray="10 20"
          className="animate-[spin_60s_linear_infinite]"
        />
        <circle
          cx="400"
          cy="400"
          r={decorativeRadius2}
          fill="none"
          stroke="rgba(255,255,255,0.01)"
          strokeWidth="1"
          strokeDasharray="5 15"
          className="animate-[spin_80s_linear_infinite_reverse]"
        />

        {/* Main Track Background */}
        <circle
          cx="400"
          cy="400"
          r={trackRadius}
          fill="none"
          stroke="url(#trackGradient)"
          strokeWidth={trackWidth}
          className="backdrop-blur-sm"
        />
        <circle
          cx="400"
          cy="400"
          r={innerRadius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
        <circle
          cx="400"
          cy="400"
          r={innerRadius2}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />

        {/* Track Points */}
        {trackCoords.map((pos, i) => {
          const tile = boardTiles[i];
          const startPIdx =
            i % (totalSteps / numPlayers) === 0
              ? i / (totalSteps / numPlayers)
              : -1;
          const isCustom = tile?.id === "CUSTOM";
          const isStart = startPIdx >= 0;
          const shouldShowAsEvent = eventDensity === 100 && !isStart;

          let fill = "rgba(255,255,255,0.25)";
          let radius = 3;
          let filter = "";

          if (isStart) {
            fill = COLORS[startPIdx].hex;
            radius = 8;
            filter = "url(#glow)";
          } else if (isCustom || shouldShowAsEvent) {
            fill = "#D355FF";
            radius = 5;
            filter = "url(#glow)";
          }

          return (
            <g key={i}>
              {isStart && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={12}
                  fill="transparent"
                  stroke={fill}
                  strokeWidth="1"
                  opacity="0.5"
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={fill}
                filter={filter}
                className="transition-all duration-300"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
