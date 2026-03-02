import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// 创建 Supabase admin client（使用 SERVICE_ROLE_KEY，绕过 RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

// 生成房间码
function generateRoomCode(): string {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 避免 0/1/I/L/O
  const nums = "23456789";
  let code = "";
  code += nums[Math.floor(Math.random() * nums.length)];
  code += nums[Math.floor(Math.random() * nums.length)];
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 创建房间
async function createRoom(userId: string, config: any, playerName: string) {
  let roomCode = generateRoomCode();
  let codeExists = true;

  // 生成唯一房间码
  while (codeExists) {
    const { data: existing } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (!existing) {
      codeExists = false;
    } else {
      roomCode = generateRoomCode();
    }
  }

  // 创建房间
  const { data: room, error: insertError } = await supabaseAdmin
    .from("rooms")
    .insert({
      room_code: roomCode,
      creator_id: userId,
      state: "waiting",
      current_players: 1,
      ...config,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  // 添加创建者为玩家
  const { error: playerError } = await supabaseAdmin
    .from("room_players")
    .insert({
      room_id: room.id,
      user_id: userId,
      player_index: 0,
      player_name: playerName || "Host",
      avatar: "👤",
      color_index: 0,
    });

  if (playerError) throw new Error(playerError.message);

  // 返回完整的房间信息（包括所有玩家）
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", room.id);

  return {
    room,
    players: players || [],
  };
}

// 加入房间
async function joinRoom(userId: string, roomCode: string, playerName: string) {
  // 查找房间
  const { data: targetRoom, error: findError } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (findError || !targetRoom) {
    throw new Error("Room not found");
  }

  if (targetRoom.state !== "waiting") {
    throw new Error("Game already started");
  }

  if (targetRoom.current_players >= targetRoom.max_players) {
    throw new Error("Room is full");
  }

  // 检查玩家是否已在房间中
  const { data: existing } = await supabaseAdmin
    .from("room_players")
    .select("id")
    .eq("room_id", targetRoom.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    throw new Error("Already in this room");
  }

  // 获取当前玩家数
  const { data: existingPlayers } = await supabaseAdmin
    .from("room_players")
    .select("player_index")
    .eq("room_id", targetRoom.id);

  const playerIndex = existingPlayers?.length || 0;

  // 添加玩家
  const { error: joinError } = await supabaseAdmin.from("room_players").insert({
    room_id: targetRoom.id,
    user_id: userId,
    player_index: playerIndex,
    player_name: playerName,
    avatar: "👤",
    color_index: playerIndex,
  });

  if (joinError) throw new Error(joinError.message);

  // 更新房间玩家计数
  await supabaseAdmin
    .from("rooms")
    .update({ current_players: playerIndex + 1 })
    .eq("id", targetRoom.id);

  // 返回完整的房间信息（包括所有玩家）
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", targetRoom.id);

  return {
    room: targetRoom,
    players: players || [],
  };
}

// 离开房间
async function leaveRoom(roomId: string, userId: string) {
  // 删除玩家记录（触发器会自动删除空房间）
  await supabaseAdmin
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  return { success: true };
}

// 开始游戏
async function startGame(roomId: string, userId: string) {
  console.log("🎮 startGame 调用:", { roomId, userId });

  // 验证用户是房间创建者
  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("creator_id, state, num_players, event_density, total_steps")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    console.error("❌ 房间查询失败:", {
      roomId,
      userId,
      error: roomError?.message,
      code: roomError?.code,
      details: roomError?.details,
    });
    throw new Error(`Room not found: ${roomError?.message || "未知错误"}`);
  }

  console.log("✅ 房间查询成功:", {
    roomId,
    creator_id: room.creator_id,
    state: room.state,
  });

  if (room.creator_id !== userId) {
    throw new Error("Only room creator can start game");
  }

  if (room.state === "playing") {
    throw new Error("Game already started");
  }

  // 🔧 在服务器端生成boardTiles，确保所有玩家看到相同的棋盘
  const totalSteps = room.total_steps || 40;
  const numPlayers = room.num_players || 2;
  const eventDensity = room.event_density || 40;

  const boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
    // 起始点附近保持安全
    if (i % (totalSteps / numPlayers) < 2) {
      return { id: "SAFE" };
    }
    // 根据事件密度生成CUSTOM格子
    return Math.random() * 100 < eventDensity
      ? { id: "CUSTOM" }
      : { id: "SAFE" };
  });

  console.log("🎲 服务器生成棋盘瓷砖:", {
    totalSteps,
    numPlayers,
    eventDensity,
    customTiles: boardTiles.filter((t) => t.id === "CUSTOM").length,
  });

  // 创建游戏状态记录
  const { data: existingGame } = await supabaseAdmin
    .from("room_games")
    .select("id")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existingGame) {
    await supabaseAdmin.from("room_games").insert({
      room_id: roomId,
      turn: 0,
      phase: "playing",
      logs: [],
      board_tiles: boardTiles,
    });
  } else {
    // 重置游戏状态
    await supabaseAdmin
      .from("room_games")
      .update({
        turn: 0,
        phase: "playing",
        dice_value: null,
        dice_results: null,
        active_event: null,
        active_card: null,
        logs: [],
        board_tiles: boardTiles,
      })
      .eq("room_id", roomId);
  }

  // 更新房间状态为playing
  const { error: updateError } = await supabaseAdmin
    .from("rooms")
    .update({ state: "playing" })
    .eq("id", roomId);

  if (updateError) {
    throw new Error(`Failed to update room state: ${updateError.message}`);
  }

  // 获取完整房间信息
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId);

  const { data: updatedRoom } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  return {
    room: updatedRoom,
    players: players || [],
    boardTiles,
  };
}

