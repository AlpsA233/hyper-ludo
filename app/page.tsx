"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Globe, LogOut } from "lucide-react";
import type { Language } from "@/app/locales";
import { getTranslation } from "@/app/locales";
import { useLanguage } from "@/app/hooks/useLanguage";
import { useDeviceShake } from "@/app/hooks/useDeviceShake";
import { useAuth } from "@/app/hooks/useAuth";
import { useUserData } from "@/app/hooks/useUserData";
import { useRoom } from "@/app/hooks/useRoom";
import { supabase } from "@/app/lib/supabase";
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
import AuthScreen from "@/app/components/AuthScreen";
import GameSetup from "@/app/components/GameSetup";
import RoomManager from "@/app/components/RoomManager";
import RoomLobby from "@/app/components/RoomLobby";
import CardEditor from "@/app/components/CardEditor";
import EventEditor from "@/app/components/EventEditor";
import GameSettings from "@/app/components/GameSettings";
import ConfigManager from "@/app/components/ConfigManager";
import TargetSelector from "@/app/components/TargetSelector";
import GameBoard from "@/app/components/GameBoard";
import GamePieces from "@/app/components/GamePieces";
import DiceControl from "@/app/components/DiceControl";
import PlayerSidebar from "@/app/components/PlayerSidebar";
import GameInfoSidebar from "@/app/components/GameInfoSidebar";
import CardDrawer from "@/app/components/CardDrawer";
import GameLog from "@/app/components/GameLog";
import EventModal from "@/app/components/EventModal";
import WinScreen from "@/app/components/WinScreen";
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
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);

  // 认证系统
  const {
    user,
    loading: authLoading,
    error: authError,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    continueAsGuest,
  } = useAuth();

  const [guestMode, setGuestMode] = useState(false);

  // 用户数据同步（云端或本地）
  const userData = useUserData(
    user?.id || null,
    DEFAULT_CARD_DB,
    DEFAULT_EVENT_DB,
  );

  // 房间管理（Phase 3.1 + 多人游戏状态同步）
  const {
    room,
    players: roomPlayers,
    isCreator,
    gameState,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame: startMultiplayerGame,
    rollDice: roomRollDice,
    subscribe,
    loadRoom,
    endPlayerTurn,
  } = useRoom(user?.id || null);

  const [roomId, setRoomId] = useState<string | null>(null);

  // 多人游戏状态跟踪
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number | null>(
    null,
  );

  // 检测是否为PC端（屏幕宽度 >= 1024px）
  const [isPC, setIsPC] = useState(false);

  // --- 状态管理 ---
  const [phase, setPhase] = useState<GamePhase>("auth");
  const [numPlayers, setNumPlayers] = useState(4);
  const [diceCount, setDiceCount] = useState(1);
  const [lapsToWin, setLapsToWin] = useState(3);
  const [initialCards, setInitialCards] = useState(5);
  const [eventDensity, setEventDensity] = useState(40); // 事件密度：0-100（百分比）
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gsapLoaded, setGsapLoaded] = useState(false);
  const [hasUsedCard, setHasUsedCard] = useState(false);

  const [showCardDrawer, setShowCardDrawer] = useState(false);
  const [pickingTargetFor, setPickingTargetFor] = useState<Card | null>(null);
  const [boardTiles, setBoardTiles] = useState<BoardTile[]>([]);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // 记录每个玩家触发过的事件及次数: Record<playerIndex, Record<eventId, count>>
  const [eventCounts, setEventCounts] = useState<
    Record<number, Record<number, number>>
  >({});
  // 记录每个玩家头像上显示的卡牌效果emoji和消失时间
  const [cardEffectDisplay, setCardEffectDisplay] = useState<
    Record<number, { emoji: string; hideTime: number }>
  >({});

  const diceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const piecesRef = useRef<(HTMLDivElement | null)[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 摇一摇掷骰子（只在游戏中且没有弹窗时启用）
  const {
    isSupported: isShakeSupported,
    isPermissionGranted: isShakePermissionGranted,
    requestPermission: requestShakePermission,
  } = useDeviceShake({
    threshold: 25,
    cooldown: 1000,
    shakeEndDelay: 300,
    enabled:
      phase === "playing" &&
      !showCardDrawer &&
      !activeEvent &&
      !pickingTargetFor,
    onShake: () => {
      // 只有在游戏进行中、不是滚动中、不是移动中、不是选择目标时才能摇一摇
      if (phase === "playing" && !isRolling && !isMoving && !pickingTargetFor) {
        handleRollDice();
      }
    },
  });

  // 检测PC端
  useEffect(() => {
    const checkIsPC = () => {
      setIsPC(window.innerWidth >= 1024);
    };
    checkIsPC();
    window.addEventListener("resize", checkIsPC);
    return () => window.removeEventListener("resize", checkIsPC);
  }, []);

  // 检测认证状态，决定是否进入游戏
  useEffect(() => {
    if (!authLoading) {
      if (user || guestMode) {
        // 已登录或游客模式，进入游戏设置页面
        if (phase === "auth") {
          setPhase("setup");
        }
      } else {
        // 未登录且未选择游客模式，显示登录页
        if (phase !== "auth") {
          setPhase("auth");
        }
      }
    }
  }, [user, guestMode, authLoading, phase]);

  // 开发者快捷键：PC端按空格键模拟摇一摇掷骰子
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 只在游戏进行中且按下空格键时触发
      if (
        e.code === "Space" &&
        phase === "playing" &&
        !isRolling &&
        !isMoving &&
        !pickingTargetFor &&
        !e.repeat // 防止长按连续触发
      ) {
        e.preventDefault();
        handleRollDice();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [phase, isRolling, isMoving, pickingTargetFor]);

  // 点击外部关闭语言菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-language-menu]")) {
        setIsLanguageMenuOpen(false);
      }
    };
    if (isLanguageMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isLanguageMenuOpen]);

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

  // 多人游戏：订阅房间 Realtime 更新
  useEffect(() => {
    if (!roomId) return;

    console.log("🔌 订阅房间 Realtime:", roomId);
    setIsMultiplayer(true);

    // 建立 Realtime 订阅
    const unsubscribe = subscribe(roomId);

    // 计算当前玩家的索引（基于 roomPlayers 中的顺序）
    if (room && roomPlayers.length > 0 && user?.id) {
      const myIndex = roomPlayers.findIndex((p) => p.user_id === user.id);
      setCurrentPlayerIndex(myIndex >= 0 ? myIndex : null);
      console.log("👤 当前玩家索引:", myIndex);
    }

    return () => {
      console.log("❌ 取消 Realtime 订阅:", roomId);
      unsubscribe();
    };
  }, [roomId, subscribe, room, roomPlayers, user?.id]);

  // 多人游戏：当 gameState 变化时，同步本地状态
  useEffect(() => {
    if (!gameState || !isMultiplayer) return;

    console.log("🎮 Realtime 游戏状态更新:", {
      turn: gameState.turn,
      dice_value: gameState.dice_value,
      dice_results: gameState.dice_results,
      phase: gameState.phase,
    });

    // 更新 turn
    if (gameState.turn !== undefined && gameState.turn !== turn) {
      console.log(`🔄 回合更新: ${turn} → ${gameState.turn}`);
      setTurn(gameState.turn);
    }

    // 更新掷骰结果
    if (gameState.dice_results && gameState.dice_results.length > 0) {
      if (
        JSON.stringify(gameState.dice_results) !== JSON.stringify(diceResults)
      ) {
        console.log("🎲 骰子结果更新:", gameState.dice_results);
        setDiceResults(gameState.dice_results);
      }
    }

    if (
      gameState.dice_value !== undefined &&
      gameState.dice_value !== diceValue
    ) {
      console.log("🎲 骰子总值更新:", gameState.dice_value);
      setDiceValue(gameState.dice_value);
    }

    // 如果掷骰完成，更新 phase 为 "moving"
    if (gameState.phase === "moving" && !isMoving && !isRolling) {
      // 其他玩家看到掷骰结果，不再显示动画
      console.log(
        "📍 其他玩家看到掷骰结果:",
        gameState.dice_value,
        gameState.dice_results,
      );
      addLog(
        `Player ${gameState.turn + 1} rolled ${gameState.dice_results?.length === 1 ? gameState.dice_value : gameState.dice_results?.join(", ") + ` (总计: ${gameState.dice_value})`}`,
      );
    }
  }, [
    gameState,
    isMultiplayer,
    isMoving,
    isRolling,
    turn,
    diceValue,
    diceResults,
  ]);

  // 多人游戏：同步房间玩家数据到游戏显示（用于左侧玩家部分）
  useEffect(() => {
    if (!isMultiplayer || !roomPlayers || roomPlayers.length === 0) return;

    // 仅在游戏进行中时同步玩家信息
    if (phase === "playing") {
      console.log(
        "👥 同步房间玩家数据到游戏显示:",
        roomPlayers.length,
        "位玩家",
      );
      // 这里不更新 players，因为 players 是游戏逻辑中的玩家状态
      // 而是确保 PlayerSidebar 显示的数据来自正确的来源
    }
  }, [roomPlayers, isMultiplayer, phase]);

  const totalSteps = useMemo(() => numPlayers * 10, [numPlayers]);
  const center = { x: 400, y: 400 };

  // 根据PC/移动端设置不同的半径
  const trackRadius = isPC ? 320 : 310;
  const decorativeRadius1 = isPC ? 360 : 350;
  const decorativeRadius2 = isPC ? 410 : 390;
  const trackWidth = isPC ? 70 : 60;
  const innerRadius = isPC ? 285 : 275;
  const innerRadius2 = isPC ? 290 : 280;

  const trackCoords = useMemo(() => {
    const coords = [];
    for (let i = 0; i < totalSteps; i++) {
      coords.push(
        getPolygonalPos(i, totalSteps, trackRadius, center.x, center.y),
      );
    }
    return coords;
  }, [totalSteps, trackRadius, center.x, center.y]);

  // --- 游戏逻辑 ---
  const startGame = () => {
    if (userData.eventDatabase.length === 0) return alert(t.game.noEventsAlert);

    // 重置事件计数
    setEventCounts({});

    const tiles: BoardTile[] = Array.from({ length: totalSteps }).map(
      (_, i) => {
        // 起始点附近保持安全
        if (i % (totalSteps / numPlayers) < 2) {
          return { id: "SAFE" as const };
        }
        // 根据事件密度生成CUSTOM格子
        // eventDensity=0: 没有CUSTOM格子
        // eventDensity=100: 所有非起始格子都是CUSTOM
        return Math.random() * 100 < eventDensity
          ? { id: "CUSTOM" as const }
          : { id: "SAFE" as const };
      },
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
        avatar: userData.playerAvatars[i] || "👤", // 应用玩家头像设置
        name: savedNames[i] || `${t.player} ${i + 1}`, // 应用玩家名称设置
        cards: Array.from({ length: initialCards }).map(() => {
          const baseCard =
            userData.cardDatabase[
              Math.floor(Math.random() * userData.cardDatabase.length)
            ];
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

  const handleRollDice = async () => {
    if (isRolling || isMoving) return;

    // 多人游戏权限检查
    if (isMultiplayer) {
      console.log("🎲 权限检查:", {
        isMultiplayer,
        currentPlayerIndex,
        turn,
        isMyTurn: currentPlayerIndex === turn,
      });

      if (currentPlayerIndex === null) {
        console.warn("❌ 当前玩家索引未初始化");
        addLog("❌ 游戏状态异常，请重新开始游戏");
        return;
      }

      if (currentPlayerIndex !== turn) {
        console.warn(
          "❌ 不是你的回合。当前玩家:",
          turn,
          "你的索引:",
          currentPlayerIndex,
        );
        addLog(`⏳ 等待玩家 ${turn + 1} 掷骰子...`);
        return;
      }

      // 🔧 检查玩家是否被跳过（因为卡牌或事件效果）
      const currentPlayer = players[turn];
      if (currentPlayer && currentPlayer.skipTurn) {
        console.log(`⏭️  玩家 ${turn + 1} 被跳过，进入下一个回合`);
        addLog(`⏭️  玩家 ${turn + 1} 被跳过`);
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
    }

    setIsRolling(true);
    setDiceResults([]); // 清除上一次的掷骰结果

    try {
      // 多人游戏：调用服务器 API 生成掷骰结果
      if (isMultiplayer && room) {
        console.log("🎲 多人模式：调用 rollDice API，diceCount:", diceCount);
        const { diceValue: apiDiceValue, diceResults: apiDiceResults } =
          await roomRollDice(diceCount);
        console.log("📡 服务器掷骰结果:", {
          diceValue: apiDiceValue,
          diceResults: apiDiceResults,
          length: apiDiceResults?.length,
          hasGsap: !!(window as any).gsap,
        });

        // 使用服务器返回的结果显示动画
        if (
          (window as any).gsap &&
          apiDiceResults &&
          apiDiceResults.length > 0
        ) {
          console.log("▶️  开始播放骰子动画...");
          await animateDiceRoll(apiDiceResults);
          setDiceValue(apiDiceValue);
          setDiceResults(apiDiceResults);

          const resultString =
            diceCount === 1
              ? `${apiDiceValue}`
              : `${apiDiceResults.join(", ")} (总计: ${apiDiceValue})`;
          addLog(`Player ${turn + 1} rolled ${resultString}`);

          console.log("✅ 动画完成，调用handleMove移动玩家");
          setIsRolling(false);
          handleMove(apiDiceValue);
        } else {
          console.error("❌ 无法播放动画:", {
            hasGsap: !!(window as any).gsap,
            apiDiceResults,
          });
          setIsRolling(false);
        }
      } else {
        // 单人游戏：本地生成掷骰结果
        console.log("🎲 单人模式：本地生成掷骰结果");
        const results: number[] = Array.from({ length: diceCount }).map(
          () => Math.floor(Math.random() * 6) + 1,
        );
        const totalValue = results.reduce((a, b) => a + b, 0);

        if ((window as any).gsap) {
          await animateDiceRoll(results);
          setDiceValue(totalValue);
          setDiceResults(results);

          const resultString =
            diceCount === 1
              ? `${totalValue}`
              : `${results.join(", ")} (总计: ${totalValue})`;
          addLog(`Player ${turn + 1} rolled ${resultString}`);

          setIsRolling(false);
          handleMove(totalValue);
        }
      }
    } catch (error) {
      console.error("❌ 掷骰子失败:", error);
      addLog("❌ 掷骰子失败，请重试");
      setIsRolling(false);
    }
  };

  // 骰子动画辅助函数
  const animateDiceRoll = (results: number[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!(window as any).gsap) {
        resolve();
        return;
      }

      // 对每个骰子进行动画
      const animationPromises = diceRefs.current
        .slice(0, diceCount)
        .map((diceEl, idx) => {
          return new Promise<void>((innerResolve) => {
            if (!diceEl) {
              innerResolve();
              return;
            }

            // 随机旋转
            (window as any).gsap.to(diceEl, {
              rotationX: "random(720, 1080)",
              rotationY: "random(720, 1080)",
              duration: 1,
              ease: "power2.in",
              delay: idx * 0.1,
              onComplete: () => {
                // 停留在目标值
                const displayValue = results[idx];

                // Map value to face rotation
                const targets: Record<number, { x: number; y: number }> = {
                  1: { x: 0, y: 0 },
                  2: { x: 0, y: -90 },
                  3: { x: 0, y: 180 },
                  4: { x: 0, y: 90 },
                  5: { x: -90, y: 0 },
                  6: { x: 90, y: 0 },
                };

                const target = targets[displayValue];
                const currentX = (window as any).gsap.getProperty(
                  diceEl,
                  "rotationX",
                );
                const currentY = (window as any).gsap.getProperty(
                  diceEl,
                  "rotationY",
                );

                const nextX = Math.round(currentX / 360) * 360 + target.x;
                const nextY = Math.round(currentY / 360) * 360 + target.y;

                (window as any).gsap.to(diceEl, {
                  rotationX: nextX,
                  rotationY: nextY,
                  duration: 1,
                  ease: "back.out(1.7)",
                  onComplete: () => {
                    innerResolve();
                  },
                });
              },
            });
          });
        });

      Promise.all(animationPromises).then(() => {
        resolve();
      });
    });
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
    console.log("🚀 handleMove 被调用:", {
      steps,
      isEventMove,
      turn,
      currentPlayer: players[turn]?.name,
      isMultiplayer,
    });

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
      // 事件触发: 只在CUSTOM格子上触发
      const isCustomTile =
        finalPos !== -1 && boardTiles[finalPos]?.id === "CUSTOM";
      const willTriggerEvent = isCustomTile;

      if (willTriggerEvent) {
        setTimeout(async () => {
          // 计算当前游戏进度百分比 (0-100)
          const totalLaps = lapsToWin;
          const currentProgress = (newLap / totalLaps) * 100;

          // 筛选当前进度允许的事件
          let allowedEvents = userData.eventDatabase.filter((evt) => {
            // 如果progressRange未定义，表示全程都允许
            if (!evt.progressRange) return true;
            // 否则检查当前进度是否在范围内
            return (
              currentProgress >= evt.progressRange.min &&
              currentProgress <= evt.progressRange.max
            );
          });

          // 进一步过滤：检查 limitPerPlayer 限制
          allowedEvents = allowedEvents.filter((evt) => {
            // 如果没有设置限制，或限制为 undefined，则允许
            if (evt.limitPerPlayer === undefined) return true;
            // 获取当前玩家已触发该事件的次数
            const playerEventCount = eventCounts[turn]?.[evt.id] || 0;
            // 如果还未达到限制，允许
            return playerEventCount < evt.limitPerPlayer;
          });

          // 如果没有允许的事件，跳过事件触发
          if (allowedEvents.length === 0) {
            setIsMoving(false);
            // 🔧 多人游戏中，调用API来完成这个回合
            if (isMultiplayer) {
              console.log("📤 调用endPlayerTurn来进入下一个玩家");
              try {
                await endPlayerTurn();
              } catch (err) {
                console.error("❌ endPlayerTurn 失败:", err);
                // fallback: 本地更新
                setTurn((turn + 1) % numPlayers);
              }
            } else {
              setTurn((turn + 1) % numPlayers);
              setHasUsedCard(false);
            }
            return;
          }
          const event =
            allowedEvents[Math.floor(Math.random() * allowedEvents.length)];
          addLog(`Player ${turn + 1} triggered: ${event.text}`);

          // 更新该事件的触发次数
          setEventCounts((prev) => {
            const newCounts = { ...prev };
            if (!newCounts[turn]) {
              newCounts[turn] = {};
            }
            newCounts[turn][event.id] = (newCounts[turn][event.id] || 0) + 1;
            return newCounts;
          });

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
        // 🔧 多人游戏中，调用API来完成这个回合
        if (isMultiplayer) {
          console.log("📤 调用endPlayerTurn来进入下一个玩家");
          try {
            endPlayerTurn().catch((err) => {
              console.error("❌ endPlayerTurn 失败:", err);
              // fallback: 本地更新
              setTurn((turn + 1) % numPlayers);
            });
          } catch (err) {
            console.error("❌ endPlayerTurn 异常:", err);
          }
        } else {
          setTurn((turn + 1) % numPlayers);
          setHasUsedCard(false);
        }
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
      // 如果还没进入棋盘，直接走指定步数
      // 但不允许退出棋盘
      totalDistance = Math.max(0, steps);
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
          userData.backgroundType === "color"
            ? userData.backgroundValue
            : undefined,
        backgroundImage:
          userData.backgroundType === "image"
            ? `url(${userData.backgroundValue})`
            : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
      {/* 背景遮罩层 */}
      {userData.backgroundType === "image" && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5, 5, 16, 0.3) 0%, rgba(5, 5, 16, 0.7) 100%)",
          }}
        />
      )}

      {userData.backgroundType === "color" && (
        <>
          <div className="space-background" />
          <div className="star-layer-1" />
          <div className="star-layer-2" />
          <div className="star-layer-3" />
          <div className="star-layer-4" />
          <div className="star-layer-5" />
          <div className="star-layer-6" />
          <div className="star-layer-7" />
          <div className="star-layer-8" />
          <div className="nebula" />
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
          <div className="relative" data-language-menu>
            <button
              onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
              className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <Globe size={16} />
            </button>
            <div
              className={`absolute right-0 mt-2 w-32 bg-black/90 border border-white/10 rounded-lg shadow-xl transition-all duration-200 z-50 ${
                isLanguageMenuOpen
                  ? "opacity-100 visible"
                  : "opacity-0 invisible"
              }`}>
              {(["zh", "en", "ja", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setIsLanguageMenuOpen(false);
                  }}
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

          {/* 用户信息和登出按钮 */}
          {(user || guestMode) && phase !== "auth" && (
            <div className="flex items-center gap-2">
              {user && (
                <div className="text-xs text-gray-400 hidden sm:block max-w-[120px] truncate">
                  {user.user_metadata?.name ||
                    user.user_metadata?.full_name ||
                    user.email}
                </div>
              )}
              <button
                onClick={async () => {
                  if (user) {
                    await signOut();
                  }
                  setGuestMode(false);
                  setPhase("auth");
                }}
                className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition-colors"
                title={t.auth.signOut}>
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-[100px] sm:pt-20">
        {phase === "auth" && (
          <div className="absolute inset-0 overflow-y-auto">
            <AuthScreen
              onGoogleSignIn={signInWithGoogle}
              onGithubSignIn={signInWithGithub}
              onContinueAsGuest={() => {
                setGuestMode(true);
              }}
              error={authError}
              t={t}
            />
          </div>
        )}

        {/* 房间选择 - 创建或加入房间 */}
        {phase === "room_select" &&
          (!user ? (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
              <div className="bg-black/60 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 animate-fade-in">
                <h3 className="text-xl font-bold">
                  {t.common.loading || "提示"}
                </h3>
                <p className="text-gray-400">
                  {t.common.empty || "多人游戏需要登录"}
                </p>
                <button
                  onClick={() => setPhase("setup")}
                  className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20 transition-all">
                  {t.common.back || "返回"}
                </button>
              </div>
            </div>
          ) : (
            <RoomManager
              userId={user?.id || null}
              numPlayers={numPlayers}
              diceCount={diceCount}
              lapsToWin={lapsToWin}
              initialCards={initialCards}
              eventDensity={eventDensity}
              onRoomCreated={(roomId) => {
                setRoomId(roomId);
                setPhase("room_lobby");
              }}
              onRoomJoined={(roomId) => {
                setRoomId(roomId);
                setPhase("room_lobby");
              }}
              onCancel={() => setPhase("setup")}
              t={t}
            />
          ))}

        {/* 房间大厅 - 等待所有玩家准备好 */}
        {phase === "room_lobby" && roomId && (
          <RoomLobby
            roomId={roomId}
            userId={user?.id || null}
            onStartGame={async () => {
              try {
                // 🔧 关键：在开始游戏前重新加载最新的房间和玩家数据
                // （因为 RoomLobby 可能刚编辑过配置，而页面的状态可能还没有同步）
                let latestRoom = room;
                let latestRoomPlayers = roomPlayers;

                if (roomId) {
                  console.log("🔄 游戏开始前：重新加载最新房间和玩家数据...");
                  try {
                    // 从 API 直接获取最新数据，而不是等待状态更新
                    const { room: newRoom, players: newPlayers } = await fetch(
                      "/api/rooms",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${(await supabase.auth.getSession())?.data.session?.access_token || ""}`,
                        },
                        body: JSON.stringify({
                          action: "getRoomInfo",
                          roomId,
                        }),
                      },
                    ).then((res) => res.json());

                    if (newRoom) {
                      latestRoom = newRoom;
                      latestRoomPlayers = newPlayers || [];
                      console.log("✅ 获取最新房间数据成功:", {
                        num_players: newRoom.num_players,
                        players: newPlayers?.length || 0,
                      });
                    }
                  } catch (err) {
                    console.warn("⚠️ 无法获取最新房间数据，使用页面状态:", err);
                  }
                }

                await startMultiplayerGame();

                // 使用房间配置初始化游戏
                const numPlayersFromRoom =
                  latestRoom?.num_players || numPlayers;
                if (latestRoom) {
                  setNumPlayers(latestRoom.num_players);
                  setDiceCount(latestRoom.dice_count);
                  setLapsToWin(latestRoom.laps_to_win);
                  setInitialCards(latestRoom.initial_cards);
                  setEventDensity(latestRoom.event_density);
                }

                // 初始化游戏玩家数据
                if (latestRoomPlayers && latestRoomPlayers.length > 0) {
                  console.log(
                    "👥 使用房间玩家数据初始化游戏:",
                    latestRoomPlayers.length,
                  );
                  const gamePlayers: Player[] = latestRoomPlayers
                    .sort((a, b) => a.player_index - b.player_index) // 按索引排序确保顺序一致
                    .map((rp) => ({
                      id: rp.player_index,
                      color: COLORS[rp.color_index % COLORS.length],
                      pos: -1,
                      lap: 0,
                      startPos: 0,
                      shield: false,
                      skipTurn: false,
                      cards: [],
                      avatar:
                        rp.avatar ||
                        ["🔵", "🟣", "🟡", "🟢"][rp.player_index % 4],
                      name: rp.player_name || `Player ${rp.player_index + 1}`,
                    }));
                  setPlayers(gamePlayers);

                  // 🔧 关键修复：重新计算当前玩家索引（确保权限检查正确）
                  const myIndex = latestRoomPlayers.findIndex(
                    (p) => p.user_id === user?.id,
                  );
                  console.log("🎮 游戏开始 - 重新计算当前玩家索引:", {
                    myIndex,
                    userId: user?.id,
                    totalPlayers: latestRoomPlayers.length,
                  });
                  setCurrentPlayerIndex(myIndex >= 0 ? myIndex : null);

                  // 确保游戏从玩家0开始
                  setTurn(0);
                } else {
                  // 备用：如果没有房间玩家数据，使用配置的玩家数创建默认玩家
                  console.log(
                    "👥 使用默认玩家数据初始化游戏:",
                    numPlayersFromRoom,
                  );
                  const defaultPlayers: Player[] = Array.from({
                    length: numPlayersFromRoom,
                  }).map((_, i) => ({
                    id: i,
                    color: COLORS[i],
                    pos: -1,
                    lap: 0,
                    startPos: 0,
                    shield: false,
                    skipTurn: false,
                    cards: [],
                    avatar: ["🔵", "🟣", "🟡", "🟢"][i] || "🔵",
                    name: `Player ${i + 1}`,
                  }));
                  setPlayers(defaultPlayers);
                  setTurn(0);
                }

                setPhase("playing");
              } catch (error) {
                console.error("Failed to start game:", error);
              }
            }}
            onLeaveRoom={async () => {
              try {
                await leaveRoom();
                setRoomId(null);
                setPhase("setup");
              } catch (error) {
                console.error("Failed to leave room:", error);
              }
            }}
            onCancel={() => {
              setRoomId(null);
              setPhase("setup");
            }}
            t={t}
          />
        )}

        {phase === "setup" && (
          <GameSetup
            numPlayers={numPlayers}
            diceCount={diceCount}
            lapsToWin={lapsToWin}
            eventDensity={eventDensity}
            onNumPlayersChange={setNumPlayers}
            onDiceCountChange={setDiceCount}
            onLapsToWinChange={setLapsToWin}
            onEventDensityChange={setEventDensity}
            onManageConfig={() => setPhase("library_manager")}
            onUserSettings={() => setPhase("settings")}
            onStartGame={startGame}
            onMultiplayer={() => setPhase("room_select")}
            t={t}
          />
        )}

        {/* 库管理菜单 */}
        {phase === "library_manager" && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-black/80 border border-white/10 rounded-3xl p-8 max-w-sm w-full space-y-4 animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-6 text-center">
                {t.setup.libraryManager}
              </h3>
              <button
                onClick={() => setPhase("config_cards")}
                className="w-full py-3 px-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-sm font-bold hover:bg-cyan-500/20 transition-all">
                {t.setup.editCards}
              </button>
              <button
                onClick={() => setPhase("config_events")}
                className="w-full py-3 px-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-sm font-bold hover:bg-purple-500/20 transition-all">
                {t.setup.editEvents}
              </button>
              <button
                onClick={() => setPhase("config_manager")}
                className="w-full py-3 px-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-sm font-bold hover:bg-orange-500/20 transition-all">
                {t.setup.configImportExport}
              </button>
              <button
                onClick={() => setPhase("setup")}
                className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all mt-4">
                {t.setup.backButton}
              </button>
            </div>
          </div>
        )}

        {phase === "config_cards" && (
          <CardEditor
            cards={userData.cardDatabase}
            onSave={(cards) => {
              userData.saveCards(cards);
              setPhase("setup");
            }}
            onCancel={() => setPhase("setup")}
            t={t}
          />
        )}
        {phase === "config_events" && (
          <EventEditor
            events={userData.eventDatabase}
            onSave={(events) => {
              userData.saveEvents(events);
              setPhase("setup");
            }}
            onCancel={() => setPhase("setup")}
            t={t}
          />
        )}

        {phase === "config_manager" && (
          <div className="fixed top-[110px] left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col animate-fade-in overflow-hidden">
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
                  cards={userData.cardDatabase}
                  events={userData.eventDatabase}
                  onLoadCards={(cards) => userData.saveCards(cards)}
                  onLoadEvents={(events) => userData.saveEvents(events)}
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
            initialBgType={userData.backgroundType}
            initialBgValue={userData.backgroundValue}
            initialAvatars={userData.playerAvatars}
            initialPlayerNames={userData.playerNames}
            onSaveSettings={async (settings) => {
              await userData.saveProfile(settings);
            }}
          />
        )}

        {phase === "playing" && (
          <div
            className={`w-full h-full flex ${isPC ? "flex-row" : "flex-col"} ${isPC ? "items-start justify-center" : "items-center justify-start"} ${isPC ? "gap-16 px-8 pt-20" : "px-4"} relative overflow-y-auto`}>
            {/* Player Sidebar */}
            {isPC ? (
              <PlayerSidebar
                players={players}
                turn={turn}
                lapsToWin={lapsToWin}
                totalSteps={totalSteps}
                isPC={isPC}
                t={t.game}
              />
            ) : (
              <div className="w-full max-h-[30vh] flex-shrink-0 overflow-y-auto overflow-x-hidden">
                <PlayerSidebar
                  players={players}
                  turn={turn}
                  lapsToWin={lapsToWin}
                  totalSteps={totalSteps}
                  isPC={isPC}
                  t={t.game}
                />
              </div>
            )}

            {/* Game Board */}
            <div
              className={`relative flex-shrink-0 ${isPC ? "flex-1 max-w-[min(70vh,750px)] mt-8" : "w-full max-w-[98vw] md:max-w-[min(90vw,720px)]"} aspect-square`}>
              <GameBoard
                trackCoords={trackCoords}
                boardTiles={boardTiles}
                totalSteps={totalSteps}
                numPlayers={numPlayers}
                trackRadius={trackRadius}
                decorativeRadius1={decorativeRadius1}
                decorativeRadius2={decorativeRadius2}
                trackWidth={trackWidth}
                innerRadius={innerRadius}
                innerRadius2={innerRadius2}
                eventDensity={eventDensity}
                center={center}
                isPC={isPC}
              />

              <GamePieces
                players={players}
                trackCoords={trackCoords}
                totalSteps={totalSteps}
                turn={turn}
                isMoving={isMoving}
                cardEffectDisplay={cardEffectDisplay}
                piecesRef={piecesRef}
              />

              <DiceControl
                diceValue={diceValue}
                diceResults={diceResults}
                diceCount={diceCount}
                isRolling={isRolling}
                isMoving={isMoving}
                pickingTargetFor={pickingTargetFor}
                hasUsedCard={hasUsedCard}
                players={players}
                turn={turn}
                diceRefs={diceRefs}
                handleRollDice={handleRollDice}
                setShowCardDrawer={setShowCardDrawer}
                t={t.game}
                isPC={isPC}
                isShakeSupported={isShakeSupported}
                isShakePermissionGranted={isShakePermissionGranted}
                requestShakePermission={requestShakePermission}
                isMultiplayer={isMultiplayer}
                currentPlayerIndex={currentPlayerIndex}
              />
            </div>

            {/* Game Info Sidebar (PC only) */}
            {isPC && (
              <GameInfoSidebar
                turn={turn}
                numPlayers={numPlayers}
                lapsToWin={lapsToWin}
                t={t.game}
              />
            )}

            <CardDrawer
              players={players}
              turn={turn}
              hasUsedCard={hasUsedCard}
              showCardDrawer={showCardDrawer}
              useCard={useCard}
              setShowCardDrawer={setShowCardDrawer}
              t={t.game}
            />

            <GameLog
              logs={logs}
              showLogs={showLogs}
              logsContainerRef={logsContainerRef}
              isPC={isPC}
            />
          </div>
        )}

        <EventModal
          activeEvent={activeEvent}
          applyEventEffect={() => {
            if (!activeEvent) return;
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
                return [others[Math.floor(Math.random() * others.length)]];
              }
              return [turn];
            };

            const affectedIndices = getAffectedPlayerIndices();

            // 应用事件效果
            if (activeEvent.type === "MOVE" && activeEvent.val !== 0) {
              // 移动效果：更新受影响玩家的位置
              // 为避免多玩家依赖问题，对每个玩家都基于原始状态计算
              setPlayers((prev) => {
                const next = [...prev];
                affectedIndices.forEach((idx) => {
                  // 使用原始prev中的玩家状态，而不是已修改的next
                  const newPosition = calculateNewPosition(
                    prev[idx],
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
                    (currentPlayer.startPos + lapStartDistance) % totalSteps;
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
          t={t.game}
        />

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

        <WinScreen
          winner={winner}
          winnerIndex={players.findIndex((p) => p === winner)}
          setPhase={(phase) => {
            setEventCounts({});
            setPhase(phase);
          }}
          t={t.game}
        />

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
