import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishGameEvent } from "@/app/lib/ably";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Ably API route - handles authoritative game operations
// All operations update Supabase (authoritative state) then broadcast via Ably

const ABLY_API_KEY = process.env.ABLY_API_KEY || "";

export async function POST(request: Request) {
  const { action, roomId, userId, payload } = await request.json();

  if (!ABLY_API_KEY) {
    return NextResponse.json({ error: "Ably not configured" }, { status: 500 });
  }

  try {
    switch (action) {
      case "rollDice": {
        // Validate player in room
        const { data: player } = await supabaseAdmin
          .from("room_players")
          .select("player_index")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!player) {
          return NextResponse.json({ error: "Not in this room" }, { status: 403 });
        }

        // Get game state
        const { data: gameState } = await supabaseAdmin
          .from("room_games")
          .select("turn, phase")
          .eq("room_id", roomId)
          .maybeSingle();

        if (!gameState || player.player_index !== gameState.turn) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 });
        }

        // Generate server-side dice result
        const diceResults = [Math.floor(Math.random() * 6) + 1];
        const diceValue = diceResults[0];

        // Update Supabase
        await supabaseAdmin
          .from("room_games")
          .update({
            dice_value: diceValue,
            dice_results: diceResults,
            phase: "moving",
          })
          .eq("room_id", roomId);

        // Broadcast via Ably
        await publishGameEvent(ABLY_API_KEY, roomId, {
          type: "dice_rolled",
          roomId,
          payload: { diceValue, diceResults, playerIndex: player.player_index },
          timestamp: Date.now(),
        });

        return NextResponse.json({ diceValue, diceResults });
      }

      case "movePlayer": {
        const { position, lapCount, targetPlayerIndex } = payload;

        // Update player position in Supabase
        const updateQuery = supabaseAdmin
          .from("room_players")
          .update({ position, lap: lapCount })
          .eq("room_id", roomId);

        if (targetPlayerIndex !== undefined) {
          await updateQuery.eq("player_index", targetPlayerIndex);
        } else {
          await updateQuery.eq("user_id", userId);
        }

        // Broadcast via Ably
        await publishGameEvent(ABLY_API_KEY, roomId, {
          type: "player_moved",
          roomId,
          payload: { userId, position, lapCount, targetPlayerIndex },
          timestamp: Date.now(),
        });

        return NextResponse.json({ success: true });
      }

      case "endTurn": {
        // Get current game state
        const { data: gameState } = await supabaseAdmin
          .from("room_games")
          .select("turn, num_players")
          .eq("room_id", roomId)
          .maybeSingle();

        if (!gameState) {
          return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }

        const nextTurn = (gameState.turn + 1) % gameState.num_players;

        await supabaseAdmin
          .from("room_games")
          .update({ turn: nextTurn, phase: "playing", dice_value: null, dice_results: null })
          .eq("room_id", roomId);

        await publishGameEvent(ABLY_API_KEY, roomId, {
          type: "turn_changed",
          roomId,
          payload: { newTurn: nextTurn },
          timestamp: Date.now(),
        });

        return NextResponse.json({ newTurn: nextTurn });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Ably API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