// 掷骰子
async function rollDice(roomId: string, userId: string, diceCount: number) {
  console.log("🎲 API: rollDice 被调用", { roomId, userId, diceCount });

  // 验证玩家在房间中
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("player_index")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!player) {
    throw new Error("Not in this room");
  }

  // 获取游戏状态
  const { data: gameState } = await supabaseAdmin
    .from("room_games")
    .select("turn")
    .eq("room_id", roomId)
    .single();

  console.log("📊 当前游戏状态:", gameState);

  // 生成掷骰结果
  const diceResults = Array.from(
    { length: diceCount },
    () => Math.floor(Math.random() * 6) + 1,
  );
  const diceValue = diceResults.reduce((a, b) => a + b, 0);

  console.log("🎲 生成掷骰结果:", { diceValue, diceResults, diceCount });

  // 更新游戏状态
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from("room_games")
    .update({
      dice_value: diceValue,
      dice_results: diceResults,
      phase: "moving",
    })
    .eq("room_id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("❌ 更新游戏状态失败:", updateError);
    throw new Error(updateError.message);
  }

  console.log("✅ 游戏状态已更新:", updatedGame);

  return {
    diceValue,
    diceResults,
    turn: gameState?.turn,
  };
}

// 移动玩家
async function movePlayer(
  roomId: string,
  userId: string,
  position: number,
  lapCount: number,
) {
  // 验证玩家在房间中
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!player) {
    throw new Error("Not in this room");
  }

  // 更新玩家位置
  const { error: updateError } = await supabaseAdmin
    .from("room_players")
    .update({
      position: position,
      lap_count: lapCount,
    })
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // 获取完整房间信息
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId);

  return {
    position,
    lapCount,
    players: players || [],
  };
}

// 触发事件
async function triggerEvent(roomId: string, userId: string, event: any) {
  // 验证玩家在房间中
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!player) {
    throw new Error("Not in this room");
  }

  // 更新游戏状态中的事件
  const { data: updatedGame } = await supabaseAdmin
    .from("room_games")
    .update({
      active_event: event,
      phase: "event",
    })
    .eq("room_id", roomId)
    .select()
    .single();

  return {
    event,
    phase: "event",
  };
}

