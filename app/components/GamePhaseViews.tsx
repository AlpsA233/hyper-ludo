"use client";

import React from "react";
import { X } from "lucide-react";
import AuthScreen from "@/app/components/AuthScreen";
import GameSetup from "@/app/components/GameSetup";
import RoomManager from "@/app/components/RoomManager";
import RoomLobby from "@/app/components/RoomLobby";
import CardEditor from "@/app/components/CardEditor";
import EventEditor from "@/app/components/EventEditor";
import GameSettings from "@/app/components/GameSettings";
import ConfigManager from "@/app/components/ConfigManager";

interface GamePhaseViewsProps {
  phase: string;
  setPhase: (p: any) => void;
  // Auth
  signInWithGoogle: () => void;
  signInWithGithub: () => void;
  setGuestMode: (v: boolean) => void;
  authError: string | null;
  t: any;
  // Setup
  numPlayers: number;
  diceCount: number;
  lapsToWin: number;
  eventDensity: number;
  setNumPlayers: (v: number) => void;
  setDiceCount: (v: number) => void;
  setLapsToWin: (v: number) => void;
  setEventDensity: (v: number) => void;
  startGame: () => void;
  // Room
  effectiveUserId: string | null;
  roomId: string | null;
  setRoomId: (v: string | null) => void;
  createRoom: any;
  joinRoom: any;
  leaveRoom: () => Promise<void>;
  startMultiplayerGame: (config?: any) => Promise<void>;
  initialCards: number;
  cardDatabase: any[];
  eventDatabase: any[];
  // Config
  userData: any;
}

export default function GamePhaseViews({
  phase, setPhase, signInWithGoogle, signInWithGithub, setGuestMode, authError, t,
  numPlayers, diceCount, lapsToWin, eventDensity, setNumPlayers, setDiceCount,
  setLapsToWin, setEventDensity, startGame,
  effectiveUserId, roomId, setRoomId, createRoom, joinRoom, leaveRoom,
  startMultiplayerGame, cardDatabase, eventDatabase, userData,
}: GamePhaseViewsProps) {

  if (phase === "auth") return (
    <div className="absolute inset-0 overflow-y-auto">
      <AuthScreen
        onGoogleSignIn={signInWithGoogle}
        onGithubSignIn={signInWithGithub}
        onContinueAsGuest={() => setGuestMode(true)}
        error={authError}
        t={t}
      />
    </div>
  );

  if (phase === "room_select") return !effectiveUserId ? (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="bg-black/60 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
        <h3 className="text-xl font-bold">{t.common.loading || "提示"}</h3>
        <p className="text-gray-400">{t.common.empty || "多人游戏需要登录"}</p>
        <button onClick={() => setPhase("setup")} className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20 transition-all">
          {t.common.back || "返回"}
        </button>
      </div>
    </div>
  ) : (
    <RoomManager
      createRoom={createRoom} joinRoom={joinRoom}
      numPlayers={numPlayers} diceCount={diceCount} lapsToWin={lapsToWin}
      initialCards={5} eventDensity={eventDensity}
      onRoomCreated={(id) => { setRoomId(id); setPhase("room_lobby"); }}
      onRoomJoined={(id) => { setRoomId(id); setPhase("room_lobby"); }}
      onCancel={() => setPhase("setup")}
      t={t}
    />
  );

  if (phase === "room_lobby" && roomId) return (
    <RoomLobby
      roomId={roomId}
      userId={effectiveUserId}
      onStartGame={async () => {
        try {
          await startMultiplayerGame({ cardDatabase, eventDatabase });
        } catch (e) { console.error("Failed to start game:", e); }
      }}
      onLeaveRoom={async () => {
        try { await leaveRoom(); setRoomId(null); setPhase("setup"); }
        catch (e) { console.error("Failed to leave room:", e); }
      }}
      onCancel={() => { setRoomId(null); setPhase("setup"); }}
      t={t}
    />
  );

  if (phase === "setup") return (
    <GameSetup
      numPlayers={numPlayers} diceCount={diceCount} lapsToWin={lapsToWin} eventDensity={eventDensity}
      onNumPlayersChange={setNumPlayers} onDiceCountChange={setDiceCount}
      onLapsToWinChange={setLapsToWin} onEventDensityChange={setEventDensity}
      onManageConfig={() => setPhase("library_manager")} onUserSettings={() => setPhase("settings")}
      onStartGame={startGame} onMultiplayer={() => setPhase("room_select")} t={t}
    />
  );

  if (phase === "library_manager") return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-black/80 border border-white/10 rounded-3xl p-8 max-w-sm w-full space-y-4">
        <h3 className="text-xl font-bold text-white mb-6 text-center">{t.setup.libraryManager}</h3>
        {[
          { label: t.setup.editCards, phase: "config_cards", color: "cyan" },
          { label: t.setup.editEvents, phase: "config_events", color: "purple" },
          { label: t.setup.configImportExport, phase: "config_manager", color: "orange" },
        ].map(({ label, phase: p, color }) => (
          <button key={p} onClick={() => setPhase(p)}
            className={`w-full py-3 px-4 bg-${color}-500/10 border border-${color}-500/20 rounded-xl text-sm font-bold hover:bg-${color}-500/20 transition-all`}>
            {label}
          </button>
        ))}
        <button onClick={() => setPhase("setup")} className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all mt-4">
          {t.setup.backButton}
        </button>
      </div>
    </div>
  );

  if (phase === "config_cards") return (
    <CardEditor cards={userData.cardDatabase}
      onSave={(cards) => { userData.saveCards(cards); setPhase("setup"); }}
      onCancel={() => setPhase("setup")} t={t} />
  );

  if (phase === "config_events") return (
    <EventEditor events={userData.eventDatabase}
      onSave={(events) => { userData.saveEvents(events); setPhase("setup"); }}
      onCancel={() => setPhase("setup")} t={t} />
  );

  if (phase === "config_manager") return (
    <div className="fixed top-[110px] left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/60 flex-shrink-0">
        <h2 className="text-xl font-bold">配置导入导出</h2>
        <button onClick={() => setPhase("setup")} className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <ConfigManager cards={userData.cardDatabase} events={userData.eventDatabase}
            onLoadCards={(cards) => userData.saveCards(cards)}
            onLoadEvents={(events) => userData.saveEvents(events)} t={t} />
        </div>
      </div>
    </div>
  );

  if (phase === "settings") return (
    <GameSettings
      onSave={() => setPhase("setup")} onCancel={() => setPhase("setup")} t={t}
      initialBgType={userData.backgroundType} initialBgValue={userData.backgroundValue}
      initialAvatars={userData.playerAvatars} initialPlayerNames={userData.playerNames}
      onSaveSettings={async (s) => { await userData.saveProfile(s); }}
    />
  );

  return null;
}
