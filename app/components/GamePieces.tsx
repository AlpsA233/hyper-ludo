import React from "react";
import { COLORS } from "@/app/constants";
import type { Player, Position } from "@/app/types";

interface GamePiecesProps {
  players: Player[];
  trackCoords: Position[];
  totalSteps: number;
  turn: number;
  isMoving: boolean;
  cardEffectDisplay: { [key: number]: string };
  piecesRef: React.RefObject<(HTMLDivElement | null)[]>;
}

export default function GamePieces({
  players,
  trackCoords,
  totalSteps,
  turn,
  isMoving,
  cardEffectDisplay,
  piecesRef,
}: GamePiecesProps) {
  return (
    <>
      {players.map((p, i) => {
        const posIndex =
          p.pos === -1 ? i * (totalSteps / players.length) : p.pos;
        const coord = trackCoords[posIndex];
        if (!coord) return null;

        // Convert SVG coordinates (800x800 viewBox) to percentage
        const x = (coord.x / 800) * 100;
        const y = (coord.y / 800) * 100;

        return (
          <div
            key={i}
            ref={(el) => {
              if (piecesRef.current) piecesRef.current[i] = el;
            }}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: i === turn ? 20 : 10,
            }}
            className="transition-all duration-300">
            <div
              style={{
                width: "32px",
                height: "32px",
                background: COLORS[i].hex,
                borderRadius: "50%",
                boxShadow: `0 0 15px ${COLORS[i].hex}88, 0 2px 4px rgba(0,0,0,0.3)`,
                border: i === turn ? "3px solid white" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                color: "white",
              }}>
              {i + 1}
            </div>
            {cardEffectDisplay[i] && (
              <div
                style={{
                  position: "absolute",
                  top: "-24px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "20px",
                  pointerEvents: "none",
                }}>
                {cardEffectDisplay[i]}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