// 完成当前玩家的回合，进入下一个玩家
async function endPlayerTurn(roomId: string, userId: string) {
  console.log("♻️  API: endPlayerTurn 被调用", { roomId, userId });

  // 验证玩家在房间中
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("player_index")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!player) {
    throw new Error("Not in this room");
  }

  // 获取房间配置
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("num_players")
    .eq("id", roomId)
    .single();

  if (!room) {
    throw new Error("Room not found");
  }

  // 获取当前游戏状态
  const { data: gameState } = await supabaseAdmin
    .from("room_games")
    .select("turn")
    .eq("room_id", roomId)
    .single();

  if (!gameState) {
    throw new Error("Game state not found");
  }

  // 计算下一个玩家的索引
  const nextTurn = (gameState.turn + 1) % room.num_players;

  console.log("🔄 回合更新:", {
    currentTurn: gameState.turn,
    nextTurn,
    numPlayers: room.num_players,
  });

  // 更新游戏状态：重置掷骰数据，更新turn
  const { data: updatedGame, error: updateError } = await supabaseAdmin
    .from("room_games")
    .update({
      turn: nextTurn,
      dice_value: null,
      dice_results: null,
      phase: "playing",
    })
    .eq("room_id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("❌ 更新游戏状态失败:", updateError);
    throw new Error(updateError.message);
  }

  console.log("✅ 回合已更新到玩家:", nextTurn + 1);

  return {
    turn: nextTurn,
    phase: "playing",
  };
}

// 更新房间配置（仅房间创建者可以，且仅在游戏未开始时）
async function updateRoomConfig(roomId: string, userId: string, config: any) {
  // 验证用户是房间创建者
  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("creator_id, state, current_players")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    throw new Error("Room not found");
  }

  if (room.creator_id !== userId) {
    throw new Error("Only room creator can update config");
  }

  if (room.state === "playing") {
    throw new Error("Cannot update config while game is playing");
  }

  // 验证配置有效性
  if (config.num_players && config.num_players < room.current_players) {
    throw new Error(
      `Cannot reduce players to ${config.num_players} (${room.current_players} already joined)`,
    );
  }

  // 更新房间配置
  const { data: updatedRoom, error: updateError } = await supabaseAdmin
    .from("rooms")
    .update({
      num_players: config.num_players,
      dice_count: config.dice_count,
      laps_to_win: config.laps_to_win,
      initial_cards: config.initial_cards,
      event_density: config.event_density,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updatedRoom;
}

// 获取房间信息（用于重新连接）
async function getRoomInfo(roomId: string, userId: string) {
  // 验证玩家是否在房间中
  const { data: playerRecord } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!playerRecord) {
    throw new Error("Not in this room");
  }

  // 获取房间信息
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  // 获取所有玩家（无 RLS 限制）
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId);

  return {
    room,
    players: players || [],
  };
}

// API 请求处理器
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
    const {
      action,
      config,
      playerName,
      roomCode,
      roomId,
      diceCount,
      position,
      lapCount,
      event,
    } = body;

    // 验证授权（从 Authorization header 获取用户信息）
    const authHeader = request.headers.get("Authorization");
    console.log("🔐 Authorization header:", authHeader ? "存在" : "不存在");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ 缺少或格式错误的 Authorization header");
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    // 从 token 获取用户信息
    const token = authHeader.replace("Bearer ", "");
    console.log("🔑 Token (前20字符):", token.substring(0, 20) + "...");

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ 认证失败:", authError?.message || "用户不存在");
      return NextResponse.json(
        { error: "Unauthorized", details: authError?.message },
        { status: 401 },
      );
    }

    const userId = user.id;
    console.log("✅ 用户认证成功:", userId);
    let result;

    switch (action) {
      case "createRoom":
        result = await createRoom(userId, config, playerName);
        break;
      case "joinRoom":
        result = await joinRoom(userId, roomCode, playerName);
        break;
      case "leaveRoom":
        result = await leaveRoom(roomId, userId);
        break;
      case "getRoomInfo":
        result = await getRoomInfo(roomId, userId);
        break;
      case "startGame":
        result = await startGame(roomId, userId);
        break;
      case "rollDice":
        result = await rollDice(roomId, userId, diceCount);
        break;
      case "movePlayer":
        result = await movePlayer(roomId, userId, position, lapCount);
        break;
      case "triggerEvent":
        result = await triggerEvent(roomId, userId, event);
        break;
      case "endPlayerTurn":
        result = await endPlayerTurn(roomId, userId);
        break;
      case "updateRoomConfig":
        result = await updateRoomConfig(roomId, userId, config);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("❌ API Error:", {
      action: body?.action,
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 400 },
    );
  }
}
