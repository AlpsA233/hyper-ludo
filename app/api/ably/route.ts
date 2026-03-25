import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Ably from "ably";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ABLY_API_KEY = process.env.ABLY_API_KEY!;

// Helper: publish state to Ably channel
async function publishState(
  roomId: string,
  eventType: string,
  payload: Record<string, any>
) {
  const ably = new Ably.Rest({ key: ABLY_API_KEY });
  const channel = ably.channels.get(`game:${roomId}`);
  await channel.publish(eventType, {
    type: eventType,
    roomId,
    payload,
    timestamp: Date.now(),
  });
}

// Helper: get full room state from Supabase
async function getFullRoomState(roomId: string) {
  const { data: gameState } = await supabaseAdmin
    .from("room_games")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  const { data: roomPlayers } = await supabaseAdmin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId);

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  return { gameState, roomPlayers: roomPlayers || [], room };
}

// Map DB player to PartyPlayer format
function mapPlayer(p: any) {
  return {
    id: p.user_id,
    playerIndex: p.player_index,
    playerName: p.player_name,
    avatar: p.avatar || "👤",
    colorIndex: p.color_index,
    position: p.position ?? -1,
    lap: p.lap ?? 0,
    skipTurn: p.skip_turn ?? false,
    cards: p.cards ?? [],
    connected: true,
  };
}

