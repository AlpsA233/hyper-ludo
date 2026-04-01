import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const PORT = 3001;

// ==================== In-Memory Storage ====================
/** @type {Map<string, object>} roomId -> RoomInfo */
const rooms = new Map();
/** @type {Map<string, object[]>} roomId -> RoomPlayer[] */
const roomPlayers = new Map();
/** @type {Map<string, object>} roomId -> GameState */
const roomGames = new Map();

// WebSocket tracking
/** @type {Map<import('ws').WebSocket, {userId: string, roomId: string|null}>} */
const clientInfo = new Map();
/** @type {Map<string, Set<import('ws').WebSocket>>} roomId -> Set<ws> */
const roomClients = new Map();

// ==================== Helpers ====================
function generateRoomCode() {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const nums = "23456789";
  let code = "";
  code += nums[Math.floor(Math.random() * nums.length)];
  code += nums[Math.floor(Math.random() * nums.length)];
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastToRoom(roomId, type, data, excludeWs = null) {
  const wsSet = roomClients.get(roomId);
  if (!wsSet) return;
  const msg = JSON.stringify({ type, data });
  for (const ws of wsSet) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

function addClientToRoom(ws, roomId) {
  const info = clientInfo.get(ws);
  // Remove from old room if different
  if (info?.roomId && info.roomId !== roomId) {
    roomClients.get(info.roomId)?.delete(ws);
  }
  if (!roomClients.has(roomId)) {
    roomClients.set(roomId, new Set());
  }
  roomClients.get(roomId).add(ws);
  if (info) info.roomId = roomId;
}

function removeClientFromRoom(ws) {
  const info = clientInfo.get(ws);
  if (info?.roomId) {
    roomClients.get(info.roomId)?.delete(ws);
    info.roomId = null;
  }
}

// ==================== Action Handlers ====================

function handleCreateRoom(ws, userId, { config = {}, playerName = "Host" }) {
  // Generate unique room code
  let roomCode = generateRoomCode();
  const existingCodes = new Set([...rooms.values()].map((r) => r.room_code));
  while (existingCodes.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const roomId = randomUUID();
  const now = new Date().toISOString();

  const room = {
    id: roomId,
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

  const player = {
    id: randomUUID(),
    room_id: roomId,
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

  rooms.set(roomId, room);
  roomPlayers.set(roomId, [player]);
  addClientToRoom(ws, roomId);

  console.log(`✅ Room created: ${roomCode} (${roomId}) by ${userId}`);
  return { room, players: [player] };
}

function handleJoinRoom(ws, userId, { roomCode, playerName = "Player" }) {
  // Find room by code
  let targetRoom = null;
  for (const r of rooms.values()) {
    if (r.room_code === roomCode) {
      targetRoom = r;
      break;
    }
  }
  if (!targetRoom) throw new Error("Room not found");
  if (targetRoom.state !== "waiting") throw new Error("Game already started");

  const players = roomPlayers.get(targetRoom.id) || [];

  // If already in room (e.g. page refresh), just re-subscribe and return current state
  const existingPlayer = players.find((p) => p.user_id === userId);
  if (existingPlayer) {
    addClientToRoom(ws, targetRoom.id);
    console.log(`🔄 ${playerName} re-joined room ${roomCode} (already a member)`);
    return { room: targetRoom, players };
  }

  if (players.length >= targetRoom.num_players) throw new Error("Room is full");

  const playerIndex = players.length;
  const newPlayer = {
    id: randomUUID(),
    room_id: targetRoom.id,
    user_id: userId,
    player_index: playerIndex,
    player_name: playerName,
    avatar: "👤",
    color_index: playerIndex,
    position: 0,
    lap: 0,
    skip_turn: false,
    cards: [],
    shield: false,
  };

  players.push(newPlayer);
  targetRoom.current_players = players.length;
  targetRoom.updated_at = new Date().toISOString();

  addClientToRoom(ws, targetRoom.id);

  // Broadcast to other players in room
  broadcastToRoom(targetRoom.id, "players_update", players, null);
  broadcastToRoom(targetRoom.id, "room_update", targetRoom, null);

  console.log(
    `✅ ${playerName} joined room ${roomCode} (${players.length}/${targetRoom.num_players})`,
  );
  return { room: targetRoom, players };
}

function handleLeaveRoom(ws, userId, { roomId }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  const idx = players.findIndex((p) => p.user_id === userId);
  if (idx >= 0) {
    players.splice(idx, 1);
    room.current_players = players.length;
    room.updated_at = new Date().toISOString();
  }

  removeClientFromRoom(ws);

  // If room is empty, delete it
  if (players.length === 0) {
    rooms.delete(roomId);
    roomPlayers.delete(roomId);
    roomGames.delete(roomId);
    roomClients.delete(roomId);
    console.log(`🗑️ Room ${room.room_code} deleted (empty)`);
  } else {
    // Broadcast to remaining players
    broadcastToRoom(roomId, "players_update", players);
    broadcastToRoom(roomId, "room_update", room);
  }

  return { success: true };
}

function handleGetRoomInfo(ws, userId, { roomId }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  // Also subscribe this client to room updates
  addClientToRoom(ws, roomId);

  return { room, players };
}

function handleStartGame(ws, userId, { roomId }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];

  // If already playing, return current state
  if (room.state === "playing") {
    const game = roomGames.get(roomId);
    return {
      room,
      players,
      boardTiles: game?.board_tiles || [],
    };
  }

  if (room.creator_id !== userId) {
    throw new Error("Only room creator can start game");
  }

  // Generate board tiles (same logic as route.ts)
  const totalSteps = 40;
  const numPlayers = room.num_players || 2;
  const eventDensity = room.event_density || 40;

  const boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
    if (i % (totalSteps / numPlayers) < 2) return { id: "SAFE" };
    return Math.random() * 100 < eventDensity
      ? { id: "CUSTOM" }
      : { id: "SAFE" };
  });

  // Create game state
  const gameState = {
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

  // Update room state
  room.state = "playing";
  room.updated_at = new Date().toISOString();

  // Broadcast to all clients in room
  broadcastToRoom(roomId, "room_update", room);
  broadcastToRoom(roomId, "players_update", players);
  broadcastToRoom(roomId, "game_update", gameState);

  console.log(
    `🎮 Game started in room ${room.room_code} with ${players.length} players`,
  );
  return { room, players, boardTiles };
}

function handleRollDice(ws, userId, { roomId, diceCount = 1 }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  const player = players.find((p) => p.user_id === userId);
  if (!player) throw new Error("Not in this room");

  const gameState = roomGames.get(roomId);
  if (!gameState) throw new Error("Game state not found");

  // Generate dice results
  const diceResults = Array.from(
    { length: diceCount },
    () => Math.floor(Math.random() * 6) + 1,
  );
  const diceValue = diceResults.reduce((a, b) => a + b, 0);

  // Update game state
  gameState.dice_value = diceValue;
  gameState.dice_results = diceResults;
  gameState.phase = "moving";

  // Broadcast
  broadcastToRoom(roomId, "game_update", gameState);

  console.log(
    `🎲 Dice roll in ${room.room_code}: [${diceResults}] = ${diceValue}`,
  );
  return { diceValue, diceResults, turn: gameState.turn };
}

function handleMovePlayer(
  ws,
  userId,
  { roomId, position, lapCount, targetPlayerIndex },
) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  const player = players.find((p) => p.user_id === userId);
  if (!player) throw new Error("Not in this room");

  // Update the target player (or self)
  const targetIdx =
    targetPlayerIndex !== undefined ? targetPlayerIndex : player.player_index;
  const target = players.find((p) => p.player_index === targetIdx);
  if (target) {
    target.position = position;
    target.lap = lapCount;
  }

  // Broadcast
  broadcastToRoom(roomId, "players_update", players);

  return { position, lapCount, players };
}

function handleTriggerEvent(ws, userId, { roomId, event }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  if (!players.some((p) => p.user_id === userId))
    throw new Error("Not in this room");

  const gameState = roomGames.get(roomId);
  if (!gameState) throw new Error("Game state not found");

  gameState.active_event = event;
  gameState.phase = "event";

  broadcastToRoom(roomId, "game_update", gameState);

  return { event, phase: "event" };
}

function handleUseCard(ws, userId, { roomId, cardEffect }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  if (!players.some((p) => p.user_id === userId))
    throw new Error("Not in this room");

  const gameState = roomGames.get(roomId);
  if (!gameState) throw new Error("Game state not found");

  const { playerUpdates, card } = cardEffect;

  // Apply player updates
  if (playerUpdates?.length) {
    for (const update of playerUpdates) {
      const target = players.find((p) => p.player_index === update.playerIndex);
      if (target) {
        if (update.position !== undefined) target.position = update.position;
        if (update.lap !== undefined) target.lap = update.lap;
        if (update.skipTurn !== undefined) target.skip_turn = update.skipTurn;
      }
    }
  }

  gameState.active_card = card;
  gameState.phase = "playing";

  broadcastToRoom(roomId, "players_update", players);
  broadcastToRoom(roomId, "game_update", gameState);

  return { success: true, playerUpdates };
}

function handleEndPlayerTurn(ws, userId, { roomId }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const players = roomPlayers.get(roomId) || [];
  if (!players.some((p) => p.user_id === userId))
    throw new Error("Not in this room");

  const gameState = roomGames.get(roomId);
  if (!gameState) throw new Error("Game state not found");

  const nextTurn = (gameState.turn + 1) % room.num_players;

  gameState.turn = nextTurn;
  gameState.dice_value = null;
  gameState.dice_results = null;
  gameState.active_event = null;
  gameState.active_card = null;
  gameState.phase = "playing";

  broadcastToRoom(roomId, "game_update", gameState);

  console.log(
    `♻️ Turn ended in ${room.room_code}, next: Player ${nextTurn + 1}`,
  );
  return { turn: nextTurn, phase: "playing" };
}

function handleSetWinner(ws, userId, { roomId, winnerIndex }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");

  const gameState = roomGames.get(roomId);
  if (gameState) {
    gameState.phase = "win";
    gameState.active_card = { winnerIndex };
    broadcastToRoom(roomId, "game_update", gameState);
  }

  room.state = "finished";
  room.updated_at = new Date().toISOString();
  broadcastToRoom(roomId, "room_update", room);

  return { winnerIndex, phase: "win" };
}

function handleUpdateRoomConfig(ws, userId, { roomId, config }) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");
  if (room.creator_id !== userId)
    throw new Error("Only room creator can update config");
  if (room.state === "playing")
    throw new Error("Cannot update config while playing");

  const players = roomPlayers.get(roomId) || [];
  if (config.num_players && config.num_players < players.length) {
    throw new Error(
      `Cannot reduce players to ${config.num_players} (${players.length} already joined)`,
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

  broadcastToRoom(roomId, "room_update", room);

  return room;
}

function handleSubscribe(ws, userId, { roomId }) {
  addClientToRoom(ws, roomId);
  // Send current state immediately
  const room = rooms.get(roomId);
  const players = roomPlayers.get(roomId) || [];
  const gameState = roomGames.get(roomId);

  if (room) ws.send(JSON.stringify({ type: "room_update", data: room }));
  ws.send(JSON.stringify({ type: "players_update", data: players }));
  if (gameState)
    ws.send(JSON.stringify({ type: "game_update", data: gameState }));

  return { subscribed: true };
}

// ==================== Message Router ====================

const handlers = {
  createRoom: handleCreateRoom,
  joinRoom: handleJoinRoom,
  leaveRoom: handleLeaveRoom,
  getRoomInfo: handleGetRoomInfo,
  startGame: handleStartGame,
  rollDice: handleRollDice,
  movePlayer: handleMovePlayer,
  triggerEvent: handleTriggerEvent,
  useCard: handleUseCard,
  endPlayerTurn: handleEndPlayerTurn,
  setWinner: handleSetWinner,
  updateRoomConfig: handleUpdateRoomConfig,
  subscribe: handleSubscribe,
};

function handleMessage(ws, msg) {
  const { id, action, userId, ...data } = msg;

  // Identify action: just store userId
  if (action === "identify") {
    clientInfo.set(ws, { userId: msg.userId, roomId: null });
    if (id !== undefined) {
      ws.send(JSON.stringify({ id, data: { ok: true } }));
    }
    console.log(`🔗 Client identified: ${msg.userId}`);
    return;
  }

  const handler = handlers[action];
  if (!handler) {
    if (id !== undefined) {
      ws.send(JSON.stringify({ id, error: `Unknown action: ${action}` }));
    }
    return;
  }

  // Get userId from message or stored client info
  const effectiveUserId = userId || clientInfo.get(ws)?.userId;
  if (!effectiveUserId) {
    if (id !== undefined) {
      ws.send(
        JSON.stringify({ id, error: "Not identified. Send identify first." }),
      );
    }
    return;
  }

  try {
    const result = handler(ws, effectiveUserId, data);
    if (id !== undefined) {
      ws.send(JSON.stringify({ id, data: result }));
    }
  } catch (err) {
    console.error(`❌ ${action} error:`, err.message);
    if (id !== undefined) {
      ws.send(JSON.stringify({ id, error: err.message }));
    }
  }
}

// ==================== Server ====================

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  console.log("🔗 New client connected");

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(ws, msg);
    } catch (err) {
      console.error("Failed to parse message:", err.message);
    }
  });

  ws.on("close", () => {
    const info = clientInfo.get(ws);
    if (info?.roomId) {
      roomClients.get(info.roomId)?.delete(ws);
    }
    clientInfo.delete(ws);
    console.log("🔌 Client disconnected");
  });
});

console.log(`🚀 WebSocket game server running on ws://localhost:${PORT}`);
console.log("   No database, no auth, no RLS — pure in-memory game state");
console.log("   Rooms:", rooms.size, "| Clients:", clientInfo.size);
