import Ably from "ably";

// Ably client for real-time game state sync
// Uses Ably as a pub/sub transport, with Supabase as authoritative state store

let ablyClient: Ably.Realtime | null = null;

export function getAblyClient(apiKey: string): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({ key: apiKey });
  }
  return ablyClient;
}

export function getAblyRest(apiKey: string): Ably.Rest {
  return new Ably.Rest({ key: apiKey });
}

// Message types for game events
export interface GameEventMessage {
  type:
    | "player_joined"
    | "player_left"
    | "game_started"
    | "dice_rolled"
    | "player_moved"
    | "turn_changed"
    | "event_triggered"
    | "card_used"
    | "game_ended";
  roomId: string;
  payload: any;
  timestamp: number;
}

// Publish a game event to a channel
export async function publishGameEvent(
  apiKey: string,
  roomId: string,
  event: GameEventMessage
): Promise<void> {
  const ably = getAblyRest(apiKey);
  const channel = ably.channels.get(`game:${roomId}`);
  await channel.publish(event.type, event);
}

// Subscribe to game events on a channel
export function subscribeToGameEvents(
  apiKey: string,
  roomId: string,
  callback: (event: GameEventMessage) => void
): Ably.RealtimeChannel {
  const ably = getAblyClient(apiKey);
  const channel = ably.channels.get(`game:${roomId}`);
  
  channel.subscribe("*", (message) => {
    callback(message.data as GameEventMessage);
  });
  
  return channel;
}
