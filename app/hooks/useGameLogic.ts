"use client";

import { useRef, useCallback } from "react";
import { COLORS } from "@/app/constants";
import type { Player, Card, BoardTile, GameEvent } from "@/app/types";

interface UseGameLogicOptions {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  turn: number;
  setTurn: React.Dispatch<React.SetStateAction<number>>;
  numPlayers: number;
  totalSteps: number;
  lapsToWin: number;
  diceCount: number;
  isMoving: boolean;
  isRolling: boolean;
  setIsMoving: (v: boolean) => void;
  setIsRolling: (v: boolean) => void;
  setDiceValue: (v: number) => void;
  setDiceResults: (v: number[]) => void;
  boardTiles: BoardTile[];
  setActiveEvent: (e: GameEvent | null) => void;
  setPhase: (p: any) => void;
  isMultiplayer: boolean;
  roomId: string | null;
  currentPlayerIndex: number | null;
  hasUsedCard: boolean;
  setHasUsedCard: (v: boolean) => void;
  cardEffectDisplay: Record<number, { emoji: string; hideTime: number }>;
  setCardEffectDisplay: React.Dispatch<React.SetStateAction<Record<number, { emoji: string; hideTime: number }>>>;
  eventCounts: Record<number, Record<number, number>>;
  setEventCounts: React.Dispatch<React.SetStateAction<Record<number, Record<number, number>>>>;
  pickingTargetFor: Card | null;
  setPickingTargetFor: (c: Card | null) => void;
  setShowCardDrawer: (v: boolean) => void;
  diceRefs: React.RefObject<(HTMLDivElement | null)[]>;
  piecesRef: React.RefObject<(HTMLDivElement | null)[]>;
  // Multiplayer actions
  roomRollDice: (count: number) => Promise<any>;
  roomMovePlayer: (pos: number, lap: number, targetIdx?: number) => Promise<any>;
  roomSetWinner: (idx: number) => Promise<any>;
  roomUseCard: (payload: any) => Promise<any>;
  roomTriggerEvent: (event: any) => Promise<any>;
  endPlayerTurn: () => Promise<any>;
  // Game state from server
  gameState: any;
  // User data
  cardDatabase: any[];
  eventDatabase: any[];
  addLogFn?: (msg: string) => void;
}

