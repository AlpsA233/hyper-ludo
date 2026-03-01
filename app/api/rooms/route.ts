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
  try {
    const body = await request.json();
    const {
      action,
      config,
      playerName,
      roomCode,
      roomId,
      userId: reqUserId,
    } = body;

    // 验证授权（从 Authorization header 获取用户信息）
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    // 从 token 获取用户信息
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
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
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 400 },
    );
  }
}