export async function POST(request: Request) {
  const { action, roomId, userId, payload } = await request.json();

  if (!ABLY_API_KEY) {
    return NextResponse.json({ error: "Ably not configured" }, { status: 500 });
  }

  // sync_state can work without userId (it's a read-only state fetch)
  if (!roomId || (!userId && action !== "sync_state")) {
    return NextResponse.json({ error: "Missing roomId or userId" }, { status: 400 });
  }

  try {
    // Validate user is in room
    const { data: player } = await supabaseAdmin
      .from("room_players")
      .select("player_index, player_name, avatar, color_index")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!player && action !== "sync_state") {
      return NextResponse.json({ error: "Not in this room" }, { status: 403 });
    }

    switch (action) {
      // ── Join ──────────────────────────────────────────────
      case "join": {
        const { playerName, playerIndex, colorIndex, avatar } = payload;

        // Upsert player (in case already exists)
        const { data: existing } = await supabaseAdmin
          .from("room_players")
          .select("player_index")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existing) {
          await supabaseAdmin.from("room_players").upsert({
            room_id: roomId,
            user_id: userId,
            player_index: playerIndex,
            player_name: playerName,
            avatar: avatar || "👤",
            color_index: colorIndex,
            position: -1,
            lap: 0,
            skip_turn: false,
          });
        }

        const { data: allPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        await publishState(roomId, "player_joined", {
          players: (allPlayers || []).map(mapPlayer),
        });

        return NextResponse.json({ success: true });
      }

      // ── Start Game ─────────────────────────────────────────
      case "start_game": {
        const { lapsToWin, eventDensity } = payload;

        // Verify creator
        const { data: room } = await supabaseAdmin
          .from("rooms")
          .select("creator_id, num_players")
          .eq("id", roomId)
          .maybeSingle();

        if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
        if (room.creator_id !== userId) {
          return NextResponse.json({ error: "Only creator can start" }, { status: 403 });
        }

        const numPlayers = room.num_players || 4;
        const totalSteps = numPlayers * 10;
        const boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
          const tilesPerPlayer = totalSteps / numPlayers;
          if (i % tilesPerPlayer < 2) return { id: "SAFE" as const };
          return Math.random() * 100 < eventDensity ? { id: "CUSTOM" as const } : { id: "SAFE" as const };
        });

        // Upsert game state
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
            dice_value: null,
            dice_results: [],
            active_event: null,
            active_card: null,
            laps_to_win: lapsToWin,
          });
        } else {
          await supabaseAdmin.from("room_games").update({
            turn: 0,
            phase: "playing",
            board_tiles: boardTiles,
            laps_to_win: lapsToWin,
            dice_value: null,
            dice_results: [],
            active_event: null,
            active_card: null,
          }).eq("room_id", roomId);
        }

        await supabaseAdmin.from("rooms").update({ state: "playing" }).eq("id", roomId);

        // Reset player positions
        await supabaseAdmin.from("room_players").update({
          position: -1,
          lap: 0,
          skip_turn: false,
        }).eq("room_id", roomId);

        const { data: allPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        const state = {
          id: roomId,
          boardTiles,
          players: (allPlayers || []).map(mapPlayer),
          currentTurn: 0,
          phase: "playing" as const,
          diceValue: null,
          diceResults: [] as number[],
          diceRollerIndex: null,
          activeEvent: null,
          activeCard: null,
          lapsToWin,
          totalSteps,
          numPlayers,
          eventDensity,
          winner: null,
          logs: [],
        };

        await publishState(roomId, "game_start", state);

        return NextResponse.json(state);
      }

      // ── Roll Dice ───────────────────────────────────────────
      case "roll_dice": {
        const { diceCount } = payload;

        if (!player || player.player_index === null) {
          return NextResponse.json({ error: "Not in room" }, { status: 403 });
        }

        const { data: gameState } = await supabaseAdmin
          .from("room_games")
          .select("turn, phase")
          .eq("room_id", roomId)
          .maybeSingle();

        if (!gameState) return NextResponse.json({ error: "Game not found" }, { status: 404 });
        if (player.player_index !== gameState.turn) {
          return NextResponse.json({ error: "Not your turn" }, { status: 403 });
        }
        if (gameState.phase !== "playing") {
          return NextResponse.json({ error: "Cannot roll in current phase" }, { status: 403 });
        }

        const diceResults = Array.from({ length: diceCount || 1 }, () => Math.floor(Math.random() * 6) + 1);
        const diceValue = diceResults.reduce((a, b) => a + b, 0);

        await supabaseAdmin.from("room_games").update({
          dice_value: diceValue,
          dice_results: diceResults,
          phase: "moving",
        }).eq("room_id", roomId);

        await publishState(roomId, "dice_rolled", {
          playerIndex: player.player_index,
          diceValue,
          diceResults,
          currentTurn: gameState.turn,
          phase: "moving",
        });

        return NextResponse.json({ diceValue, diceResults, currentTurn: gameState.turn });
      }

      // ── Move Done ──────────────────────────────────────────
      case "move_done": {
        const { position, lap } = payload;

        if (!player) return NextResponse.json({ error: "Not in room" }, { status: 403 });

        // Update player position
        await supabaseAdmin.from("room_players").update({
          position,
          lap,
        }).eq("room_id", roomId).eq("user_id", userId);

        const { data: gameState } = await supabaseAdmin
          .from("room_games")
          .select("turn, phase, board_tiles, laps_to_win")
          .eq("room_id", roomId)
          .maybeSingle();

        if (!gameState) return NextResponse.json({ error: "Game not found" }, { status: 404 });

        const { data: allPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        // Check win condition
        if (lap >= (gameState.laps_to_win || 3)) {
          await supabaseAdmin.from("room_games").update({
            phase: "win",
          }).eq("room_id", roomId);

          await supabaseAdmin.from("rooms").update({ state: "finished" }).eq("id", roomId);

          await publishState(roomId, "game_win", { winnerIndex: player.player_index });
          return NextResponse.json({ winnerIndex: player.player_index, phase: "win" });
        }

        // Check event tile
        const boardTiles: Array<{ id: string }> = gameState.board_tiles || [];
        const tile = boardTiles[position];
        if (position !== -1 && tile?.id === "CUSTOM") {
          const SERVER_EVENTS = [
            { id: 1, text: "Lucky! Move forward 3 steps", type: "MOVE", target: "SELF" as const, val: 3, color: "#22c55e" },
            { id: 2, text: "Misfortune! Move back 2 steps", type: "MOVE", target: "SELF" as const, val: -2, color: "#ef4444" },
            { id: 3, text: "Energy Drain! Skip this turn", type: "SKIP", target: "SELF" as const, val: 0, color: "#f97316" },
            { id: 4, text: "Oops! Restart this lap", type: "RESTART_LAP", target: "SELF" as const, val: 0, color: "#8b5cf6" },
            { id: 5, text: "Chaos! All players move back 1", type: "MOVE", target: "ALL_PLAYERS" as const, val: -1, color: "#ec4899" },
            { id: 6, text: "Fortune! Move forward 5 steps", type: "MOVE", target: "SELF" as const, val: 5, color: "#22c55e" },
          ];
          const event = SERVER_EVENTS[Math.floor(Math.random() * SERVER_EVENTS.length)];

          await supabaseAdmin.from("room_games").update({
            active_event: event,
            phase: "event",
          }).eq("room_id", roomId);

          await publishState(roomId, "event_triggered", {
            playerIndex: player.player_index,
            event,
            players: (allPlayers || []).map(mapPlayer),
            phase: "event",
          });
          return NextResponse.json({ event, phase: "event" });
        }

        // Normal turn end — advance to next player
        const numPlayers = (allPlayers || []).length;
        let nextTurn = (gameState.turn + 1) % numPlayers;

        // Check skip turn
        const nextPlayer = (allPlayers || []).find((p: any) => p.player_index === nextTurn);
        if (nextPlayer?.skip_turn) {
          await supabaseAdmin.from("room_players").update({ skip_turn: false }).eq("id", nextPlayer.id);
        }

        await supabaseAdmin.from("room_games").update({
          turn: nextTurn,
          phase: "playing",
          dice_value: null,
          dice_results: [],
        }).eq("room_id", roomId);

        await publishState(roomId, "turn_ended", {
          currentTurn: nextTurn,
          phase: "playing",
        });

        return NextResponse.json({ currentTurn: nextTurn, phase: "playing" });
      }

      // ── Confirm Event ──────────────────────────────────────
      case "event_confirm": {
        const { data: gameState } = await supabaseAdmin
          .from("room_games")
          .select("active_event, turn, phase")
          .eq("room_id", roomId)
          .maybeSingle();

        if (!gameState) return NextResponse.json({ error: "Game not found" }, { status: 404 });
        if (gameState.phase !== "event") {
          return NextResponse.json({ error: "No active event" }, { status: 403 });
        }

        const event = gameState.active_event as any;
        const currentTurn = gameState.turn;

        const { data: allPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        const numPlayers = (allPlayers || []).length;

        if (event?.type === "MOVE" && event.val !== 0) {
          for (const p of allPlayers || []) {
            if (event.target === "ALL_PLAYERS" || p.player_index === currentTurn) {
              const totalSteps = numPlayers * 10;
              const currentDistance = p.lap * totalSteps + p.position;
              const newDistance = Math.max(0, currentDistance + event.val);
              await supabaseAdmin.from("room_players").update({
                position: newDistance % totalSteps,
                lap: Math.floor(newDistance / totalSteps),
              }).eq("id", p.id);
            }
          }
        } else if (event?.type === "SKIP") {
          const currentPlayer = (allPlayers || []).find((p: any) => p.player_index === currentTurn);
          if (currentPlayer) {
            await supabaseAdmin.from("room_players").update({ skip_turn: true }).eq("id", currentPlayer.id);
          }
        }

        let nextTurn = (currentTurn + 1) % numPlayers;

        await supabaseAdmin.from("room_games").update({
          active_event: null,
          turn: nextTurn,
          phase: "playing",
          dice_value: null,
          dice_results: [],
        }).eq("room_id", roomId);

        const { data: updatedPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        await publishState(roomId, "event_applied", {
          players: (updatedPlayers || []).map(mapPlayer),
          currentTurn: nextTurn,
          phase: "playing",
        });

        return NextResponse.json({ currentTurn: nextTurn, phase: "playing" });
      }

      // ── Use Card ───────────────────────────────────────────
      case "use_card": {
        const { card, targetIndex } = payload;

        if (!player) return NextResponse.json({ error: "Not in room" }, { status: 403 });

        const { data: allPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        const cardEffect = card.effect || {};

        if (cardEffect.move !== undefined) {
          for (const p of allPlayers || []) {
            if (p.player_index === player.player_index) {
              const numPlayers = (allPlayers || []).length;
              const totalSteps = numPlayers * 10;
              const currentDistance = p.lap * totalSteps + p.position;
              const newDistance = Math.max(0, currentDistance + cardEffect.move);
              await supabaseAdmin.from("room_players").update({
                position: newDistance % totalSteps,
                lap: Math.floor(newDistance / totalSteps),
              }).eq("id", p.id);
            }
          }
        } else if (cardEffect.skip && targetIndex !== undefined) {
          const target = (allPlayers || []).find((p: any) => p.player_index === targetIndex);
          if (target) {
            await supabaseAdmin.from("room_players").update({ skip_turn: true }).eq("id", target.id);
          }
        } else if (cardEffect.restart) {
          const currentPlayer = (allPlayers || []).find((p: any) => p.player_index === player.player_index);
          if (currentPlayer) {
            await supabaseAdmin.from("room_players").update({
              position: -1,
              lap: 0,
            }).eq("id", currentPlayer.id);
          }
        }

        await supabaseAdmin.from("room_games").update({
          active_card: card,
          phase: "playing",
        }).eq("room_id", roomId);

        const { data: updatedPlayers } = await supabaseAdmin
          .from("room_players")
          .select("*")
          .eq("room_id", roomId);

        await publishState(roomId, "card_used", {
          playerIndex: player.player_index,
          card,
          players: (updatedPlayers || []).map(mapPlayer),
          phase: "playing",
        });

        return NextResponse.json({ success: true });
      }

      // ── State Sync ─────────────────────────────────────────
      case "sync_state": {
        const { gameState, roomPlayers } = await getFullRoomState(roomId);

        if (!gameState) {
          return NextResponse.json({ error: "Game not initialized" }, { status: 404 });
        }

        const { data: room } = await supabaseAdmin.from("rooms").select("*").eq("id", roomId).maybeSingle();

        const totalSteps = (room?.num_players || 4) * 10;

        const state = {
          id: roomId,
          boardTiles: gameState.board_tiles || [],
          players: roomPlayers.map(mapPlayer),
          currentTurn: gameState.turn,
          phase: gameState.phase,
          diceValue: gameState.dice_value,
          diceResults: gameState.dice_results || [],
          diceRollerIndex: null,
          activeEvent: gameState.active_event,
          activeCard: gameState.active_card,
          lapsToWin: gameState.laps_to_win,
          totalSteps,
          numPlayers: room?.num_players || 4,
          eventDensity: room?.event_density || 40,
          winner: gameState.phase === "win" ? gameState.active_card?.winnerIndex : null,
          logs: gameState.logs || [],
        };

        return NextResponse.json({
          roomState: state,
          connectionCount: roomPlayers.length,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[/api/ably] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
