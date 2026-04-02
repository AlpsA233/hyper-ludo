import { NextResponse } from "next/server";
import Ably from "ably";
import {
  getRoom,
  setRoom,
  deleteRoom,
  getPlayers,
  setPlayers,
  deletePlayers,
  getGameState,
  setGameState,
  deleteGameState,
  getRoomIdByCode,
  setRoomCode,
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

        // Ensure unique room code
        let roomCode = generateRoomCode();
        while (await getRoomIdByCode(roomCode)) roomCode = generateRoomCode();

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
          position: -1,
          lap: 0,
          skip_turn: false,
          cards: [],
          shield: false,
        };

        await Promise.all([
          setRoom(room),
          setRoomCode(roomCode, id),
          setPlayers(id, [player]),
        ]);

        console.log(`✅ Room created: ${roomCode} (${id})`);
        return NextResponse.json({ room, players: [player] });
      }

      // ── Join Room ──────────────────────────────────────────
      case "joinRoom": {
        const { roomCode, playerName = "Player" } = payload;

        const targetRoomId = await getRoomIdByCode(roomCode);
        if (!targetRoomId) {
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        }
        const targetRoom = await getRoom(targetRoomId);
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

        const players = await getPlayers(targetRoomId);

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
          room_id: targetRoomId,
          user_id: userId,
          player_index: players.length,
          player_name: playerName,
          avatar: "👤",
          color_index: players.length,
          position: -1,
          lap: 0,
          skip_turn: false,
          cards: [],
          shield: false,
        };

        const updatedPlayers = [...players, newPlayer];
        targetRoom.current_players = updatedPlayers.length;
        targetRoom.updated_at = new Date().toISOString();

        await Promise.all([
          setRoom(targetRoom),
          setPlayers(targetRoomId, updatedPlayers),
        ]);

        await broadcast(targetRoomId, "players_update", updatedPlayers);
        await broadcast(targetRoomId, "room_update", targetRoom);

        console.log(`✅ ${playerName} joined room ${roomCode}`);
        return NextResponse.json({ room: targetRoom, players: updatedPlayers });
      }

      // ── Leave Room ─────────────────────────────────────────
      case "leaveRoom": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = await getRoom(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );

        const players = await getPlayers(roomId);
        const updated = players.filter((p) => p.user_id !== userId);

        if (updated.length === 0) {
          await Promise.all([
            deleteRoom(room),
            deletePlayers(roomId),
            deleteGameState(roomId),
          ]);
        } else {
          room.current_players = updated.length;
          room.updated_at = new Date().toISOString();
          await Promise.all([setRoom(room), setPlayers(roomId, updated)]);
          await broadcast(roomId, "players_update", updated);
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
        const room = await getRoom(roomId);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
        const [players, gameState] = await Promise.all([
          getPlayers(roomId),
          getGameState(roomId),
        ]);
        return NextResponse.json({
          room,
          players,
          gameState: gameState ?? null,
        });
      }

      // ── Start Game ─────────────────────────────────────────
      case "startGame": {
        if (!roomId)
          return NextResponse.json(
            { error: "Missing roomId" },
            { status: 400 },
          );
        const room = await getRoom(roomId);
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

        const players = await getPlayers(roomId);

        if (room.state === "playing") {
          const game = await getGameState(roomId);
          return NextResponse.json({
            room,
            players,
            boardTiles: game?.board_tiles || [],
          });
        }

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

        room.state = "playing";
        room.updated_at = new Date().toISOString();

        await Promise.all([setRoom(room), setGameState(roomId, gameState)]);
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
        const gameState = await getGameState(roomId);
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

        await setGameState(roomId, gameState);
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
        const players = await getPlayers(roomId);
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

        await setPlayers(roomId, players);
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
        const gameState = await getGameState(roomId);
        if (!gameState)
          return NextResponse.json(
            { error: "Game not started" },
            { status: 400 },
          );

        gameState.active_event = payload.event;
        gameState.phase = "event";

        await setGameState(roomId, gameState);
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
        const [players, gameState] = await Promise.all([
          getPlayers(roomId),
          getGameState(roomId),
        ]);
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

        await Promise.all([
          setPlayers(roomId, players),
          setGameState(roomId, gameState),
        ]);
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
        const [room, gameState] = await Promise.all([
          getRoom(roomId),
          getGameState(roomId),
        ]);
        if (!room)
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 },
          );
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

        await setGameState(roomId, gameState);
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
        const { winnerIndex } = payload;
        const [room, gameState] = await Promise.all([
          getRoom(roomId),
          getGameState(roomId),
        ]);

        if (gameState) {
          gameState.phase = "win";
          gameState.active_card = { winnerIndex };
          await setGameState(roomId, gameState);
          await broadcast(roomId, "game_update", gameState);
        }
        if (room) {
          room.state = "finished";
          room.updated_at = new Date().toISOString();
          await setRoom(room);
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
        const room = await getRoom(roomId);
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
        const players = await getPlayers(roomId);
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

        await setRoom(room);
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
