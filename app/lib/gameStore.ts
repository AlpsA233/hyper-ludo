/**
 * Redis-backed game state store (Upstash via @vercel/kv).
 * Shared across all Vercel serverless function invocations.
 *
 * Keys:
 *   room:{id}           → RoomInfo (TTL 24h)
 *   code:{code}         → roomId   (TTL 24h)
 *   players:{roomId}    → RoomPlayer[] (TTL 24h)
 *   game:{roomId}       → GameState (TTL 24h)
 */

import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

const TTL = 60 * 60 * 24; // 24 hours

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
}

// ── Room ──────────────────────────────────────────────────────────
export async function getRoom(roomId: string): Promise<RoomInfo | null> {
  return kv.get<RoomInfo>(`room:${roomId}`);
}
export async function setRoom(room: RoomInfo): Promise<void> {
  await kv.set(`room:${room.id}`, room, { ex: TTL });
}
export async function deleteRoom(room: RoomInfo): Promise<void> {
  await Promise.all([
    kv.del(`room:${room.id}`),
    kv.del(`code:${room.room_code}`),
  ]);
}

// ── Room code lookup ──────────────────────────────────────────────
export async function getRoomIdByCode(code: string): Promise<string | null> {
  return kv.get<string>(`code:${code}`);
}
export async function setRoomCode(code: string, roomId: string): Promise<void> {
  await kv.set(`code:${code}`, roomId, { ex: TTL });
}

// ── Players ───────────────────────────────────────────────────────
export async function getPlayers(roomId: string): Promise<RoomPlayer[]> {
  return (await kv.get<RoomPlayer[]>(`players:${roomId}`)) ?? [];
}
export async function setPlayers(roomId: string, players: RoomPlayer[]): Promise<void> {
  await kv.set(`players:${roomId}`, players, { ex: TTL });
}
export async function deletePlayers(roomId: string): Promise<void> {
  await kv.del(`players:${roomId}`);
}

// ── Game state ────────────────────────────────────────────────────
export async function getGameState(roomId: string): Promise<GameState | null> {
  return kv.get<GameState>(`game:${roomId}`);
}
export async function setGameState(roomId: string, state: GameState): Promise<void> {
  await kv.set(`game:${roomId}`, state, { ex: TTL });
}
export async function deleteGameState(roomId: string): Promise<void> {
  await kv.del(`game:${roomId}`);
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
