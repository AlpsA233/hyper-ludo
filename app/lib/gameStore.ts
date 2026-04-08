/**
 * Hybrid game state store:
 *   - Local dev (no KV_REST_API_URL): in-memory Maps (fast, zero network)
 *   - Production (Vercel): Upstash Redis via @vercel/kv (shared across instances)
 *
 * Redis keys (TTL 24h):
 *   room:{id}        → RoomInfo
 *   code:{code}      → roomId
 *   players:{roomId} → RoomPlayer[]
 *   game:{roomId}    → GameState
 */

import { randomUUID } from "crypto";

const TTL = 60 * 60 * 24; // 24 hours

// ── Detect environment ────────────────────────────────────────────
const USE_REDIS = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN &&
  process.env.KV_REST_API_URL !== "" &&
  !process.env.KV_REST_API_URL.includes("localhost")
);

// ── In-memory fallback (local dev) ────────────────────────────────
const memRooms = new Map<string, RoomInfo>();
const memCodes = new Map<string, string>();
const memPlayers = new Map<string, RoomPlayer[]>();
const memGames = new Map<string, GameState>();

// ── Lazy Redis import (only when needed) ──────────────────────────
async function getKv() {
  const { kv } = await import("@vercel/kv");
  return kv;
}

export interface RoomInfo {
  id: string;
  room_code: string;
  creator_id: string;
  state: "waiting" | "playing" | "finished";
  num_players: number;
  dice_count: number;
  laps_to_win: number;
  initial_cards: number;
  event_density: number;
  current_players: number;
  created_at: string;
  updated_at: string;
  // Room lifecycle
  actively_left_players?: string[]; // user_ids permanently banned from re-joining
  paused_until?: string; // ISO timestamp when pause expires
  disconnected_players?: Array<{ user_id: string; player_index: number }>;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  user_id: string;
  player_index: number;
  player_name: string;
  avatar: string;
  color_index: number;
  position: number;
  lap: number;
  skip_turn: boolean;
  cards: any[];
  shield: boolean;
  disconnected?: boolean; // temporarily disconnected (not actively left)
  actively_left?: boolean; // permanently left mid-game
  finish_rank?: number; // assigned rank when they left
}

export interface GameState {
  room_id: string;
  turn: number;
  phase: string;
  dice_value: number | null;
  dice_results: number[] | null;
  active_event: any | null;
  active_card: any | null;
  logs: string[];
  board_tiles: Array<{ id: string }>;
  card_database: any[];
  event_database: any[];
}

// ── Room ──────────────────────────────────────────────────────────
export async function getRoom(roomId: string): Promise<RoomInfo | null> {
  if (!USE_REDIS) return memRooms.get(roomId) ?? null;
  return (await getKv()).get<RoomInfo>(`room:${roomId}`);
}
export async function setRoom(room: RoomInfo): Promise<void> {
  if (!USE_REDIS) {
    memRooms.set(room.id, room);
    return;
  }
  await (await getKv()).set(`room:${room.id}`, room, { ex: TTL });
}
export async function deleteRoom(room: RoomInfo): Promise<void> {
  if (!USE_REDIS) {
    memRooms.delete(room.id);
    memCodes.delete(room.room_code);
    return;
  }
  const kv = await getKv();
  await Promise.all([
    kv.del(`room:${room.id}`),
    kv.del(`code:${room.room_code}`),
  ]);
}

// ── Room code lookup ──────────────────────────────────────────────
export async function getRoomIdByCode(code: string): Promise<string | null> {
  if (!USE_REDIS) return memCodes.get(code) ?? null;
  return (await getKv()).get<string>(`code:${code}`);
}
export async function setRoomCode(code: string, roomId: string): Promise<void> {
  if (!USE_REDIS) {
    memCodes.set(code, roomId);
    return;
  }
  await (await getKv()).set(`code:${code}`, roomId, { ex: TTL });
}

// ── Players ───────────────────────────────────────────────────────
export async function getPlayers(roomId: string): Promise<RoomPlayer[]> {
  if (!USE_REDIS) return memPlayers.get(roomId) ?? [];
  return (await (await getKv()).get<RoomPlayer[]>(`players:${roomId}`)) ?? [];
}
export async function setPlayers(
  roomId: string,
  players: RoomPlayer[],
): Promise<void> {
  if (!USE_REDIS) {
    memPlayers.set(roomId, players);
    return;
  }
  await (await getKv()).set(`players:${roomId}`, players, { ex: TTL });
}
export async function deletePlayers(roomId: string): Promise<void> {
  if (!USE_REDIS) {
    memPlayers.delete(roomId);
    return;
  }
  await (await getKv()).del(`players:${roomId}`);
}

// ── Game state ────────────────────────────────────────────────────
export async function getGameState(roomId: string): Promise<GameState | null> {
  if (!USE_REDIS) return memGames.get(roomId) ?? null;
  return (await getKv()).get<GameState>(`game:${roomId}`);
}
export async function setGameState(
  roomId: string,
  state: GameState,
): Promise<void> {
  if (!USE_REDIS) {
    memGames.set(roomId, state);
    return;
  }
  await (await getKv()).set(`game:${roomId}`, state, { ex: TTL });
}
export async function deleteGameState(roomId: string): Promise<void> {
  if (!USE_REDIS) {
    memGames.delete(roomId);
    return;
  }
  await (await getKv()).del(`game:${roomId}`);
}

// ── Utilities ─────────────────────────────────────────────────────
export function generateRoomCode(): string {
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

export function genId(): string {
  return randomUUID();
}