export function useGameLogic(opts: UseGameLogicOptions) {
  const {
    players, setPlayers, turn, setTurn, numPlayers, totalSteps, lapsToWin,
    diceCount, isMoving, isRolling, setIsMoving, setIsRolling,
    setDiceValue, setDiceResults, boardTiles, setActiveEvent, setPhase,
    isMultiplayer, roomId, currentPlayerIndex, hasUsedCard, setHasUsedCard,
    cardEffectDisplay, setCardEffectDisplay, eventCounts, setEventCounts,
    pickingTargetFor, setPickingTargetFor, setShowCardDrawer,
    diceRefs, piecesRef,
    roomRollDice, roomMovePlayer, roomSetWinner, roomUseCard, roomTriggerEvent, endPlayerTurn,
    gameState, cardDatabase, eventDatabase,
  } = opts;

  const logsRef = useRef<string[]>([]);
  const setLogsRef = useRef<((fn: (prev: string[]) => string[]) => void) | null>(null);

  const addLog = useCallback((msg: string) => {
    if (opts.addLogFn) opts.addLogFn(msg);
  }, [opts.addLogFn]);

  // ── Position Calculation ─────────────────────────────────
  const calculateNewPosition = useCallback((
    player: Player,
    steps: number,
  ): { pos: number; lap: number } => {
    let totalDistance: number;
    if (player.pos === -1) {
      totalDistance = Math.max(0, steps);
    } else {
      const currentDistance =
        player.lap * totalSteps +
        ((player.pos - player.startPos + totalSteps) % totalSteps);
      totalDistance = currentDistance + steps;
      if (totalDistance < 0) totalDistance = 0;
    }
    const newLap = Math.floor(totalDistance / totalSteps);
    const distanceInCurrentLap = totalDistance % totalSteps;
    const newPos = (player.startPos + distanceInCurrentLap) % totalSteps;
    return { pos: newPos, lap: newLap };
  }, [totalSteps]);

  // ── Animate Piece ────────────────────────────────────────
  const animatePieceMove = useCallback((idx: number, cb: () => void) => {
    if ((window as any).gsap) {
      const tl = (window as any).gsap.timeline({ onComplete: cb });
      tl.to(piecesRef.current[idx], { scale: 1.5, y: -20, duration: 0.3, ease: "power2.out" })
        .to(piecesRef.current[idx], { scale: 1, y: 0, duration: 0.3, ease: "bounce.out" });
    } else cb();
  }, [piecesRef]);

  // ── Animate Dice ─────────────────────────────────────────
  const animateDiceRoll = useCallback((results: number[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!(window as any).gsap) { resolve(); return; }
      const promises = diceRefs.current.slice(0, diceCount).map((el, idx) =>
        new Promise<void>((res) => {
          if (!el) { res(); return; }
          (window as any).gsap.to(el, {
            rotationX: "random(720, 1080)", rotationY: "random(720, 1080)",
            duration: 1, ease: "power2.in", delay: idx * 0.1,
            onComplete: () => {
              const faceMap: Record<number, { x: number; y: number }> = {
                1: { x: 0, y: 0 }, 2: { x: 0, y: -90 }, 3: { x: 0, y: 180 },
                4: { x: 0, y: 90 }, 5: { x: -90, y: 0 }, 6: { x: 90, y: 0 },
              };
              const face = faceMap[results[idx]];
              const cx = (window as any).gsap.getProperty(el, "rotationX");
              const cy = (window as any).gsap.getProperty(el, "rotationY");
              (window as any).gsap.to(el, {
                rotationX: Math.round(cx / 360) * 360 + face.x,
                rotationY: Math.round(cy / 360) * 360 + face.y,
                duration: 1, ease: "back.out(1.7)", onComplete: res,
              });
            },
          });
        })
      );
      Promise.all(promises).then(() => resolve());
    });
  }, [diceRefs, diceCount]);

  // ── Handle Move ──────────────────────────────────────────
  const handleMove = useCallback((steps: number) => {
    setIsMoving(true);
    const p = players[turn];
    const { pos: finalPos, lap: newLap } = calculateNewPosition(p, steps);

    const syncPositionToServer = async () => {
      if (isMultiplayer && roomId) {
        await roomMovePlayer(finalPos, newLap).catch(console.error);
      }
    };

    animatePieceMove(turn, () => {
      let gameOver = false;
      setPlayers((prev) => {
        const next = [...prev];
        const curr = { ...next[turn], pos: finalPos, lap: newLap };
        if (curr.lap >= lapsToWin && !curr.finished) {
          const finishedCount = next.filter((p) => p.finished).length;
          curr.finished = true;
          curr.finishRank = finishedCount + 1;
          next[turn] = curr;
          const unfinished = next.filter((p) => !p.finished);
          if (unfinished.length <= 1) {
            if (unfinished.length === 1) {
              const lastIdx = next.findIndex((p) => !p.finished);
              next[lastIdx] = { ...next[lastIdx], finishRank: next.length };
            }
            gameOver = true;
            setPhase("win");
          }
        } else {
          next[turn] = curr;
        }
        return next;
      });
      addLog(`Player ${turn + 1} moved to pos ${finalPos} (lap ${newLap})`);
      if (gameOver && isMultiplayer && roomId) {
        roomMovePlayer(finalPos, newLap).catch(console.error);
        roomSetWinner(turn).catch(console.error);
      } else {
        syncPositionToServer();
      }
      if (gameOver) return;

      const isCustomTile = finalPos !== -1 && boardTiles[finalPos]?.id === "CUSTOM";
      if (isCustomTile) {
        setTimeout(async () => {
          const currentProgress = (newLap / lapsToWin) * 100;
          const eventDb =
            isMultiplayer && gameState?.event_database?.length
              ? gameState.event_database
              : eventDatabase;
          let allowed = eventDb.filter((evt: any) => {
            if (!evt.progressRange) return true;
            return currentProgress >= evt.progressRange.min && currentProgress <= evt.progressRange.max;
          });
          allowed = allowed.filter((evt: any) => {
            if (evt.limitPerPlayer === undefined) return true;
            return (eventCounts[turn]?.[evt.id] || 0) < evt.limitPerPlayer;
          });
          if (allowed.length === 0) {
            setIsMoving(false);
            if (isMultiplayer && roomId) {
              try { const d = await endPlayerTurn(); setTurn(d.turn); }
              catch { setTurn((turn + 1) % numPlayers); }
            } else { setTurn((turn + 1) % numPlayers); }
            setHasUsedCard(false);
            return;
          }
          const event = allowed[Math.floor(Math.random() * allowed.length)];
          addLog(`Player ${turn + 1} triggered: ${event.text}`);
          setEventCounts((prev) => {
            const nc = { ...prev };
            if (!nc[turn]) nc[turn] = {};
            nc[turn][event.id] = (nc[turn][event.id] || 0) + 1;
            return nc;
          });
          setActiveEvent({ id: event.id, text: event.text, type: event.type, val: event.val, target: event.target || "SELF", color: event.color || "#8b5cf6" });
          setPhase("event");
          if (isMultiplayer && roomId) {
            roomTriggerEvent({ id: event.id, text: event.text, type: event.type, val: event.val, target: event.target || "SELF", color: event.color || "#8b5cf6" })
              .catch(console.error);
          }
        }, 400);
      } else {
        setTimeout(async () => {
          setIsMoving(false);
          if (isMultiplayer && roomId) {
            try { const d = await endPlayerTurn(); setTurn(d.turn); }
            catch { setTurn((turn + 1) % numPlayers); }
          } else { setTurn((turn + 1) % numPlayers); }
          setHasUsedCard(false);
        }, 400);
      }
    });
  }, [players, turn, calculateNewPosition, animatePieceMove, setPlayers, setPhase, setIsMoving, setTurn, setHasUsedCard, setActiveEvent, setEventCounts, lapsToWin, totalSteps, numPlayers, boardTiles, isMultiplayer, roomId, roomMovePlayer, roomSetWinner, roomTriggerEvent, endPlayerTurn, gameState, eventDatabase, eventCounts, addLog]);

  // ── Roll Dice ────────────────────────────────────────────
  const handleRollDice = useCallback(async () => {
    if (isRolling || isMoving) return;
    if (isMultiplayer) {
      if (currentPlayerIndex === null) { addLog("❌ 游戏状态异常"); return; }
      if (currentPlayerIndex !== turn) { addLog(`⏳ 等待玩家 ${turn + 1} 掷骰子...`); return; }
      const cp = players[turn];
      if (cp && (cp.skipTurn || cp.finished)) {
        if (cp.skipTurn) {
          addLog(`⏭️  玩家 ${turn + 1} 被跳过`);
          setPlayers((prev) => prev.map((p, i) => i === turn ? { ...p, skipTurn: false } : p));
          const ncd = { ...cardEffectDisplay };
          if (ncd[turn]) { ncd[turn].hideTime = Date.now() + 1000; setCardEffectDisplay(ncd); }
        }
        setTurn((turn + 1) % numPlayers);
        setHasUsedCard(false);
        return;
      }
    }
    setIsRolling(true);
    setDiceResults([]);
    try {
      if (isMultiplayer && roomId) {
        const { diceValue: v, diceResults: r } = await roomRollDice(diceCount);
        if ((window as any).gsap && r?.length > 0) {
          await animateDiceRoll(r);
          setDiceValue(v);
          setDiceResults(r);
          addLog(`Player ${turn + 1} rolled ${diceCount === 1 ? v : `${r.join(", ")} (总计: ${v})`}`);
          setIsRolling(false);
          handleMove(v);
        } else { setIsRolling(false); }
      } else {
        const results = Array.from({ length: diceCount }).map(() => Math.floor(Math.random() * 6) + 1);
        const total = results.reduce((a, b) => a + b, 0);
        if ((window as any).gsap) {
          await animateDiceRoll(results);
          setDiceValue(total);
          setDiceResults(results);
          addLog(`Player ${turn + 1} rolled ${diceCount === 1 ? total : `${results.join(", ")} (总计: ${total})`}`);
          setIsRolling(false);
          handleMove(total);
        }
      }
    } catch (e) {
      console.error("❌ 掷骰子失败:", e);
      addLog("❌ 掷骰子失败，请重试");
      setIsRolling(false);
    }
  }, [isRolling, isMoving, isMultiplayer, currentPlayerIndex, turn, players, numPlayers, diceCount, roomId, roomRollDice, animateDiceRoll, handleMove, setDiceValue, setDiceResults, setIsRolling, setPlayers, setTurn, setHasUsedCard, cardEffectDisplay, setCardEffectDisplay, addLog]);

  // ── Card Effect ──────────────────────────────────────────
  const executeCardEffect = useCallback((card: Card, targetId: number | null = null) => {
    const newPlayers = [...players];
    const cp = newPlayers[turn];
    cp.cards = cp.cards.filter((c) => c.instanceId !== card.instanceId);
    addLog(`Player ${turn + 1} used: ${card.name} - ${card.desc}`);

    let targets: number[] = [];
    if (card.target === "SELF") targets = [turn];
    else if (card.target === "ALL_OTHERS") targets = newPlayers.map((p) => p.id).filter((id) => id !== turn);
    else if (card.target === "RANDOM_OTHER") {
      const others = newPlayers.map((p) => p.id).filter((id) => id !== turn);
      targets = [others[Math.floor(Math.random() * others.length)]];
    } else if (card.target === "PICK_ONE") targets = targetId !== null ? [targetId] : [];

    const ncd = { ...cardEffectDisplay };
    const playerUpdates: Array<{ playerIndex: number; position?: number; lap?: number; skipTurn?: boolean }> = [];

    targets.forEach((tid) => {
      const t = newPlayers[tid];
      let hideTime = Date.now() + 1000;
      const upd: { playerIndex: number; position?: number; lap?: number; skipTurn?: boolean } = { playerIndex: tid };
      if (card.effect.move) {
        const np = calculateNewPosition(t, card.effect.move);
        t.pos = np.pos; t.lap = np.lap;
        upd.position = np.pos; upd.lap = np.lap;
        hideTime = Date.now() + 1750;
      }
      if (card.effect.skip) { t.skipTurn = true; upd.skipTurn = true; hideTime = Date.now() + 300000; }
      if (card.effect.restart) { t.pos = -1; t.lap = 0; upd.position = -1; upd.lap = 0; hideTime = Date.now() + 1750; }
      playerUpdates.push(upd);
      ncd[tid] = { emoji: card.pattern || "⚡", hideTime };
    });

    setPlayers(newPlayers);
    setCardEffectDisplay(ncd);
    setPickingTargetFor(null);
    setShowCardDrawer(false);
    setHasUsedCard(true);
    if (isMultiplayer && roomId) roomUseCard({ card, playerUpdates }).catch(console.error);
    if (card.target === "SELF" && card.effect.move) animatePieceMove(turn, () => setIsMoving(false));
  }, [players, turn, calculateNewPosition, animatePieceMove, setPlayers, setCardEffectDisplay, setPickingTargetFor, setShowCardDrawer, setHasUsedCard, setIsMoving, cardEffectDisplay, isMultiplayer, roomId, roomUseCard, addLog]);

  const useCard = useCallback((card: Card) => {
    if (isMoving || isRolling) return;
    if (hasUsedCard) { addLog("System: Energy depletion. Only 1 ability per cycle."); return; }
    if (card.target === "PICK_ONE" || card.target === "RANDOM_OTHER" || card.target === "ALL_OTHERS") {
      setPickingTargetFor(card);
      setShowCardDrawer(false);
      return;
    }
    executeCardEffect(card);
  }, [isMoving, isRolling, hasUsedCard, executeCardEffect, setPickingTargetFor, setShowCardDrawer, addLog]);

  return { calculateNewPosition, animatePieceMove, handleRollDice, handleMove, executeCardEffect, useCard };
}
