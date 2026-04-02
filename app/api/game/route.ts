import { NextResponse } from "next/server";
import Ably from "ably";
import {
  rooms,
  roomPlayers,
  roomGames,
  generateRoomCode,
  genId,
  RoomInfo,
  RoomPlayer,
  GameState,
} from "@/app/lib/gameStore";

const ABLY_API_KEY = process.env.ABLY_API_KEY!;

async function broadcast(roomId: string, name: string, data: any) {
  if (!ABLY_API_KEY) return;
  const ably = new Ably.Rest({ key: ABLY_API_KEY });
  const channel = ably.channels.get(`game:${roomId}`);
  await channel.publish(name, data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, userId, roomId, payload = {} } = body;

  if (!action || !userId) {
    return NextResponse.json(
      { error: "Missing action or userId" },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      // ── Create Room ────────────────────────────────────────
      case "createRoom": {
        const { config = {}, playerName = "Host" } = payload;

        let roomCode = generateRoomCode();
        const existingCodes = new Set(
          [...rooms.values()].map((r) => r.room_code),
        );
        while (existingCodes.has(roomCode)) roomCode = generateRoomCode();

        const id = genId();
        const now = new Date().toISOString();

        const room: RoomInfo = {
          id,
          room_code: roomCode,
          creator_id: userId,
          state: "waiting",
          current_players: 1,
          num_players: config.num_players || 4,
          dice_count: config.dice_count || 1,
          laps_to_win: config.laps_to_win || 3,
          initial_cards: config.initial_cards || 5,
          event_density: config.event_density || 40,
          created_at: now,
          updated_at: now,
        };

        const player: RoomPlayer = {
          id: genId(),
          room_id: id,
          user_id: userId,
          player_index: 0,
          player_name: playerName,
          avatar: "👤",
          color_index: 0,
          position: 0,
          lap: 0,
          skip_turn: false,
          cards: [],
          shield: false,
        };

        rooms.set(id, room);
        roomPlayers.set(id, [player]);

        console.log(`✅ Room created: ${roomCode} (${id})`);
        return NextResponse.json({ room, players: [player] });
      }

      // ── Join Room ──────────────────────────────────────────
      case "joinRoom": {
        const { roomCode, playerName = "Player" } = payload;

        let targetRoom: RoomInfo | undefined;
        for (const r of rooms.values()) {
          if (r.room_code === roomCode) {
            targetRoom = r;
            break;
          }
        }
        if (!targetRoom) {
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        }
        if (targetRoom.state !== "waiting") {
          return NextResponse.json(
            { error: "Game already started" },
            { status: 400 },
          );
        }

        const players = roomPlayers.get(targetRoom.id) || [];

        // Re-join on page refresh
        const existing = players.find((p) => p.user_id === userId);
        if (existing) {
          return NextResponse.json({ room: targetRoom, players });
        }

        if (players.length >= targetRoom.num_players) {
          return NextResponse.json({ error: "Room is full" }, { status: 400 });
        }

        const newPlayer: RoomPlayer = {
          id: genId(),
          room_id: targetRoom.id,
          user_id: userId,
          player_index: players.length,
          player_name: playerName,
          avatar: "👤",
          color_index: players.length,
          position: 0,
          lap: 0,
          skip_turn: false,
          cards: [],
          shield: false,
        };

        players.push(newPlayer);
        targetRoom.current_players = players.length;
        targetRoom.updated_at = new Date().toISOString();

        await broadcast(targetRoom.id, "players_update", players);
        await broadcast(targetRoom.id, "room_update", targetRoom);

        console.log(`✅ ${playerName} joined room ${roomCode}`);
        return NextResponse.json({ room: targetRoom, players });
      }

      // ── Leave Room ─────────────────────────────────────────
      case "leaveRoom": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );

        const players = roomPlayers.get(roomId) || [];
        const idx = players.findIndex((p) => p.user_id === userId);
        if (idx >= 0) {
          players.splice(idx, 1);
          room.current_players = players.length;
          room.updated_at = new Date().toISOString();
        }

        if (players.length === 0) {
          rooms.delete(roomId);
          roomPlayers.delete(roomId);
          roomGames.delete(roomId);
        } else {
          await broadcast(roomId, "players_update", players);
          await broadcast(roomId, "room_update", room);
        }

        return NextResponse.json({ success: true });
      }

      // ── Get Room Info ──────────────────────────────────────
      case "getRoomInfo": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        const players = roomPlayers.get(roomId) || [];
        const gameState = roomGames.get(roomId) || null;
        return NextResponse.json({ room, players, gameState });
      }

      // ── Start Game ─────────────────────────────────────────
      case "startGame": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        if (room.creator_id !== userId) {
          return NextResponse.json(
            { error: "Only creator can start" },
            { status: 403 },
          );
        }

        if (room.state === "playing") {
          const game = roomGames.get(roomId);
          return NextResponse.json({
            room,
            players: roomPlayers.get(roomId) || [],
            boardTiles: game?.board_tiles || [],
          });
        }

        const players = roomPlayers.get(roomId) || [];
        const totalSteps = 40;
        const eventDensity = room.event_density || 40;
        const boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
          if (i % (totalSteps / room.num_players) < 2) return { id: "SAFE" };
          return Math.random() * 100 < eventDensity
            ? { id: "CUSTOM" }
            : { id: "SAFE" };
        });

        const gameState: GameState = {
          room_id: roomId,
          turn: 0,
          phase: "playing",
          dice_value: null,
          dice_results: null,
          active_event: null,
          active_card: null,
          logs: [],
          board_tiles: boardTiles,
        };

        roomGames.set(roomId, gameState);
        room.state = "playing";
        room.updated_at = new Date().toISOString();

        await broadcast(roomId, "room_update", room);
        await broadcast(roomId, "players_update", players);
        await broadcast(roomId, "game_update", gameState);

        console.log(
          `🎮 Game started: ${room.room_code} (${players.length} players)`,
        );
        return NextResponse.json({ room, players, boardTiles });
      }

      // ── Roll Dice ──────────────────────────────────────────
      case "rollDice": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const gameState = roomGames.get(roomId);
        if (!gameState)
          return NextResponse.json(
            { error: "Game not started" },
            { status: 400 },
          );

        const diceCount = payload.diceCount || 1;
        const diceResults = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * 6) + 1,
        );
        const diceValue = diceResults.reduce((a, b) => a + b, 0);

        gameState.dice_value = diceValue;
        gameState.dice_results = diceResults;
        gameState.phase = "moving";

        await broadcast(roomId, "game_update", gameState);
        return NextResponse.json({
          diceValue,
          diceResults,
          turn: gameState.turn,
        });
      }

      // ── Move Player ────────────────────────────────────────
      case "movePlayer": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const players = roomPlayers.get(roomId) || [];
        const movingPlayer = players.find((p) => p.user_id === userId);
        if (!movingPlayer)
          return NextResponse.json({ error: "Not in room" }, { status: 403 });

        const { position, lapCount, targetPlayerIndex } = payload;
        const targetIdx =
          targetPlayerIndex !== undefined
            ? targetPlayerIndex
            : movingPlayer.player_index;
        const target = players.find((p) => p.player_index === targetIdx);
        if (target) {
          target.position = position;
          target.lap = lapCount;
        }

        await broadcast(roomId, "players_update", players);
        return NextResponse.json({ position, lapCount, players });
      }

      // ── Trigger Event ──────────────────────────────────────
      case "triggerEvent": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const gameState = roomGames.get(roomId);
        if (!gameState)
          return NextResponse.json(
            { error: "Game not started" },
            { status: 400 },
          );

        gameState.active_event = payload.event;
        gameState.phase = "event";

        await broadcast(roomId, "game_update", gameState);
        return NextResponse.json({ event: payload.event, phase: "event" });
      }

      // ── Use Card ───────────────────────────────────────────
      case "useCard": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const players = roomPlayers.get(roomId) || [];
        const gameState = roomGames.get(roomId);
        if (!gameState)
          return NextResponse.json(
            { error: "Game not started" },
            { status: 400 },
          );

        const { cardEffect } = payload;
        const { playerUpdates = [], card } = cardEffect || {};
        for (const update of playerUpdates) {
          const target = players.find(
            (p) => p.player_index === update.playerIndex,
          );
          if (target) {
            if (update.position !== undefined)
              target.position = update.position;
            if (update.lap !== undefined) target.lap = update.lap;
            if (update.skipTurn !== undefined)
              target.skip_turn = update.skipTurn;
          }
        }

        gameState.active_card = card;
        gameState.phase = "playing";

        await broadcast(roomId, "players_update", players);
        await broadcast(roomId, "game_update", gameState);
        return NextResponse.json({ success: true });
      }

      // ── End Player Turn ────────────────────────────────────
      case "endPlayerTurn": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        const gameState = roomGames.get(roomId);
        if (!gameState)
          return NextResponse.json(
            { error: "Game not started" },
            { status: 400 },
          );

        const nextTurn = (gameState.turn + 1) % room.num_players;
        gameState.turn = nextTurn;
        gameState.dice_value = null;
        gameState.dice_results = null;
        gameState.active_event = null;
        gameState.active_card = null;
        gameState.phase = "playing";

        await broadcast(roomId, "game_update", gameState);
        console.log(
          `♻️ Turn ended in ${room.room_code}, next: Player ${nextTurn + 1}`,
        );
        return NextResponse.json({ turn: nextTurn, phase: "playing" });
      }

      // ── Set Winner ─────────────────────────────────────────
      case "setWinner": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        const gameState = roomGames.get(roomId);
        const { winnerIndex } = payload;

        if (gameState) {
          gameState.phase = "win";
          gameState.active_card = { winnerIndex };
          await broadcast(roomId, "game_update", gameState);
        }
        if (room) {
          room.state = "finished";
          room.updated_at = new Date().toISOString();
          await broadcast(roomId, "room_update", room);
        }
        return NextResponse.json({ winnerIndex, phase: "win" });
      }

      // ── Update Room Config ─────────────────────────────────
      case "updateRoomConfig": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = rooms.get(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        if (room.creator_id !== userId) {
          return NextResponse.json(
            { error: "Only creator can update" },
            { status: 403 },
          );
        }
        if (room.state === "playing") {
          return NextResponse.json(
            { error: "Cannot update while playing" },
            { status: 400 },
          );
        }

        const { config } = payload;
        const players = roomPlayers.get(roomId) || [];
        if (config.num_players && config.num_players < players.length) {
          return NextResponse.json(
            {
              error: `Cannot reduce to ${config.num_players} (${players.length} already joined)`,
            },
            { status: 400 },
          );
        }

        if (config.num_players) room.num_players = config.num_players;
        if (config.dice_count) room.dice_count = config.dice_count;
        if (config.laps_to_win) room.laps_to_win = config.laps_to_win;
        if (config.initial_cards !== undefined)
          room.initial_cards = config.initial_cards;
        if (config.event_density !== undefined)
          room.event_density = config.event_density;
        room.updated_at = new Date().toISOString();

        await broadcast(roomId, "room_update", room);
        return NextResponse.json(room);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    console.error(`[/api/game] Error in ${action}:`, err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}
