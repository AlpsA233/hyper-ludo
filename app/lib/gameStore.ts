/**
 * In-memory game state store.
 * Works as a Node.js module singleton in Next.js dev server (single process).
 *
 * NOTE: For Vercel production (serverless), this memory is NOT shared across
 * function invocations. Add Upstash Redis or similar to persist state in prod.
 */

import { randomUUID } from "crypto";

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

// Module-level singletons
export const rooms = new Map<string, RoomInfo>();
export const roomPlayers = new Map<string, RoomPlayer[]>();
export const roomGames = new Map<string, GameState>();

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
