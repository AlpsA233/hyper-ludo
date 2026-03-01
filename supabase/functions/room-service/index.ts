import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 处理 CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...data } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // 创建 Supabase 客户端（使用 service role key，绕过 RLS）
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 从 token 获取用户 ID
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    let result;

    switch (action) {
      case "createRoom":
        result = await createRoom(supabase, user.id, data);
        break;
      case "joinRoom":
        result = await joinRoom(supabase, user.id, data);
        break;
      case "leaveRoom":
        result = await leaveRoom(supabase, user.id, data);
        break;
      case "getRoomInfo":
        result = await getRoomInfo(supabase, user.id, data);
        break;
      default:
        throw new Error("Unknown action");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// 生成房间码
function generateRoomCode(): string {
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

// 创建房间
async function createRoom(supabase: any, userId: string, data: any) {
  const { config, playerName } = data;

  let roomCode = generateRoomCode();
  let codeExists = true;

  // 生成唯一房间码
  while (codeExists) {
    const { data: existing } = await supabase
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
  const { data: room, error: insertError } = await supabase
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

  if (insertError) throw insertError;

  // 添加创建者为玩家
  const { error: playerError } = await supabase.from("room_players").insert({
    room_id: room.id,
    user_id: userId,
    player_index: 0,
    player_name: playerName || "Host",
    avatar: "👤",
    color_index: 0,
  });

  if (playerError) throw playerError;

  // 返回完整的房间信息（包括所有玩家）
  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id);

  return {
    room,
    players: players || [],
  };
}

// 加入房间
async function joinRoom(supabase: any, userId: string, data: any) {
  const { roomCode, playerName } = data;

  // 查找房间
  const { data: targetRoom, error: findError } = await supabase
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
  const { data: existing } = await supabase
    .from("room_players")
    .select("id")
    .eq("room_id", targetRoom.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    throw new Error("Already in this room");
  }

  // 获取当前玩家数
  const { data: existingPlayers } = await supabase
    .from("room_players")
    .select("player_index")
    .eq("room_id", targetRoom.id);

  const playerIndex = existingPlayers?.length || 0;

  // 添加玩家
  const { error: joinError } = await supabase.from("room_players").insert({
    room_id: targetRoom.id,
    user_id: userId,
    player_index: playerIndex,
    player_name: playerName,
    avatar: "👤",
    color_index: playerIndex,
  });

  if (joinError) throw joinError;

  // 更新房间玩家计数
  await supabase
    .from("rooms")
    .update({ current_players: playerIndex + 1 })
    .eq("id", targetRoom.id);

  // 返回完整的房间信息（包括所有玩家）
  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", targetRoom.id);

  return {
    room: targetRoom,
    players: players || [],
  };
}

// 离开房间
async function leaveRoom(supabase: any, userId: string, data: any) {
  const { roomId } = data;

  // 删除玩家记录（触发器会自动删除空房间）
  await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  return { success: true };
}

// 获取房间信息（客户端重新连接时使用）
async function getRoomInfo(supabase: any, userId: string, data: any) {
  const { roomId } = data;

  // 验证玩家是否在房间中
  const { data: playerRecord } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!playerRecord) {
    throw new Error("Not in this room");
  }

  // 获取房间信息
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  // 获取所有玩家（而不是被 RLS 限制的结果）
  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId);

  return {
    room,
    players: players || [],
  };
}
