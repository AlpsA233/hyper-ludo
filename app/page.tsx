"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Globe } from "lucide-react";
import type { Language } from "@/app/locales";
import { getTranslation } from "@/app/locales";
import { useLanguage } from "@/app/hooks/useLanguage";
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Trophy,
  Home,
  AlertTriangle,
  X,
  ScrollText,
  CreditCard,
  Star,
  Target,
  MessageSquare,
} from "lucide-react";
import GameSetup from "@/app/components/GameSetup";
import CardEditor from "@/app/components/CardEditor";
import EventEditor from "@/app/components/EventEditor";
import GameSettings from "@/app/components/GameSettings";
import ConfigManager from "@/app/components/ConfigManager";
import TargetSelector from "@/app/components/TargetSelector";
import {
  COLORS,
  RARITY_CONFIG,
  DEFAULT_CARD_DB,
  DEFAULT_EVENT_DB,
} from "@/app/constants";
import type {
  GamePhase,
  ColorConfig,
  Card,
  GameEvent,
  Player,
  BoardTile,
  Position,
} from "@/app/types";

/**
 * ==================== 游戏逻辑架构说明 ====================
 *
 * 【核心系统】
 * 1. 位置计算：calculateNewPosition() - 统一处理所有移动计算
 * 2. 卡牌效果：executeCardEffect() - 应用卡牌效果（move/skip/restart）
 * 3. 掷骰移动：handleRollDice() + handleMove() - 掷骰子并移动
 * 4. 事件效果：触发在 CUSTOM 格子，应用在事件对话框确认时
 *
 * 【效果类型】
 * - move: 移动指定格数（正数前进，负数后退）
 * - skip: 暂停一回合
 * - restart: 回到起点（卡牌）或本圈起点（事件）
 *
 * 【执行流程】
 * 1. 掷骰子 -> handleRollDice() -> 更新 diceValue
 * 2. 移动 -> handleMove() -> calculateNewPosition() -> 更新玩家位置
 * 3. 检查格子 -> 如果是 CUSTOM 格子 -> 触发随机事件
 * 4. 事件对话框 -> 用户确认 -> 应用事件效果 -> 切换回合
 * 5. 使用卡牌 -> executeCardEffect() -> 应用效果 -> 标记已使用
 *
 * 【关键设计】
 * - 每个玩家有独立的起始位置 (startPos)，确保公平竞争
 * - 圈数计算基于从起点走过的总距离
 * - 卡牌每回合只能使用一次 (hasUsedCard)
 * - 玩家可以共享相同位置（无碰撞）
 */

// --- 1. 骰子图标 ---
const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

