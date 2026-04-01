"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Globe, LogOut } from "lucide-react";
import type { Language } from "@/app/locales";
import { getTranslation } from "@/app/locales";
import { useLanguage } from "@/app/hooks/useLanguage";
import { useDeviceShake } from "@/app/hooks/useDeviceShake";
import { useAuth } from "@/app/hooks/useAuth";
import { useUserData } from "@/app/hooks/useUserData";
import { useRoom } from "@/app/hooks/useRoomWs";
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

  const [guestMode, setGuestMode] = useState(
    process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "true",
  );

  // 开发/游客模式下，每个浏览器会话生成唯一 userId（持久化到 localStorage）
  const [guestUserId] = useState<string>(() => {
    const genUUID = () => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      // HTTP 下 crypto.randomUUID 不可用，手动生成
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    };
    if (typeof window === "undefined") return genUUID();
    const stored = localStorage.getItem("guest-user-id");
    if (stored) return stored;
    const newId = genUUID();
    localStorage.setItem("guest-user-id", newId);
    return newId;
  });
  const effectiveUserId = user?.id || (guestMode ? guestUserId : null);

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
    movePlayer: roomMovePlayer,
    triggerEvent: roomTriggerEvent,
    useCard: roomUseCard,
    setWinner: roomSetWinner,
    subscribe,
    loadRoom,
    endPlayerTurn,
  } = useRoom(effectiveUserId);

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
  // 建立 Realtime 订阅 - 仅在 roomId 变化时
  useEffect(() => {
    if (!roomId) {
      // 🔧 当离开多人游戏房间时，重置多人游戏状态
      setIsMultiplayer(false);
      setCurrentPlayerIndex(null);
      return;
    }

    setIsMultiplayer(true);

    // 建立 Realtime 订阅
    const unsubscribe = subscribe(roomId);

    return () => {
      unsubscribe();
      // 🔧 取消订阅时重置多人游戏状态
      setIsMultiplayer(false);
      setCurrentPlayerIndex(null);
    };
  }, [roomId, subscribe]);

  // 计算当前玩家索引 - 单独的 effect，在 roomPlayers 变化时运行
  useEffect(() => {
    if (!roomId || !room || roomPlayers.length === 0 || !effectiveUserId)
      return;

    const myIndex = roomPlayers.findIndex((p) => p.user_id === effectiveUserId);
    setCurrentPlayerIndex(myIndex >= 0 ? myIndex : null);
  }, [roomPlayers, effectiveUserId, room, roomId]);

  // 检测房间状态变化：如果房间状态变为 "playing" 且客户端还在 lobby，自动启动游戏
  // 直接使用 WS hook 已同步到的 room/roomPlayers/gameState，不再调 HTTP API
  useEffect(() => {
    if (!room || !roomId || phase !== "room_lobby") return;
    if (room.state !== "playing") return;
    // 等待 players_update 和 game_update 也到达（WS 顺序广播，通常几毫秒内）
    if (!roomPlayers.length || !gameState) return;

    // 初始化游戏配置（来自 WS room 对象）
    setNumPlayers(room.num_players);
    setDiceCount(room.dice_count);
    setLapsToWin(room.laps_to_win);
    setInitialCards(room.initial_cards);
    setEventDensity(room.event_density);

    // 初始化玩家数据（来自 WS roomPlayers）
    const gamePlayers: Player[] = [...roomPlayers]
      .sort((a, b) => a.player_index - b.player_index)
      .map((rp) => ({
        id: rp.player_index,
        color: COLORS[rp.color_index % COLORS.length],
        pos: -1,
        lap: 0,
        startPos: 0,
        shield: false,
        skipTurn: false,
        cards: Array.from({ length: room.initial_cards || initialCards }).map(() => {
          const baseCard =
            userData.cardDatabase[
              Math.floor(Math.random() * userData.cardDatabase.length)
            ];
          return {
            id: baseCard.id,
            rarity: baseCard.rarity as "NR" | "R" | "SR" | "SSR",
            name: baseCard.name,
            desc: baseCard.desc,
            pattern: baseCard.pattern,
            target: baseCard.target,
            effect: baseCard.effect,
          } as Card;
        }),
        avatar: rp.avatar || ["🔵", "🟣", "🟡", "🟢"][rp.player_index % 4],
        name: rp.player_name || `Player ${rp.player_index + 1}`,
      }));
    setPlayers(gamePlayers);
    setTurn(0);

    // 设置 boardTiles（来自 WS gameState.board_tiles）
    if (gameState.board_tiles?.length > 0) {
      setBoardTiles(gameState.board_tiles);
    }

    // 切换到游戏阶段
    setPhase("playing");
  }, [room?.state, roomId, phase, roomPlayers, gameState, userData, initialCards]);

  // 多人游戏：当 gameState 变化时，同步本地状态
  useEffect(() => {
    if (!gameState || !isMultiplayer) return;

    // 更新 turn
    if (gameState.turn !== undefined && gameState.turn !== turn) {
      setTurn(gameState.turn);
    }

    // 更新掷骰结果
    if (gameState.dice_results && gameState.dice_results.length > 0) {
      if (
        JSON.stringify(gameState.dice_results) !== JSON.stringify(diceResults)
      ) {
        setDiceResults(gameState.dice_results);
      }
    }

    if (
      gameState.dice_value !== undefined &&
      gameState.dice_value !== diceValue
    ) {
      setDiceValue(gameState.dice_value);
    }

    // 如果掷骰完成，更新 phase 为 "moving"
    if (gameState.phase === "moving" && !isMoving && !isRolling) {
      addLog(
        `Player ${gameState.turn + 1} rolled ${gameState.dice_results?.length === 1 ? gameState.dice_value : gameState.dice_results?.join(", ") + ` (总计: ${gameState.dice_value})`}`,
      );
    }

    // 同步事件：非当前回合玩家收到事件弹窗
    if (gameState.phase === "event" && gameState.active_event) {
      // 非操作玩家：显示事件弹窗（操作玩家已在本地触发）
      if (currentPlayerIndex !== gameState.turn) {
        setActiveEvent({
          id: gameState.active_event.id,
          text: gameState.active_event.text,
          type: gameState.active_event.type,
          val: gameState.active_event.val,
          target: gameState.active_event.target || "SELF",
          color: gameState.active_event.color || "#8b5cf6",
        });
        setPhase("event");
      }
    }

    // 事件已清除：重置事件弹窗
    if (
      gameState.phase === "playing" &&
      !gameState.active_event &&
      activeEvent
    ) {
      setActiveEvent(null);
      if (phase === "event") setPhase("playing");
    }

    // 胜利同步：非操作玩家收到胜利通知
    if (
      gameState.phase === "win" &&
      gameState.active_card?.winnerIndex !== undefined
    ) {
      const wIdx = gameState.active_card.winnerIndex;
      setPlayers((prev) => {
        const winner = prev[wIdx];
        if (winner) {
          setWinner(winner);
          setPhase("win");
        }
        return prev;
      });
    }
  }, [gameState, isMultiplayer, isMoving, isRolling]);

  // 多人游戏：同步房间玩家数据到游戏显示（用于左侧玩家部分）
  useEffect(() => {
    if (!isMultiplayer || !roomPlayers || roomPlayers.length === 0) return;

    // 仅在游戏进行中时同步玩家信息
    if (phase === "playing" || phase === "event") {
      // 把 roomPlayers（来自 Realtime）同步到本地 players 状态（位置、圈数、skipTurn）
      // 仅同步非当前操作玩家（操作方自己已由本地状态管理动画）
      setPlayers((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        roomPlayers.forEach((rp) => {
          const idx = rp.player_index;
          if (idx < 0 || idx >= next.length) return;
          // 跳过当前正在移动的玩家（由本地动画驱动，避免冲突）
          if (isMoving && idx === turn) return;
          const existingPlayer = next[idx];
          if (!existingPlayer) return;
          next[idx] = {
            ...existingPlayer,
            pos: rp.position ?? existingPlayer.pos,
            lap: rp.lap ?? existingPlayer.lap,
            skipTurn: rp.skip_turn ?? existingPlayer.skipTurn,
            cards:
              rp.cards && rp.cards.length > 0 ? rp.cards : existingPlayer.cards,
          };
        });
        return next;
      });
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

    // 🔧 确保重置多人游戏状态（离线模式不使用多人游戏逻辑）
    setIsMultiplayer(false);
    setCurrentPlayerIndex(null);
    setRoomId(null);

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

    // 收集需要广播的玩家更新（用于多人游戏同步）
    const playerUpdates: Array<{
      playerIndex: number;
      position?: number;
      lap?: number;
      skipTurn?: boolean;
    }> = [];

    targets.forEach((tid) => {
      const t = newPlayers[tid];
      let hideTime = Date.now() + 1000; // 默认1秒显示
      const update: {
        playerIndex: number;
        position?: number;
        lap?: number;
        skipTurn?: boolean;
      } = { playerIndex: tid };

      if (card.effect.move) {
        // 使用统一的位置计算函数
        const newPosition = calculateNewPosition(t, card.effect.move);
        t.pos = newPosition.pos;
        t.lap = newPosition.lap;
        update.position = newPosition.pos;
        update.lap = newPosition.lap;
        // 移动卡牌：走完后显示1秒（约750ms的动画+250ms延迟）
        hideTime = Date.now() + 1750;
      }
      if (card.effect.skip) {
        t.skipTurn = true;
        update.skipTurn = true;
        // 暂停卡牌：需要等暂停结束后再消失
        // 设置较长时间，实际消失会在skipTurn结束时处理
        hideTime = Date.now() + 300000; // 5分钟，足以等待暂停结束
      }
      if (card.effect.restart) {
        t.pos = -1;
        t.lap = 0;
        update.position = -1;
        update.lap = 0;
        // 重启卡牌：走完后显示1秒
        hideTime = Date.now() + 1750;
      }

      playerUpdates.push(update);

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

    // 多人游戏：同步卡牌效果到服务器
    if (isMultiplayer && roomId) {
      roomUseCard({ card, playerUpdates }).catch((err) =>
        console.error("❌ useCard同步失败:", err),
      );
    }

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
      if (currentPlayerIndex === null) {
        addLog("❌ 游戏状态异常，请重新开始游戏");
        return;
      }

      if (currentPlayerIndex !== turn) {
        addLog(`⏳ 等待玩家 ${turn + 1} 掷骰子...`);
        return;
      }

      // 🔧 检查玩家是否被跳过（因为卡牌或事件效果）
      const currentPlayer = players[turn];
      if (currentPlayer && currentPlayer.skipTurn) {
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
      // 多人游戏：通过 WebSocket 生成掷骰结果
      if (isMultiplayer && roomId) {
        try {
          const { diceValue: apiDiceValue, diceResults: apiDiceResults } =
            await roomRollDice(diceCount);

          if (
            (window as any).gsap &&
            apiDiceResults &&
            apiDiceResults.length > 0
          ) {
            await animateDiceRoll(apiDiceResults);
            setDiceValue(apiDiceValue);
            setDiceResults(apiDiceResults);

            const resultString =
              diceCount === 1
                ? `${apiDiceValue}`
                : `${apiDiceResults.join(", ")} (总计: ${apiDiceValue})`;
            addLog(`Player ${turn + 1} rolled ${resultString}`);

            setIsRolling(false);
            handleMove(apiDiceValue);
          } else {
            console.error("❌ 无法播放动画:", {
              hasGsap: !!(window as any).gsap,
              apiDiceResults,
            });
            setIsRolling(false);
          }
        } catch (err) {
          console.error("❌ rollDice WS异常:", err);
          addLog("❌ 掷骰子失败，请重试");
          setIsRolling(false);
        }
      } else {
        // 单人游戏：本地生成掷骰结果
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
    setIsMoving(true);
    const p = players[turn];

    // 使用统一的位置计算函数
    const { pos: finalPos, lap: newLap } = calculateNewPosition(p, steps);

    // 多人游戏：先同步位置到服务器，其他玩家通过 WS broadcast 收到更新
    const syncPositionToServer = async () => {
      if (isMultiplayer && roomId) {
        try {
          await roomMovePlayer(finalPos, newLap);
        } catch (err) {
          console.error("❌ movePlayer同步失败:", err);
        }
      }
    };

    animatePieceMove(turn, () => {
      let hasWon = false;
      setPlayers((prev) => {
        const next = [...prev];
        const curr = {
          ...next[turn],
          pos: finalPos,
          lap: newLap,
        };
        if (curr.lap >= lapsToWin) {
          hasWon = true;
          setWinner(curr);
          setPhase("win");
          return next;
        }
        // 碰撞检测已移除 - 玩家可以共享相同位置
        next[turn] = curr;
        return next;
      });
      addLog(`Player ${turn + 1} moved to pos ${finalPos} (lap ${newLap})`);
      // 同步位置到服务器（包含胜利状态）
      if (hasWon && isMultiplayer && roomId) {
        roomMovePlayer(finalPos, newLap).catch(console.error);
        roomSetWinner(turn).catch(console.error);
      } else {
        syncPositionToServer();
      }
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
            if (isMultiplayer && roomId) {
              try {
                const data = await endPlayerTurn();
                setTurn(data.turn);
                setHasUsedCard(false);
              } catch (err) {
                console.error("❌ endPlayerTurn 异常:", err);
                setTurn((turn + 1) % numPlayers);
                setHasUsedCard(false);
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

          // 多人游戏：广播事件到服务器让其他玩家看到弹窗
          if (isMultiplayer && roomId) {
            roomTriggerEvent({
              id: event.id,
              text: event.text,
              type: event.type,
              val: event.val,
              target: event.target || "SELF",
              color: event.color || "#8b5cf6",
            }).catch((err) => console.error("❌ triggerEvent同步失败:", err));
          }
        }, 400);
      } else {
        setTimeout(async () => {
          setIsMoving(false);
          if (isMultiplayer && roomId) {
            try {
              const data = await endPlayerTurn();
              setTurn(data.turn);
              setHasUsedCard(false);
            } catch (err) {
              console.error("❌ endPlayerTurn 异常:", err);
              setTurn((turn + 1) % numPlayers);
              setHasUsedCard(false);
            }
          } else {
            setTurn((turn + 1) % numPlayers);
            setHasUsedCard(false);
          }
        }, 400);
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
          (!effectiveUserId ? (
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
              createRoom={createRoom}
              joinRoom={joinRoom}
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
            userId={effectiveUserId}
            onStartGame={async () => {
              try {
                // 通过 WS 通知服务端开始游戏；服务端会广播 room_update / players_update / game_update
                // useEffect (room?.state) 收到广播后自动初始化游戏状态，无需在此处理
                await startMultiplayerGame();
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
          isCurrentPlayerTurn={!isMultiplayer || currentPlayerIndex === turn}
          applyEventEffect={async () => {
            if (!activeEvent) return;

            // 多人游戏：非回合玩家直接关闭本地弹窗，等待回合玩家处理后服务端广播结果
            if (isMultiplayer && currentPlayerIndex !== turn) {
              setActiveEvent(null);
              return;
            }

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

            // 多人游戏：事件效果后同步位置并推进回合的辅助函数
            const syncEventAndEndTurn = async (
              updatedPositions: Array<{
                playerIndex: number;
                position?: number;
                lap?: number;
                skipTurn?: boolean;
              }>,
            ) => {
              if (!isMultiplayer || !roomId) return;
              // 批量同步受影响玩家位置（通过 WS）
              for (const upd of updatedPositions) {
                if (upd.position !== undefined || upd.skipTurn !== undefined) {
                  await roomMovePlayer(
                    upd.position ?? players[upd.playerIndex]?.pos ?? 0,
                    upd.lap ?? players[upd.playerIndex]?.lap ?? 0,
                    upd.playerIndex,
                  ).catch(console.error);
                }
              }
              // 清除事件并推进回合
              try {
                const data = await endPlayerTurn();
                setTurn(data.turn);
                setHasUsedCard(false);
              } catch {
                setTurn((turn + 1) % numPlayers);
                setHasUsedCard(false);
              }
            };

            // 应用事件效果
            if (activeEvent.type === "MOVE" && activeEvent.val !== 0) {
              // 移动效果：更新受影响玩家的位置
              // 为避免多玩家依赖问题，对每个玩家都基于原始状态计算
              const newPositions: Array<{
                playerIndex: number;
                position: number;
                lap: number;
              }> = [];
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
                  newPositions.push({
                    playerIndex: idx,
                    position: newPosition.pos,
                    lap: newPosition.lap,
                  });
                });
                return next;
              });
              addLog(
                `Event: ${affectedIndices.map((i) => `Player ${i + 1}`).join(", ")} moved ${activeEvent.val > 0 ? "+" : ""}${activeEvent.val}`,
              );
              // 播放移动动画（只播放当前玩家或第一个受影响玩家）
              animatePieceMove(affectedIndices[0] ?? turn, async () => {
                setPhase("playing");
                if (!isMultiplayer || !roomId) {
                  setTurn((turn + 1) % numPlayers);
                } else {
                  await syncEventAndEndTurn(newPositions);
                }
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
              if (!isMultiplayer || !roomId) {
                setTurn((turn + 1) % numPlayers);
              } else {
                await syncEventAndEndTurn(
                  affectedIndices.map((idx) => ({
                    playerIndex: idx,
                    skipTurn: true,
                  })),
                );
              }
              setIsMoving(false);
              setActiveEvent(null);
              setHasUsedCard(false);
            } else if (activeEvent.type === "RESTART_LAP") {
              // 回到本圈起点
              const newPositions: Array<{
                playerIndex: number;
                position: number;
                lap: number;
              }> = [];
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
                  newPositions.push({
                    playerIndex: idx,
                    position: lapStartPos,
                    lap: currentPlayer.lap,
                  });
                });
                return next;
              });
              addLog(
                `Event: ${affectedIndices.map((i) => `Player ${i + 1}`).join(", ")} returned to lap start`,
              );
              // 播放移动动画
              animatePieceMove(affectedIndices[0] ?? turn, async () => {
                setPhase("playing");
                if (!isMultiplayer || !roomId) {
                  setTurn((turn + 1) % numPlayers);
                } else {
                  await syncEventAndEndTurn(newPositions);
                }
                setIsMoving(false);
                setActiveEvent(null);
                setHasUsedCard(false);
              });
            } else {
              // NONE 类型或其他：无游戏效果
              addLog(`Event: ${activeEvent.text}`);
              setPhase("playing");
              if (!isMultiplayer || !roomId) {
                setTurn((turn + 1) % numPlayers);
              } else {
                await syncEventAndEndTurn([]);
              }
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
                    // 🔧 退出游戏时清理多人游戏状态
                    setRoomId(null);
                    setIsMultiplayer(false);
                    setCurrentPlayerIndex(null);
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
