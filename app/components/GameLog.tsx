import React from "react";

interface GameLogProps {
  logs: string[];
  showLogs: boolean;
  logsContainerRef: React.RefObject<HTMLDivElement>;
  isPC: boolean;
}

export default function GameLog({
  logs,
  showLogs,
  logsContainerRef,
  isPC,
}: GameLogProps) {
  if (!showLogs) return null;

  return (
    <div
      ref={logsContainerRef}
      className={`fixed bottom-12 sm:bottom-24 z-[60] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 animate-slide-up max-h-[15vh] overflow-y-auto custom-scrollbar ${isPC ? "left-8 right-8 max-w-[1400px] mx-auto" : "inset-x-4"}`}>
      <div className="space-y-1.5">
        {logs.map((l, i) => (
          <div
            key={i}
            className="text-[11px] text-gray-300 font-mono opacity-80 border-l border-white/20 pl-2">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