// --- 2. 辅助函数 ---
const getPolygonalPos = (
  index: number,
  total: number,
  radius: number,
  cx: number,
  cy: number,
): Position => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
};

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const { t } = useLanguage(language);

  // --- 状态管理 ---
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [numPlayers, setNumPlayers] = useState(4);
  const [lapsToWin, setLapsToWin] = useState(3);
  const [initialCards, setInitialCards] = useState(5);
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gsapLoaded, setGsapLoaded] = useState(false);
  const [hasUsedCard, setHasUsedCard] = useState(false);

  // 自定义数据状态
  const [cardDatabase, setCardDatabase] = useState<Card[]>(DEFAULT_CARD_DB);
  const [eventDatabase, setEventDatabase] =
    useState<GameEvent[]>(DEFAULT_EVENT_DB);

  // 设置状态
  const [backgroundSettings, setBackgroundSettings] = useState<{
    type: "color" | "image";
    value: string;
  }>({ type: "color", value: "#050510" });
  const [playerAvatars, setPlayerAvatars] = useState<string[]>(
    Array(8).fill("👤"),
  );

  const [showCardDrawer, setShowCardDrawer] = useState(false);
  const [pickingTargetFor, setPickingTargetFor] = useState<Card | null>(null);
  const [boardTiles, setBoardTiles] = useState<BoardTile[]>([]);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // 记录每个玩家头像上显示的卡牌效果emoji和消失时间
  const [cardEffectDisplay, setCardEffectDisplay] = useState<
    Record<number, { emoji: string; hideTime: number }>
  >({});

  const diceRef = useRef<HTMLDivElement>(null);
  const piecesRef = useRef<(HTMLDivElement | null)[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 初始化加载
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 简单的视差效果
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      document.body.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
    };
    window.addEventListener("mousemove", handleMouseMove);

    if (typeof window !== "undefined" && !(window as any).gsap) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      script.async = true;
      script.onload = () => setGsapLoaded(true);
      document.body.appendChild(script);
    } else setGsapLoaded(true);

    const savedCards = localStorage.getItem("party_ludo_cards");
    if (savedCards) setCardDatabase(JSON.parse(savedCards));
    const savedEvents = localStorage.getItem("party_ludo_events");
    if (savedEvents) setEventDatabase(JSON.parse(savedEvents));

    // 加载背景和头像设置
    const savedBg = localStorage.getItem("hyper_ludo_background");
    if (savedBg) setBackgroundSettings(JSON.parse(savedBg));
    const savedAvatars = localStorage.getItem("hyper_ludo_avatars");
    if (savedAvatars) setPlayerAvatars(JSON.parse(savedAvatars));

    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 日志仅在日志框打开时滚动到底部
  useEffect(() => {
    if (logsContainerRef.current && showLogs) {
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop =
            logsContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [showLogs]);

  // 清理过期的卡牌效果emoji
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCardEffectDisplay = { ...cardEffectDisplay };
      let changed = false;

      Object.keys(newCardEffectDisplay).forEach((key) => {
        if (newCardEffectDisplay[parseInt(key)].hideTime <= now) {
          delete newCardEffectDisplay[parseInt(key)];
          changed = true;
        }
      });

      if (changed) {
        setCardEffectDisplay(newCardEffectDisplay);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [cardEffectDisplay]);

  const totalSteps = useMemo(() => numPlayers * 10, [numPlayers]);
  const center = { x: 400, y: 400 };

  const trackCoords = useMemo(() => {
    const coords = [];
    for (let i = 0; i < totalSteps; i++) {
      coords.push(getPolygonalPos(i, totalSteps, 260, center.x, center.y));
    }
    return coords;
  }, [totalSteps]);

  // --- 游戏逻辑 ---
  const startGame = () => {
    if (eventDatabase.length === 0) return alert(t.game.noEventsAlert);

    const tiles: BoardTile[] = Array.from({ length: totalSteps }).map((_, i) =>
      i % (totalSteps / numPlayers) < 2
        ? { id: "SAFE" as const }
        : Math.random() < 0.4
          ? { id: "CUSTOM" as const }
          : { id: "SAFE" as const },
    );
    setBoardTiles(tiles);

    // 读取保存的玩家名称
    const savedNames = JSON.parse(
      localStorage.getItem("hyper_ludo_player_names") || "[]",
    );

    const initialPlayers: Player[] = Array.from({ length: numPlayers }).map(
      (_, i) => ({
        id: i,
        color: COLORS[i],
        pos: -1,
        lap: 0,
        startPos: Math.floor(totalSteps / numPlayers) * i, // 记录每个玩家的起始位置
        shield: false,
        skipTurn: false,
        avatar: playerAvatars[i] || "👤", // 应用玩家头像设置
        name: savedNames[i] || `${t.player} ${i + 1}`, // 应用玩家名称设置
        cards: Array.from({ length: initialCards }).map(() => {
          const baseCard =
            cardDatabase[Math.floor(Math.random() * cardDatabase.length)];
          const card: Card = {
            id: baseCard.id,
            rarity: baseCard.rarity as "NR" | "R" | "SR" | "SSR",
            name: baseCard.name,
            desc: baseCard.desc,
            pattern: baseCard.pattern,
            target: baseCard.target as
              | "SELF"
              | "PICK_ONE"
              | "RANDOM_OTHER"
              | "ALL_OTHERS",
            effect: { ...baseCard.effect },
            instanceId: Math.random(),
          };
          return card;
        }),
      }),
    );
    setPlayers(initialPlayers);
    setPhase("playing");
    setTurn(0);
    setHasUsedCard(false);
    setWinner(null);
    addLog(t.game.battleInitialized);
  };

  const useCard = (card: Card) => {
    if (isMoving || isRolling) return;
    if (hasUsedCard) {
      addLog("System: Energy depletion. Only 1 ability per cycle.");
      return;
    }
    // 对于所有需要目标的卡牌，都显示目标选择器
    if (
      card.target === "PICK_ONE" ||
      card.target === "RANDOM_OTHER" ||
      card.target === "ALL_OTHERS"
    ) {
      setPickingTargetFor(card);
      setShowCardDrawer(false);
      return;
    }
    executeCardEffect(card);
  };

  /**
   * 执行卡牌效果
   * 注意：此函数会直接更新玩家状态，不会触发 handleMove
   * 对于自己使用的移动卡牌，会播放移动动画但不切换回合
   * @param card - 使用的卡牌
   * @param targetId - 如果是 PICK_ONE 目标，指定的玩家 ID
   */
  const executeCardEffect = (card: Card, targetId: number | null = null) => {
    const newPlayers = [...players];
    const currentPlayer = newPlayers[turn];
    currentPlayer.cards = currentPlayer.cards.filter(
      (c) => c.instanceId !== card.instanceId,
    );

    addLog(`Player ${turn + 1} used: ${card.name} - ${card.desc}`);

    let targets: number[] = [];
    if (card.target === "SELF") targets = [turn];
    else if (card.target === "ALL_OTHERS")
      targets = newPlayers.map((p) => p.id).filter((id) => id !== turn);
    else if (card.target === "RANDOM_OTHER") {
      const others = newPlayers.map((p) => p.id).filter((id) => id !== turn);
      targets = [others[Math.floor(Math.random() * others.length)]];
    } else if (card.target === "PICK_ONE")
      targets = targetId !== null ? [targetId] : [];

    // 用于显示emoji的延迟时间
    const newCardEffectDisplay = { ...cardEffectDisplay };

    targets.forEach((tid) => {
      const t = newPlayers[tid];
      let hideTime = Date.now() + 1000; // 默认1秒显示

      if (card.effect.move) {
        // 使用统一的位置计算函数
        const newPosition = calculateNewPosition(t, card.effect.move);
        t.pos = newPosition.pos;
        t.lap = newPosition.lap;
        // 移动卡牌：走完后显示1秒（约750ms的动画+250ms延迟）
        hideTime = Date.now() + 1750;
      }
      if (card.effect.skip) {
        t.skipTurn = true;
        // 暂停卡牌：需要等暂停结束后再消失
        // 设置较长时间，实际消失会在skipTurn结束时处理
        hideTime = Date.now() + 300000; // 5分钟，足以等待暂停结束
      }
      if (card.effect.restart) {
        t.pos = -1;
        t.lap = 0;
        // 重启卡牌：走完后显示1秒
        hideTime = Date.now() + 1750;
      }

      // 显示卡牌emoji
      newCardEffectDisplay[tid] = {
        emoji: card.pattern || "⚡",
        hideTime,
      };
    });

    setPlayers(newPlayers);
    setCardEffectDisplay(newCardEffectDisplay);
    setPickingTargetFor(null);
    setShowCardDrawer(false);
    setHasUsedCard(true);

    // 如果是对自己使用移动卡牌，播放移动动画
    if (card.target === "SELF" && card.effect.move) {
      animatePieceMove(turn, () => {
        setIsMoving(false);
      });
    }
  };

  const handleRollDice = () => {
    if (isRolling || isMoving) return;
    if (players[turn].skipTurn) {
      addLog(`Player ${turn + 1} skipped (turn frozen)`);
      setPlayers((prev) =>
        prev.map((p, i) => (i === turn ? { ...p, skipTurn: false } : p)),
      );
      // 清除暂停结束玩家的emoji，并在1秒后消失
      const newCardEffectDisplay = { ...cardEffectDisplay };
      if (newCardEffectDisplay[turn]) {
        newCardEffectDisplay[turn].hideTime = Date.now() + 1000;
        setCardEffectDisplay(newCardEffectDisplay);
      }
      setTurn((turn + 1) % numPlayers);
      setHasUsedCard(false);
      return;
    }
    setIsRolling(true);
    if ((window as any).gsap) {
      // 1. First spin wildly
      (window as any).gsap.to(diceRef.current, {
        rotationX: "random(720, 1080)",
        rotationY: "random(720, 1080)",
        duration: 1,
        ease: "power2.in",
        onComplete: () => {
          // 2. Determine value
          const val = Math.floor(Math.random() * 6) + 1;
          setDiceValue(val);
          addLog(`Player ${turn + 1} rolled ${val}`);

          // 3. Settle on the correct face
          // Map value to face rotation
          // 1: front (0,0), 2: right (0,-90), 3: back (0,180), 4: left (0,90), 5: top (-90,0), 6: bottom (90,0)
          const targets: Record<number, { x: number; y: number }> = {
            1: { x: 0, y: 0 },
            2: { x: 0, y: -90 },
            3: { x: 0, y: 180 },
            4: { x: 0, y: 90 },
            5: { x: -90, y: 0 },
            6: { x: 90, y: 0 },
          };

          const target = targets[val];
          const currentX = (window as any).gsap.getProperty(
            diceRef.current,
            "rotationX",
          );
          const currentY = (window as any).gsap.getProperty(
            diceRef.current,
            "rotationY",
          );

          // Calculate nearest multiple of 360 to keep spinning in same direction
          const nextX = Math.round(currentX / 360) * 360 + target.x;
          const nextY = Math.round(currentY / 360) * 360 + target.y;

          (window as any).gsap.to(diceRef.current, {
            rotationX: nextX,
            rotationY: nextY,
            duration: 1,
            ease: "back.out(1.7)",
            onComplete: () => {
              setIsRolling(false);
              handleMove(val);
            },
          });
        },
      });
    }
  };

  /**
   * 掷骰子移动处理
   * 此函数用于正常的掷骰子移动流程
   * 移动后会检查是否落在 CUSTOM 格子上，触发事件
   * 移动完成后切换到下一个玩家回合
   * @param steps - 移动步数
   * @param isEventMove - 是否是事件触发的移动（当前未使用此参数）
   */
  const handleMove = (steps: number, isEventMove: boolean = false) => {
    setIsMoving(true);
    const p = players[turn];

    // 使用统一的位置计算函数
    const { pos: finalPos, lap: newLap } = calculateNewPosition(p, steps);

    animatePieceMove(turn, () => {
      setPlayers((prev) => {
        const next = [...prev];
        const curr = {
          ...next[turn],
          pos: finalPos,
          lap: newLap,
        };
        if (curr.lap >= lapsToWin) {
          setWinner(curr);
          setPhase("win");
          return next;
        }
        // 碰撞检测已移除 - 玩家可以共享相同位置
        next[turn] = curr;
        return next;
      });
      addLog(`Player ${turn + 1} moved to pos ${finalPos} (lap ${newLap})`);
      if (finalPos !== -1 && boardTiles[finalPos]?.id === "CUSTOM") {
        setTimeout(() => {
          const event =
            eventDatabase[Math.floor(Math.random() * eventDatabase.length)];
          addLog(`Player ${turn + 1} triggered: ${event.text}`);
          setActiveEvent({
            id: event.id,
            text: event.text,
            type: event.type as "MOVE" | "SKIP" | "NONE" | "RESTART_LAP",
            val: event.val,
            target: event.target || "SELF",
            color: event.color || "#8b5cf6",
          });
          setPhase("event");
        }, 400);
      } else {
        setIsMoving(false);
        setTurn((turn + 1) % numPlayers);
        setHasUsedCard(false);
      }
    });
  };

  const animatePieceMove = (idx: number, cb: () => void) => {
    if ((window as any).gsap) {
      const timeline = (window as any).gsap.timeline({
        onComplete: cb,
      });
      timeline
        .to(piecesRef.current[idx], {
          scale: 1.5,
          y: -20,
          duration: 0.3,
          ease: "power2.out",
        })
        .to(piecesRef.current[idx], {
          scale: 1,
          y: 0,
          duration: 0.3,
          ease: "bounce.out",
        });
    } else cb();
  };

  const addLog = (msg: string) =>
    setLogs((prev) => [msg, ...prev].slice(0, 50));

  // ==================== 位置和效果计算逻辑 ====================

  /**
   * 统一的位置计算函数
   * 计算玩家移动指定步数后的新位置和圈数
   * @param player - 玩家对象
   * @param steps - 移动步数（正数前进，负数后退）
   * @returns 新的位置和圈数
   */
  const calculateNewPosition = (
    player: Player,
    steps: number,
  ): { pos: number; lap: number } => {
    let totalDistance;

    if (player.pos === -1) {
      // 如果还没进入棋盘，从起点开始
      totalDistance = steps > 1 ? steps - 1 : 0;
    } else {
      // 玩家当前已经走过的距离
      const currentDistance =
        player.lap * totalSteps +
        ((player.pos - player.startPos + totalSteps) % totalSteps);
      totalDistance = currentDistance + steps;
      // 确保不会倒退到起点之前
      if (totalDistance < 0) totalDistance = 0;
    }

    // 根据总距离计算新的圈数和位置
    const newLap = Math.floor(totalDistance / totalSteps);
    const distanceInCurrentLap = totalDistance % totalSteps;
    const newPos = (player.startPos + distanceInCurrentLap) % totalSteps;

    return { pos: newPos, lap: newLap };
  };

  // 编辑器组件已移到独立文件中

  // --- 4. 主渲染 ---

  return (
    <div
      className="fixed inset-0 text-white font-sans overflow-hidden select-none"
      style={{
        backgroundColor:
          backgroundSettings.type === "color"
            ? backgroundSettings.value
            : undefined,
        backgroundImage:
          backgroundSettings.type === "image"
            ? `url(${backgroundSettings.value})`
            : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
      {/* 背景遮罩层 */}
      {backgroundSettings.type === "image" && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5, 5, 16, 0.3) 0%, rgba(5, 5, 16, 0.7) 100%)",
          }}
        />
      )}

      {backgroundSettings.type === "color" && (
        <>
          <div className="space-background" />
          <div className="stars" />
          <div className="nebula animate-pulse" />
        </>
      )}

      <header className="absolute top-0 w-full z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {phase !== "setup" && (
            <button
              onClick={() => setShowExitConfirm(true)}
              className="glass-btn w-10 h-10 rounded-xl flex items-center justify-center text-cyan-400 hover:text-white hover:scale-110 active:scale-95">
              <Home size={20} />
            </button>
          )}
          <h1 className="text-xl font-black italic bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 uppercase tracking-wide whitespace-nowrap flex-shrink-0 min-w-fit">
            Hyper Ludo
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {phase === "playing" && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors pointer-events-auto">
              <ScrollText size={16} />
            </button>
          )}
          <div className="relative group">
            <button className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <Globe size={16} />
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-black/90 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              {(["zh", "en", "ja", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                    language === lang ? "bg-white/20 text-cyan-400" : ""
                  }`}>
                  {lang === "zh"
                    ? "中文"
                    : lang === "en"
                      ? "English"
                      : lang === "ja"
                        ? "日本語"
                        : "Français"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center">
        {phase === "setup" && (
          <GameSetup
            numPlayers={numPlayers}
            lapsToWin={lapsToWin}
            cardCount={cardDatabase.length}
            eventCount={eventDatabase.length}
            onNumPlayersChange={setNumPlayers}
            onLapsToWinChange={setLapsToWin}
            onEditCards={() => setPhase("config_cards")}
            onEditEvents={() => setPhase("config_events")}
            onOpenSettings={() => setPhase("settings")}
            onManageConfig={() => setPhase("config_manager")}
            onStartGame={startGame}
            t={t}
          />
        )}

        {phase === "config_cards" && (
          <CardEditor
            cards={cardDatabase}
            onSave={(cards) => {
              setCardDatabase(cards);
              localStorage.setItem("party_ludo_cards", JSON.stringify(cards));
              setPhase("setup");
            }}
            onCancel={() => setPhase("setup")}
            t={t}
          />
        )}
        {phase === "config_events" && (
          <EventEditor
            events={eventDatabase}
            onSave={(events) => {
              setEventDatabase(events);
              localStorage.setItem("party_ludo_events", JSON.stringify(events));
              setPhase("setup");
            }}
            onCancel={() => setPhase("setup")}
            t={t}
          />
        )}

        {phase === "config_manager" && (
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col animate-fade-in overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/60 flex-shrink-0">
              <h2 className="text-xl font-bold">配置导入导出</h2>
              <button
                onClick={() => setPhase("setup")}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <ConfigManager
                  cards={cardDatabase}
                  events={eventDatabase}
                  onLoadCards={(cards) => {
                    setCardDatabase(cards);
                    localStorage.setItem(
                      "party_ludo_cards",
                      JSON.stringify(cards),
                    );
                  }}
                  onLoadEvents={(events) => {
                    setEventDatabase(events);
                    localStorage.setItem(
                      "party_ludo_events",
                      JSON.stringify(events),
                    );
                  }}
                  t={t}
                />
              </div>
            </div>
          </div>
        )}

        {phase === "settings" && (
          <GameSettings
            onSave={() => setPhase("setup")}
            onCancel={() => setPhase("setup")}
            t={t}
          />
        )}

        {phase === "playing" && (
          <div className="w-full h-full flex flex-col items-center justify-center px-4 relative">
            <div className="absolute top-16 left-0 right-0 z-40">
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-8 px-4 snap-x snap-mandatory">
                {players.map((p, i) => {
                  const isTurn = i === turn;
                  const progress =
                    lapsToWin > 0 ? (p.lap / lapsToWin) * 100 : 0;

                  return (
                    <div
                      key={i}
                      className={`relative p-3 rounded-2xl border transition-all duration-500 flex flex-col items-center min-w-[110px] max-w-[110px] shrink-0 backdrop-blur-xl snap-center
                      ${
                        isTurn
                          ? "bg-white/10 border-white/30 scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)] z-10"
                          : "bg-black/40 border-white/5 opacity-60 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: isTurn
                          ? p.color.hex
                          : "rgba(255,255,255,0.1)",
                        boxShadow: isTurn
                          ? `0 0 15px ${p.color.hex}40`
                          : "none",
                      }}>
                      {isTurn && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                          <div className="animate-bounce">
                            <div
                              className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]"
                              style={{ borderTopColor: p.color.hex }}></div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-2 w-full">
                        <div
                          className="w-10 h-10 rounded-full shadow-lg relative overflow-hidden flex items-center justify-center shrink-0 border-2 text-xl"
                          style={{
                            borderColor: p.color.hex,
                            backgroundColor: `${p.color.hex}20`,
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

                        <div className="flex flex-col min-w-0 flex-1 items-start">
                          <div className="text-xs font-bold text-gray-200 truncate leading-none mb-1">
                            {t.player} {i + 1}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono leading-none">
                            {p.lap}/{lapsToWin} {t.circle}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out relative"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            background: p.color.hex,
                          }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative w-full max-w-[min(95vw,450px)] md:max-w-[min(85vw,650px)] lg:max-w-[min(80vh,700px)] aspect-square">
              <svg
                viewBox="0 0 800 800"
                className="w-full h-full drop-shadow-2xl overflow-visible filter drop-shadow-[0_0_30px_rgba(5,217,232,0.1)]">
                <defs>
                  <filter
                    id="glow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%">
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
                  r="300"
                  fill="none"
                  stroke="rgba(255,255,255,0.02)"
                  strokeWidth="1"
                  strokeDasharray="10 20"
                  className="animate-[spin_60s_linear_infinite]"
                />
                <circle
                  cx="400"
                  cy="400"
                  r="350"
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
                  r="260"
                  fill="none"
                  stroke="url(#trackGradient)"
                  strokeWidth="60"
                  className="backdrop-blur-sm"
                />
                <circle
                  cx="400"
                  cy="400"
                  r="230"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <circle
                  cx="400"
                  cy="400"
                  r="290"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />

                {trackCoords.map((pos, i) => {
                  const tile = boardTiles[i];
                  const startPIdx =
                    i % (totalSteps / numPlayers) === 0
                      ? i / (totalSteps / numPlayers)
                      : -1;
                  const isCustom = tile?.id === "CUSTOM";
                  const isStart = startPIdx >= 0;

                  let fill = "rgba(255,255,255,0.25)";
                  let stroke = "none";
                  let radius = 3;
                  let filter = "";

                  if (isStart) {
                    fill = COLORS[startPIdx].hex;
                    radius = 8;
                    filter = "url(#glow)";
                  } else if (isCustom) {
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

              {players.map((p, i) => {
                let x, y;
                if (p.pos === -1) {
                  const node =
                    trackCoords[Math.floor(totalSteps / numPlayers) * i];
                  const angle = Math.atan2(
                    node.y - center.y,
                    node.x - center.x,
                  );
                  x = node.x + Math.cos(angle) * 50;
                  y = node.y + Math.sin(angle) * 50;
                } else {
                  const node = trackCoords[p.pos % totalSteps];
                  x = node.x;
                  y = node.y;
                }
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      if (piecesRef.current) {
                        piecesRef.current[i] = el;
                      }
                    }}
                    className="absolute w-10 h-10 -ml-5 -mt-5 flex items-center justify-center transition-all duration-500 ease-out"
                    style={{
                      left: `${(x / 800) * 100}%`,
                      top: `${(y / 800) * 100}%`,
                      zIndex: i === turn ? 50 + i : 30 + i,
                    }}>
                    <div
                      className="w-full h-full rounded-full border-2 border-white flex items-center justify-center bg-black/50 relative"
                      style={{
                        borderColor: p.color.hex,
                        boxShadow:
                          i === turn ? `0 0 15px ${p.color.hex}` : "none",
                      }}>
                      {/* 卡牌效果emoji */}
                      {cardEffectDisplay[i] &&
                        cardEffectDisplay[i].hideTime > Date.now() && (
                          <div
                            className="absolute text-sm font-bold"
                            style={{
                              animation: `cardEffectFade 1s ease-out forwards`,
                            }}>
                            {cardEffectDisplay[i].emoji}
                          </div>
                        )}
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                );
              })}

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
                      <CreditCard
                        size={12}
                        className="sm:size-[14px] text-purple-300"
                      />
                      {t.game.handCards}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showCardDrawer && (
              <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end animate-fade-in"
                onClick={() => setShowCardDrawer(false)}>
                <div
                  className="w-full bg-[#0a0a1a] rounded-t-3xl border-t border-white/10 p-6 pt-10 relative"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6 px-2">
                    <h3 className="font-black text-sm tracking-widest flex items-center gap-2 uppercase">
                      <Star size={16} className="text-yellow-400" />{" "}
                      {t.game.handCardsListTitle}
                    </h3>
                    <button
                      onClick={() => setShowCardDrawer(false)}
                      className="text-gray-500 p-1">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 px-2">
                    {players[turn].cards.map((card) => (
                      <div
                        key={card.instanceId}
                        onClick={() => !hasUsedCard && useCard(card)}
                        className={`min-w-[140px] h-44 rounded-xl border-2 p-3 flex flex-col justify-between transition-all active:scale-95 cursor-pointer relative overflow-hidden bg-white/5 border-white/10 hover:border-white/30 shadow-lg ${
                          hasUsedCard
                            ? "opacity-50 grayscale cursor-not-allowed"
                            : ""
                        }`}>
                        <div className="flex justify-between items-start">
                          <span
                            className={`text-[10px] font-black px-1 rounded border ${RARITY_CONFIG[card.rarity].color}`}
                            style={{
                              borderColor: RARITY_CONFIG[card.rarity].color,
                              color: RARITY_CONFIG[card.rarity].color,
                            }}>
                            {card.rarity}
                          </span>
                          <div className="text-2xl">{card.pattern}</div>
                        </div>
                        <div>
                          <div className="text-xs font-black mb-1">
                            {card.name}
                          </div>
                          <div className="text-[9px] text-gray-400 leading-tight">
                            {card.desc}
                          </div>
                        </div>
                        <div className="text-[8px] text-gray-500 flex items-center gap-1 uppercase tracking-tighter">
                          <Target size={8} /> {card.target}
                        </div>
                      </div>
                    ))}
                    {players[turn].cards.length === 0 && (
                      <div className="w-full text-center py-10 text-gray-600 text-xs italic">
                        {t.game.noAvailableCards}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showLogs && (
              <div
                ref={logsContainerRef}
                className="fixed inset-x-4 bottom-12 sm:bottom-24 z-[60] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 animate-slide-up max-h-[15vh] overflow-y-auto custom-scrollbar">
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
            )}
          </div>
        )}

        {phase === "event" && activeEvent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-fade-in text-center">
            <div
              className="w-full max-w-sm rounded-3xl p-8 shadow-2xl relative overflow-hidden border-2"
              style={{
                backgroundColor: "#1a1a2e",
                borderColor: activeEvent.color || "#06b6d4",
              }}>
              <div
                className="absolute inset-0 pointer-events-none opacity-5"
                style={{
                  backgroundColor: activeEvent.color || "#a855f7",
                }}></div>
              <div
                className="inline-block px-3 py-1 text-[10px] font-black tracking-widest rounded-full mb-6 border uppercase italic"
                style={{
                  backgroundColor: `${activeEvent.color || "#06b6d4"}20`,
                  color: activeEvent.color || "#06b6d4",
                  borderColor: `${activeEvent.color || "#06b6d4"}50`,
                }}>
                Event Anomaly
              </div>
              <h2 className="text-2xl font-black mb-8 leading-relaxed text-white">
                {activeEvent.text}
              </h2>
              <button
                onClick={() => {
                  // 确定受影响的玩家索引
                  const getAffectedPlayerIndices = (): number[] => {
                    const target = activeEvent.target || "SELF";
                    if (target === "SELF") {
                      return [turn];
                    } else if (target === "ALL_PLAYERS") {
                      return Array.from({ length: numPlayers }, (_, i) => i);
                    } else if (target === "RANDOM_OTHER") {
                      const others = Array.from(
                        { length: numPlayers },
                        (_, i) => i,
                      ).filter((i) => i !== turn);
                      if (others.length === 0) return [];
                      return [
                        others[Math.floor(Math.random() * others.length)],
                      ];
                    }
                    return [turn];
                  };

                  const affectedIndices = getAffectedPlayerIndices();

                  // 应用事件效果
                  if (activeEvent.type === "MOVE" && activeEvent.val !== 0) {
                    // 移动效果：更新受影响玩家的位置
                    setPlayers((prev) => {
                      const next = [...prev];
                      affectedIndices.forEach((idx) => {
                        const newPosition = calculateNewPosition(
                          next[idx],
                          activeEvent.val,
                        );
                        next[idx] = {
                          ...next[idx],
                          pos: newPosition.pos,
                          lap: newPosition.lap,
                        };
                      });
                      return next;
                    });
                    addLog(
                      `Event: ${affectedIndices.map((i) => `Player ${i + 1}`).join(", ")} moved ${activeEvent.val > 0 ? "+" : ""}${activeEvent.val}`,
                    );
                    // 播放移动动画（只播放当前玩家或第一个受影响玩家）
                    animatePieceMove(affectedIndices[0] ?? turn, () => {
                      setPhase("playing");
                      setTurn((turn + 1) % numPlayers);
                      setIsMoving(false);
                      setActiveEvent(null);
                      setHasUsedCard(false);
                    });
                  } else if (activeEvent.type === "SKIP") {
                    // 暂停效果：设置 skipTurn
                    setPlayers((prev) => {
                      const next = [...prev];
                      affectedIndices.forEach((idx) => {
                        next[idx] = { ...next[idx], skipTurn: true };
                      });
                      return next;
                    });
                    addLog(
                      `Event: ${affectedIndices.map((i) => `Player ${i + 1}`).join(", ")} will skip next turn`,
                    );
                    setPhase("playing");
                    setTurn((turn + 1) % numPlayers);
                    setIsMoving(false);
                    setActiveEvent(null);
                    setHasUsedCard(false);
                  } else if (activeEvent.type === "RESTART_LAP") {
                    // 回到本圈起点
                    setPlayers((prev) => {
                      const next = [...prev];
                      affectedIndices.forEach((idx) => {
                        const currentPlayer = next[idx];
                        // 计算本圈起始位置
                        const lapStartDistance = currentPlayer.lap * totalSteps;
                        const lapStartPos =
                          (currentPlayer.startPos + lapStartDistance) %
                          totalSteps;
                        next[idx] = {
                          ...next[idx],
                          pos: lapStartPos,
                        };
                      });
                      return next;
                    });
                    addLog(
                      `Event: ${affectedIndices.map((i) => `Player ${i + 1}`).join(", ")} returned to lap start`,
                    );
                    // 播放移动动画
                    animatePieceMove(affectedIndices[0] ?? turn, () => {
                      setPhase("playing");
                      setTurn((turn + 1) % numPlayers);
                      setIsMoving(false);
                      setActiveEvent(null);
                      setHasUsedCard(false);
                    });
                  } else {
                    // NONE 类型或其他：无游戏效果
                    addLog(`Event: ${activeEvent.text}`);
                    setPhase("playing");
                    setTurn((turn + 1) % numPlayers);
                    setIsMoving(false);
                    setActiveEvent(null);
                    setHasUsedCard(false);
                  }
                }}
                className="w-full py-4 bg-white text-black font-black rounded-xl active:scale-95 shadow-xl transition-all">
                {t.game.taskComplete}
              </button>
            </div>
          </div>
        )}

        {showExitConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-[280px] bg-[#0f0f1a] border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-4 italic uppercase">
                Abort Mission?
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2 bg-white/5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setPhase("setup");
                    setShowExitConfirm(false);
                  }}
                  className="flex-1 py-2 bg-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-500 transition-colors">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "win" && winner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in text-center p-6 bg-[url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/80"></div>
            <div className="relative glass-panel rounded-3xl p-12 max-w-lg w-full border-t border-yellow-500/30 shadow-[0_0_100px_rgba(234,179,8,0.2)]">
              <div className="animate-float mb-8 inline-block relative">
                <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div>
                <Trophy
                  size={100}
                  className="text-yellow-400 relative drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]"
                />
              </div>

              <h2 className="text-6xl font-black italic mb-4 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm">
                {t.game.victory}
              </h2>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent my-8"></div>

              <p className="text-xl text-gray-300 mb-12 font-light tracking-widest">
                <span
                  style={{
                    color: winner.color.hex,
                    textShadow: `0 0 20px ${winner.color.hex}`,
                  }}
                  className="font-bold text-3xl block mb-2">
                  Pilot P{winner.id + 1}
                </span>{" "}
                Won the Orbit
              </p>

              <button
                onClick={() => setPhase("setup")}
                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-black text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:shadow-[0_0_50px_rgba(234,179,8,0.6)] active:scale-95 transition-all">
                {t.game.restartGame}
              </button>
            </div>
          </div>
        )}

        {/* 目标选择器 */}
        {pickingTargetFor && (
          <TargetSelector
            players={players}
            currentPlayerId={turn}
            targetType={
              pickingTargetFor.target as
                | "PICK_ONE"
                | "RANDOM_OTHER"
                | "ALL_OTHERS"
            }
            onSelect={(targetId) => {
              // 对于手动选择，立即执行效果
              if (pickingTargetFor.target === "PICK_ONE") {
                executeCardEffect(pickingTargetFor, targetId);
              }
            }}
            onComplete={() => {
              // 对于随机和全选，在动画完成后执行效果
              if (pickingTargetFor.target === "RANDOM_OTHER") {
                const others = players.filter((p) => p.id !== turn);
                const randomTarget =
                  others[Math.floor(Math.random() * others.length)];
                executeCardEffect(pickingTargetFor, randomTarget.id);
              } else if (pickingTargetFor.target === "ALL_OTHERS") {
                executeCardEffect(pickingTargetFor);
              }
              setPickingTargetFor(null);
            }}
            t={t}
          />
        )}
      </main>
    </div>
  );
}
