"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Globe, LogOut, Home, AlertTriangle, ScrollText } from "lucide-react";
import type { Language } from "@/app/locales";
import { useLanguage } from "@/app/hooks/useLanguage";
import { useDeviceShake } from "@/app/hooks/useDeviceShake";
import { useAuth } from "@/app/hooks/useAuth";
import { useUserData } from "@/app/hooks/useUserData";
import { useRoom } from "@/app/hooks/useRoomAbly";
import { useGameLogic } from "@/app/hooks/useGameLogic";
import { useMultiplayerSync } from "@/app/hooks/useMultiplayerSync";
import GameBoard from "@/app/components/GameBoard";
import GamePieces from "@/app/components/GamePieces";
import DiceControl from "@/app/components/DiceControl";
import PlayerSidebar from "@/app/components/PlayerSidebar";
import GameInfoSidebar from "@/app/components/GameInfoSidebar";
import CardDrawer from "@/app/components/CardDrawer";
import GameLog from "@/app/components/GameLog";
import EventHandler from "@/app/components/EventHandler";
import WinScreen from "@/app/components/WinScreen";
import GamePhaseViews from "@/app/components/GamePhaseViews";
import TargetSelector from "@/app/components/TargetSelector";
import { COLORS, DEFAULT_CARD_DB, DEFAULT_EVENT_DB } from "@/app/constants";
import type {
  GamePhase,
  Card,
  GameEvent,
  Player,
  BoardTile,
  Position,
} from "@/app/types";

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

  const {
    user,
    loading: authLoading,
    error: authError,
    signInWithGoogle,
    signInWithGithub,
    signOut,
  } = useAuth();
  const [guestMode, setGuestMode] = useState(
    process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "true",
  );

  const [guestUserId] = useState<string>(() => {
    const gen = () =>
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });
    if (typeof window === "undefined") return gen();
    const stored = localStorage.getItem("guest-user-id");
    if (stored) return stored;
    const id = gen();
    localStorage.setItem("guest-user-id", id);
    return id;
  });

  const effectiveUserId = user?.id || (guestMode ? guestUserId : null);
  const userData = useUserData(
    user?.id || null,
    DEFAULT_CARD_DB,
    DEFAULT_EVENT_DB,
  );

  const {
    room,
    players: roomPlayers,
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
    endPlayerTurn,
    reconnectPrompt,
    acceptReconnect,
    declineReconnect,
  } = useRoom(effectiveUserId);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number | null>(
    null,
  );
  const [isPC, setIsPC] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("auth");
  const [numPlayers, setNumPlayers] = useState(4);
  const [diceCount, setDiceCount] = useState(1);
  const [lapsToWin, setLapsToWin] = useState(3);
  const [initialCards, setInitialCards] = useState(5);
  const [eventDensity, setEventDensity] = useState(40);
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [hasUsedCard, setHasUsedCard] = useState(false);
  const [showCardDrawer, setShowCardDrawer] = useState(false);
  const [pickingTargetFor, setPickingTargetFor] = useState<Card | null>(null);
  const [boardTiles, setBoardTiles] = useState<BoardTile[]>([]);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [eventCounts, setEventCounts] = useState<
    Record<number, Record<number, number>>
  >({});
  const [cardEffectDisplay, setCardEffectDisplay] = useState<
    Record<number, { emoji: string; hideTime: number }>
  >({});

  const diceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const piecesRef = useRef<(HTMLDivElement | null)[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) =>
    setLogs((prev) => [msg, ...prev].slice(0, 50));

  const totalSteps = useMemo(() => numPlayers * 10, [numPlayers]);
  const center = { x: 400, y: 400 };
  const trackRadius = isPC ? 320 : 310;
  const decorativeRadius1 = isPC ? 360 : 350;
  const decorativeRadius2 = isPC ? 410 : 390;
  const trackWidth = isPC ? 70 : 60;
  const innerRadius = isPC ? 285 : 275;
  const innerRadius2 = isPC ? 290 : 280;

  const trackCoords = useMemo(() => {
    const coords = [];
    for (let i = 0; i < totalSteps; i++)
      coords.push(
        getPolygonalPos(i, totalSteps, trackRadius, center.x, center.y),
      );
    return coords;
  }, [totalSteps, trackRadius]);

  useMultiplayerSync({
    roomId,
    room,
    roomPlayers,
    gameState,
    isMultiplayer,
    phase,
    turn,
    diceValue,
    diceResults,
    lapsToWin,
    activeEvent,
    currentPlayerIndex,
    isMoving,
    isRolling,
    effectiveUserId,
    initialCards,
    setIsMultiplayer,
    setCurrentPlayerIndex,
    setNumPlayers,
    setDiceCount,
    setLapsToWin,
    setInitialCards,
    setEventDensity,
    setPlayers,
    setTurn,
    setBoardTiles,
    setPhase,
    setDiceValue,
    setDiceResults,
    setActiveEvent,
    subscribe,
    addLog,
    cardDatabase: userData.cardDatabase,
    userData,
  });

  const {
    calculateNewPosition,
    animatePieceMove,
    handleRollDice,
    executeCardEffect,
    useCard,
  } = useGameLogic({
    players,
    setPlayers,
    turn,
    setTurn,
    numPlayers,
    totalSteps,
    lapsToWin,
    diceCount,
    isMoving,
    isRolling,
    setIsMoving,
    setIsRolling,
    setDiceValue,
    setDiceResults,
    boardTiles,
    setActiveEvent,
    setPhase,
    isMultiplayer,
    roomId,
    currentPlayerIndex,
    hasUsedCard,
    setHasUsedCard,
    cardEffectDisplay,
    setCardEffectDisplay,
    eventCounts,
    setEventCounts,
    pickingTargetFor,
    setPickingTargetFor,
    setShowCardDrawer,
    diceRefs,
    piecesRef,
    roomRollDice,
    roomMovePlayer,
    roomSetWinner,
    roomUseCard,
    roomTriggerEvent,
    endPlayerTurn,
    gameState,
    cardDatabase: userData.cardDatabase,
    eventDatabase: userData.eventDatabase,
    addLogFn: addLog,
  });

  const startGame = () => {
    if (userData.eventDatabase.length === 0) return alert(t.game.noEventsAlert);
    setIsMultiplayer(false);
    setCurrentPlayerIndex(null);
    setRoomId(null);
    setEventCounts({});
    const tiles: BoardTile[] = Array.from({ length: totalSteps }).map(
      (_, i) => {
        if (i % (totalSteps / numPlayers) < 2) return { id: "SAFE" as const };
        return Math.random() * 100 < eventDensity
          ? { id: "CUSTOM" as const }
          : { id: "SAFE" as const };
      },
    );
    setBoardTiles(tiles);
    const savedNames = JSON.parse(
      localStorage.getItem("hyper_ludo_player_names") || "[]",
    );
    setPlayers(
      Array.from({ length: numPlayers }).map((_, i) => ({
        id: i,
        color: COLORS[i],
        pos: -1,
        lap: 0,
        startPos: Math.floor(totalSteps / numPlayers) * i,
        shield: false,
        skipTurn: false,
        avatar: userData.playerAvatars[i] || "👤",
        name: savedNames[i] || `${t.player} ${i + 1}`,
        cards: Array.from({ length: initialCards }).map(() => {
          const base =
            userData.cardDatabase[
              Math.floor(Math.random() * userData.cardDatabase.length)
            ];
          return {
            id: base.id,
            rarity: base.rarity as any,
            name: base.name,
            desc: base.desc,
            pattern: base.pattern,
            target: base.target as any,
            effect: { ...base.effect },
            instanceId: Math.random(),
          };
        }),
      })),
    );
    setPhase("playing");
    setTurn(0);
    setHasUsedCard(false);
    addLog(t.game.battleInitialized);
  };

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (user || guestMode) {
        if (phase === "auth") setPhase("setup");
      } else {
        if (phase !== "auth") setPhase("auth");
      }
    }
  }, [user, guestMode, authLoading, phase]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        phase === "playing" &&
        !isRolling &&
        !isMoving &&
        !pickingTargetFor &&
        !e.repeat
      ) {
        e.preventDefault();
        handleRollDice();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, isRolling, isMoving, pickingTargetFor, handleRollDice]);

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).gsap) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  useEffect(() => {
    if (logsContainerRef.current && showLogs)
      setTimeout(() => {
        if (logsContainerRef.current)
          logsContainerRef.current.scrollTop =
            logsContainerRef.current.scrollHeight;
      }, 0);
  }, [showLogs]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCardEffectDisplay((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((k) => {
          if (next[+k].hideTime <= now) {
            delete next[+k];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-language-menu]"))
        setIsLanguageMenuOpen(false);
    };
    if (isLanguageMenuOpen) {
      document.addEventListener("click", h);
      return () => document.removeEventListener("click", h);
    }
  }, [isLanguageMenuOpen]);

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
      if (phase === "playing" && !isRolling && !isMoving && !pickingTargetFor)
        handleRollDice();
    },
  });

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
      {userData.backgroundType === "image" && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5,5,16,0.3) 0%, rgba(5,5,16,0.7) 100%)",
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
          {phase !== "setup" && phase !== "win" && (
            <button
              onClick={() => {
                if (phase === "playing" || phase === "paused") {
                  setShowExitConfirm(true);
                } else {
                  // Non-game phases: go directly back to setup
                  if (isMultiplayer) leaveRoom();
                  setRoomId(null);
                  setIsMultiplayer(false);
                  setCurrentPlayerIndex(null);
                  setPhase("setup");
                }
              }}
              className="glass-btn w-10 h-10 rounded-xl flex items-center justify-center text-cyan-400 hover:text-white hover:scale-110 active:scale-95">
              <Home size={20} />
            </button>
          )}
          <h1 className="text-xl font-black italic bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 uppercase tracking-wide whitespace-nowrap">
            Hyper Ludo
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {phase === "playing" && (
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
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
              className={`absolute right-0 mt-2 w-32 bg-black/90 border border-white/10 rounded-lg shadow-xl transition-all duration-200 z-50 ${isLanguageMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}>
              {(["zh", "en", "ja", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setIsLanguageMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${language === lang ? "bg-white/20 text-cyan-400" : ""}`}>
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
          {(user || guestMode) &&
            phase !== "auth" &&
            phase !== "playing" &&
            phase !== "paused" &&
            phase !== "win" && (
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
                    if (isMultiplayer) leaveRoom();
                    if (user) await signOut();
                    setGuestMode(false);
                    setPhase("auth");
                  }}
                  className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 hover:bg-red-500/20 transition-colors"
                  title={t.auth.signOut}>
                  <LogOut size={16} />
                </button>
              </div>
            )}
        </div>
      </header>

      <main className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-[100px] sm:pt-20">
        <GamePhaseViews
          phase={phase}
          setPhase={setPhase}
          signInWithGoogle={signInWithGoogle}
          signInWithGithub={signInWithGithub}
          setGuestMode={setGuestMode}
          authError={authError}
          t={t}
          numPlayers={numPlayers}
          diceCount={diceCount}
          lapsToWin={lapsToWin}
          eventDensity={eventDensity}
          setNumPlayers={setNumPlayers}
          setDiceCount={setDiceCount}
          setLapsToWin={setLapsToWin}
          setEventDensity={setEventDensity}
          startGame={startGame}
          effectiveUserId={effectiveUserId}
          roomId={roomId}
          setRoomId={setRoomId}
          createRoom={createRoom}
          joinRoom={joinRoom}
          leaveRoom={leaveRoom}
          startMultiplayerGame={startMultiplayerGame}
          initialCards={initialCards}
          cardDatabase={userData.cardDatabase}
          eventDatabase={userData.eventDatabase}
          userData={userData}
        />

        {phase === "playing" && (
          <div
            className={`w-full h-full flex ${isPC ? "flex-row items-start justify-center gap-16 px-8 pt-20" : "flex-col items-center justify-start px-4"} relative overflow-y-auto`}>
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

        <EventHandler
          activeEvent={activeEvent}
          isCurrentPlayerTurn={!isMultiplayer || currentPlayerIndex === turn}
          players={players}
          turn={turn}
          numPlayers={numPlayers}
          totalSteps={totalSteps}
          isMultiplayer={isMultiplayer}
          roomId={roomId}
          setPlayers={setPlayers}
          setTurn={setTurn}
          setPhase={setPhase}
          setIsMoving={setIsMoving}
          setActiveEvent={setActiveEvent}
          setHasUsedCard={setHasUsedCard}
          calculateNewPosition={calculateNewPosition}
          animatePieceMove={animatePieceMove}
          addLog={addLog}
          roomMovePlayer={roomMovePlayer}
          endPlayerTurn={endPlayerTurn}
          t={t.game}
        />

        {showExitConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-[280px] bg-[#0f0f1a] border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-4 italic uppercase">
                {t.game.abort}
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2 bg-white/5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                  {t.game.cancel}
                </button>
                <button
                  onClick={async () => {
                    if (isMultiplayer) leaveRoom();
                    setRoomId(null);
                    setIsMultiplayer(false);
                    setCurrentPlayerIndex(null);
                    setPhase("setup");
                    setShowExitConfirm(false);
                  }}
                  className="flex-1 py-2 bg-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-500 transition-colors">
                  {t.game.confirmBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game paused overlay */}
        {phase === "paused" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="w-full max-w-[320px] bg-[#0f0f1a] border border-yellow-500/30 rounded-2xl p-8 text-center shadow-2xl">
              <div className="text-4xl mb-4">⏸️</div>
              <h3 className="text-xl font-black italic uppercase text-yellow-400 mb-2">
                {t.game.gamePaused}
              </h3>
              <p className="text-sm text-gray-400 mb-1">
                {t.game.playerDisconnected}
              </p>
              {room?.paused_until && (
                <p className="text-xs text-gray-500">
                  {t.game.autoResume.replace(
                    "{time}",
                    new Date(room.paused_until).toLocaleTimeString(),
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reconnect prompt (shown after page reload) */}
        {reconnectPrompt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-[320px] bg-[#0f0f1a] border border-cyan-500/30 rounded-2xl p-6 text-center shadow-2xl">
              <div className="text-4xl mb-4">🔌</div>
              <h3 className="text-lg font-black italic uppercase text-cyan-400 mb-2">
                Rejoin Game?
              </h3>
              <p className="text-sm text-gray-300 mb-1">
                Room{" "}
                <span className="text-cyan-400 font-bold">
                  {reconnectPrompt.roomCode}
                </span>
              </p>
              <p className="text-xs text-gray-500 mb-5">
                The game is paused waiting for you.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await declineReconnect();
                    setPhase("setup");
                  }}
                  className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                  Leave
                </button>
                <button
                  onClick={async () => {
                    const promptRoomId = reconnectPrompt.roomId;
                    await acceptReconnect();
                    setRoomId(promptRoomId);
                    // Trigger useMultiplayerSync init effect which requires phase === "room_lobby"
                    // to restore players/board and transition to "playing"
                    setPhase("room_lobby");
                  }}
                  className="flex-1 py-2 bg-cyan-600 rounded-lg text-xs font-bold uppercase hover:bg-cyan-500 transition-colors">
                  Reconnect
                </button>
              </div>
            </div>
          </div>
        )}

        <WinScreen
          players={phase === "win" ? players : []}
          onRestart={() => {
            setEventCounts({});
            setLogs([]);
            setPhase(isMultiplayer ? "room_lobby" : "setup");
          }}
          onExitRoom={() => {
            if (isMultiplayer) leaveRoom();
            setRoomId(null);
            setIsMultiplayer(false);
            setCurrentPlayerIndex(null);
            setEventCounts({});
            setLogs([]);
            setPhase("setup");
          }}
          t={t.game}
        />

        {pickingTargetFor && (
          <TargetSelector
            players={players}
            currentPlayerId={turn}
            targetType={pickingTargetFor.target as any}
            onSelect={(targetId) => {
              if (pickingTargetFor.target === "PICK_ONE")
                executeCardEffect(pickingTargetFor, targetId);
            }}
            onComplete={() => {
              if (pickingTargetFor.target === "RANDOM_OTHER") {
                const others = players.filter((p) => p.id !== turn);
                executeCardEffect(
                  pickingTargetFor,
                  others[Math.floor(Math.random() * others.length)].id,
                );
              } else if (pickingTargetFor.target === "ALL_OTHERS")
                executeCardEffect(pickingTargetFor);
              setPickingTargetFor(null);
            }}
            t={t}
          />
        )}
      </main>
    </div>
  );
}
