import type * as Party from "partykit/server";
import type { BoardTile, GameEvent, Card } from "../app/types";

/**
 * PartyKit WebSocket Server for Hyper Ludo
 * 
 * Responsibilities:
 * - Manage game room state (authoritative)
 * - Generate server-side dice rolls
 * - Handle turn transitions
 * - Broadcast state changes to all connected clients
 */

// 游戏阶段
type GamePhase = "waiting" | "playing" | "moving" | "event" | "win";

// 玩家状态
interface PlayerState {
  id: string;
  playerIndex: number;
  playerName: string;
  avatar: string;
  colorIndex: number;
  position: number;
  lap: number;
  skipTurn?: boolean;
  cards?: Card[];
  connected: boolean;
}

// 连接信息
interface ConnectionState {
  userId: string;
  playerIndex: number | null;
  playerName: string;
  roomId: string;
}

// 房间状态
interface RoomState {
  id: string;
  boardTiles: BoardTile[];
  players: Map<string, PlayerState>;
  currentTurn: number;
  phase: GamePhase;
  diceValue: number | null;
  diceResults: number[];
  diceRollerIndex: number | null;
  activeEvent: GameEvent | null;
  activeCard: Card | null;
  lapsToWin: number;
  totalSteps: number;
  numPlayers: number;
  eventDensity: number;
  winner: number | null;
  logs: string[];
}

// 消息类型定义
type ClientMessage =
  | { type: "join"; payload: { userId: string; playerName: string; playerIndex: number; colorIndex: number; avatar: string } }
  | { type: "start_game"; payload: { lapsToWin: number; eventDensity: number } }
  | { type: "roll_dice"; payload: { playerIndex: number; diceCount: number } }
  | { type: "move_done"; payload: { playerIndex: number; position: number; lap: number } }
  | { type: "event_confirm"; payload: { playerIndex: number } }
  | { type: "use_card"; payload: { playerIndex: number; card: Card; targetIndex?: number } }
  | { type: "sync_state"; payload: { roomId: string } };

type ServerMessage =
  | { type: "player_joined"; payload: { players: PlayerState[] } }
  | { type: "player_left"; payload: { playerIndex: number; players: PlayerState[] } }
  | { type: "game_start"; payload: { boardTiles: BoardTile[]; players: PlayerState[]; currentTurn: number; numPlayers: number; lapsToWin: number } }
  | { type: "dice_rolled"; payload: { playerIndex: number; diceValue: number; diceResults: number[]; currentTurn: number; phase: GamePhase } }
  | { type: "player_moved"; payload: { playerIndex: number; position: number; lap: number; players: PlayerState[]; phase: GamePhase } }
  | { type: "event_triggered"; payload: { playerIndex: number; event: GameEvent; players: PlayerState[]; phase: GamePhase } }
  | { type: "event_applied"; payload: { players: PlayerState[]; currentTurn: number; phase: GamePhase } }
  | { type: "card_used"; payload: { playerIndex: number; card: Card; players: PlayerState[]; phase: GamePhase } }
  | { type: "turn_ended"; payload: { currentTurn: number; phase: GamePhase } }
  | { type: "game_win"; payload: { winnerIndex: number } }
  | { type: "state_sync"; payload: { roomState: Omit<RoomState, 'players'> & { players: PlayerState[] }; connectionCount: number } }
  | { type: "error"; payload: { message: string } }
  | { type: "log"; payload: { message: string } };

/**
 * 骰子事件数据库（简化版，用于服务器端事件生成）
 */
const SERVER_EVENTS: GameEvent[] = [
  { id: 1, text: "Lucky! Move forward 3 steps", type: "MOVE", target: "SELF", val: 3, color: "#22c55e" },
  { id: 2, text: "Misfortune! Move back 2 steps", type: "MOVE", target: "SELF", val: -2, color: "#ef4444" },
  { id: 3, text: "Energy Drain! Skip this turn", type: "SKIP", target: "SELF", val: 0, color: "#f97316" },
  { id: 4, text: "Oops! Restart this lap", type: "RESTART_LAP", target: "SELF", val: 0, color: "#8b5cf6" },
  { id: 5, text: "Chaos! All players move back 1", type: "MOVE", target: "ALL_PLAYERS", val: -1, color: "#ec4899" },
  { id: 6, text: "Fortune! Move forward 5 steps", type: "MOVE", target: "SELF", val: 5, color: "#22c55e" },
];

export default class LudoParty implements Party.Server {
  private room: RoomState | null = null;
  private connections: Map<string, ConnectionState> = new Map();

  constructor(readonly roomId: string) {
    console.log(`[PartyKit] Room ${roomId} created`);
  }

  /**
   * 客户端连接
   */
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[PartyKit] Client connected: ${conn.id} to room ${this.roomId}`);
    
    // 发送当前房间状态（如果存在）
    if (this.room) {
      const msg: ServerMessage = {
        type: "state_sync",
        payload: {
          roomState: this.serializeRoomState(),
          connectionCount: this.connections.size,
        },
      };
      conn.send(JSON.stringify(msg));
    }
  }

  /**
   * 客户端断开
   */
  async onClose(conn: Party.Connection) {
    console.log(`[PartyKit] Client disconnected: ${conn.id}`);
    
    const connState = this.connections.get(conn.id);
    if (!connState) return;

    if (this.room) {
      const playerIndex = connState.playerIndex;
      if (playerIndex !== null && this.room.players.has(conn.id)) {
        // 标记玩家为断线状态，不完全移除（保留座位）
        const player = this.room.players.get(conn.id)!;
        player.connected = false;
        
        // 广播玩家断线
        const msg: ServerMessage = {
          type: "player_left",
          payload: {
            playerIndex,
            players: this.getPlayersArray(),
          },
        };
        this.broadcast(msg);
      }
    }

    this.connections.delete(conn.id);
  }

  /**
   * 处理客户端消息
   */
  async onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      console.error("[PartyKit] Invalid message format");
      return;
    }

    console.log(`[PartyKit] Received message: ${msg.type} from ${sender.id}`);

    switch (msg.type) {
      case "join":
        await this.handleJoin(sender, msg.payload);
        break;
      case "start_game":
        await this.handleStartGame(sender, msg.payload);
        break;
      case "roll_dice":
        await this.handleRollDice(sender, msg.payload);
        break;
      case "move_done":
        await this.handleMoveDone(sender, msg.payload);
        break;
      case "event_confirm":
        await this.handleEventConfirm(sender, msg.payload);
        break;
      case "use_card":
        await this.handleUseCard(sender, msg.payload);
        break;
      case "sync_state":
        await this.handleSyncState(sender);
        break;
      default:
        this.sendError(sender, `Unknown message type`);
    }
  }

  /**
   * 处理玩家加入
   */
  private async handleJoin(
    conn: Party.Connection,
    payload: { userId: string; playerName: string; playerIndex: number; colorIndex: number; avatar: string }
  ) {
    // 初始化房间（如果还没初始化）
    if (!this.room) {
      this.room = {
        id: this.roomId,
        boardTiles: [],
        players: new Map(),
        currentTurn: 0,
        phase: "waiting",
        diceValue: null,
        diceResults: [],
        diceRollerIndex: null,
        activeEvent: null,
        activeCard: null,
        lapsToWin: 3,
        totalSteps: 40,
        numPlayers: 4,
        eventDensity: 40,
        winner: null,
        logs: [],
      };
    }

    // 存储连接状态
    this.connections.set(conn.id, {
      userId: payload.userId,
      playerIndex: payload.playerIndex,
      playerName: payload.playerName,
      roomId: this.roomId,
    });

    // 添加或更新玩家
    const playerState: PlayerState = {
      id: payload.userId,
      playerIndex: payload.playerIndex,
      playerName: payload.playerName,
      avatar: payload.avatar,
      colorIndex: payload.colorIndex,
      position: -1,
      lap: 0,
      skipTurn: false,
      connected: true,
    };
    this.room.players.set(conn.id, playerState);

    console.log(`[PartyKit] Player joined: ${payload.playerName} (${payload.playerIndex}) in room ${this.roomId}`);

    // 广播玩家加入
    const joinMsg: ServerMessage = {
      type: "player_joined",
      payload: {
        players: this.getPlayersArray(),
      },
    };
    this.broadcast(joinMsg);

    // 同步状态给新加入的玩家
    if (this.room.phase !== "waiting") {
      const syncMsg: ServerMessage = {
        type: "state_sync",
        payload: {
          roomState: this.serializeRoomState(),
          connectionCount: this.connections.size,
        },
      };
      conn.send(JSON.stringify(syncMsg));
    }
  }

  /**
   * 处理游戏开始
   */
  private async handleStartGame(
    conn: Party.Connection,
    payload: { lapsToWin: number; eventDensity: number }
  ) {
    if (!this.room) return;

    const connState = this.connections.get(conn.id);
    if (!connState) {
      this.sendError(conn, "Not connected to room");
      return;
    }

    // 检查是否是房主（playerIndex 0）
    if (connState.playerIndex !== 0) {
      this.sendError(conn, "Only room creator can start the game");
      return;
    }

    // 生成棋盘
    const numPlayers = this.room.numPlayers;
    const totalSteps = numPlayers * 10;
    this.room.totalSteps = totalSteps;
    this.room.lapsToWin = payload.lapsToWin;
    this.room.eventDensity = payload.eventDensity;

    this.room.boardTiles = Array.from({ length: totalSteps }).map((_, i) => {
      const tilesPerPlayer = totalSteps / numPlayers;
      if (i % tilesPerPlayer < 2) {
        return { id: "SAFE" };
      }
      return Math.random() * 100 < payload.eventDensity
        ? { id: "CUSTOM" }
        : { id: "SAFE" };
    });

    // 重置玩家位置
    for (const [, player] of this.room.players) {
      player.position = -1;
      player.lap = 0;
      player.skipTurn = false;
    }

    this.room.currentTurn = 0;
    this.room.phase = "playing";
    this.room.diceValue = null;
    this.room.diceResults = [];
    this.room.activeEvent = null;
    this.room.winner = null;
    this.room.logs = [];

    console.log(`[PartyKit] Game started in room ${this.roomId}`, {
      boardTiles: this.room.boardTiles.length,
      players: this.getPlayersArray().length,
    });

    // 广播游戏开始
    const startMsg: ServerMessage = {
      type: "game_start",
      payload: {
        boardTiles: this.room.boardTiles,
        players: this.getPlayersArray(),
        currentTurn: 0,
        numPlayers,
        lapsToWin: payload.lapsToWin,
      },
    };
    this.broadcast(startMsg);
  }

  /**
   * 处理掷骰子
   */
  private async handleRollDice(
    conn: Party.Connection,
    payload: { playerIndex: number; diceCount: number }
  ) {
    if (!this.room) return;

    const connState = this.connections.get(conn.id);
    if (!connState) {
      this.sendError(conn, "Not connected to room");
      return;
    }

    // 验证是否是当前回合玩家
    if (payload.playerIndex !== this.room.currentTurn) {
      this.sendError(conn, "Not your turn");
      return;
    }

    // 验证阶段
    if (this.room.phase !== "playing") {
      this.sendError(conn, "Cannot roll dice in current phase");
      return;
    }

    // 服务器端生成骰子结果（权威）
    const diceResults = Array.from(
      { length: payload.diceCount },
      () => Math.floor(Math.random() * 6) + 1
    );
    const diceValue = diceResults.reduce((a, b) => a + b, 0);

    console.log(`[PartyKit] Dice rolled by player ${payload.playerIndex}:`, { diceValue, diceResults });

    this.room.diceValue = diceValue;
    this.room.diceResults = diceResults;
    this.room.diceRollerIndex = payload.playerIndex;
    this.room.phase = "moving";

    // 广播骰子结果
    const diceMsg: ServerMessage = {
      type: "dice_rolled",
      payload: {
        playerIndex: payload.playerIndex,
        diceValue,
        diceResults,
        currentTurn: this.room.currentTurn,
        phase: "moving",
      },
    };
    this.broadcast(diceMsg);
  }

  /**
   * 处理移动完成
   */
  private async handleMoveDone(
    conn: Party.Connection,
    payload: { playerIndex: number; position: number; lap: number }
  ) {
    if (!this.room) return;

    const connState = this.connections.get(conn.id);
    if (!connState) {
      this.sendError(conn, "Not connected to room");
      return;
    }

    // 验证玩家
    if (payload.playerIndex !== this.room.currentTurn) {
      this.sendError(conn, "Not your turn");
      return;
    }

    // 更新玩家位置
    let playerKey: string | null = null;
    for (const [key, player] of this.room.players) {
      if (player.playerIndex === payload.playerIndex) {
        player.position = payload.position;
        player.lap = payload.lap;
        playerKey = key;
        break;
      }
    }

    // 检查是否胜利
    if (payload.lap >= this.room.lapsToWin) {
      this.room.winner = payload.playerIndex;
      this.room.phase = "win";

      const winMsg: ServerMessage = {
        type: "game_win",
        payload: { winnerIndex: payload.playerIndex },
      };
      this.broadcast(winMsg);
      return;
    }

    // 检查是否落在事件格子上
    if (payload.position !== -1 && this.room.boardTiles[payload.position]?.id === "CUSTOM") {
      // 随机选择事件
      const event = SERVER_EVENTS[Math.floor(Math.random() * SERVER_EVENTS.length)];
      this.room.activeEvent = event;
      this.room.phase = "event";

      const eventMsg: ServerMessage = {
        type: "event_triggered",
        payload: {
          playerIndex: payload.playerIndex,
          event,
          players: this.getPlayersArray(),
          phase: "event",
        },
      };
      this.broadcast(eventMsg);
      return;
    }

    // 正常回合结束，推进到下一个玩家
    this.advanceTurn();

    const endMsg: ServerMessage = {
      type: "turn_ended",
      payload: {
        currentTurn: this.room.currentTurn,
        phase: this.room.phase,
      },
    };
    this.broadcast(endMsg);
  }

  /**
   * 处理事件确认
   */
  private async handleEventConfirm(
    conn: Party.Connection,
    payload: { playerIndex: number }
  ) {
    if (!this.room) return;

    const connState = this.connections.get(conn.id);
    if (!connState) {
      this.sendError(conn, "Not connected to room");
      return;
    }

    if (this.room.phase !== "event") {
      this.sendError(conn, "No active event");
      return;
    }

    const event = this.room.activeEvent;
    if (!event) return;

    // 应用事件效果
    if (event.type === "MOVE" && event.val !== 0) {
      // 查找当前玩家
      for (const [, player] of this.room.players) {
        if (player.playerIndex === payload.playerIndex) {
          const newPosition = this.calculateNewPosition(player, event.val);
          player.position = newPosition.pos;
          player.lap = newPosition.lap;
          break;
        }
      }
    } else if (event.type === "SKIP") {
      // 设置跳过状态
      for (const [, player] of this.room.players) {
        if (player.playerIndex === payload.playerIndex) {
          player.skipTurn = true;
          break;
        }
      }
    } else if (event.type === "RESTART_LAP") {
      // 回到本圈起点
      for (const [, player] of this.room.players) {
        if (player.playerIndex === payload.playerIndex) {
          const lapStartDistance = player.lap * this.room.totalSteps;
          player.position = (player.position + lapStartDistance) % this.room.totalSteps;
          break;
        }
      }
    } else if (event.type === "MOVE" && event.target === "ALL_PLAYERS") {
      // 对所有玩家应用移动
      for (const [, player] of this.room.players) {
        const newPosition = this.calculateNewPosition(player, event.val);
        player.position = newPosition.pos;
        player.lap = newPosition.lap;
      }
    }

    // 清除事件
    this.room.activeEvent = null;
    this.room.diceValue = null;
    this.room.diceResults = [];

    // 推进回合
    this.advanceTurn();

    const appliedMsg: ServerMessage = {
      type: "event_applied",
      payload: {
        players: this.getPlayersArray(),
        currentTurn: this.room.currentTurn,
        phase: this.room.phase,
      },
    };
    this.broadcast(appliedMsg);
  }

  /**
   * 处理使用卡牌
   */
  private async handleUseCard(
    conn: Party.Connection,
    payload: { playerIndex: number; card: Card; targetIndex?: number }
  ) {
    if (!this.room) return;

    const connState = this.connections.get(conn.id);
    if (!connState) {
      this.sendError(conn, "Not connected to room");
      return;
    }

    // 应用卡牌效果
    if (payload.card.effect.move) {
      for (const [, player] of this.room.players) {
        if (player.playerIndex === payload.playerIndex) {
          const newPosition = this.calculateNewPosition(player, payload.card.effect.move!);
          player.position = newPosition.pos;
          player.lap = newPosition.lap;
          break;
        }
      }
    } else if (payload.card.effect.skip) {
      if (payload.targetIndex !== undefined) {
        for (const [, player] of this.room.players) {
          if (player.playerIndex === payload.targetIndex) {
            player.skipTurn = true;
            break;
          }
        }
      }
    } else if (payload.card.effect.restart) {
      for (const [, player] of this.room.players) {
        if (player.playerIndex === payload.playerIndex) {
          player.position = -1;
          player.lap = 0;
          break;
        }
      }
    }

    this.room.activeCard = payload.card;
    this.room.phase = "playing";

    const cardMsg: ServerMessage = {
      type: "card_used",
      payload: {
        playerIndex: payload.playerIndex,
        card: payload.card,
        players: this.getPlayersArray(),
        phase: "playing",
      },
    };
    this.broadcast(cardMsg);
  }

  /**
   * 处理状态同步请求
   */
  private async handleSyncState(conn: Party.Connection) {
    if (!this.room) {
      this.sendError(conn, "Room not initialized");
      return;
    }

    const syncMsg: ServerMessage = {
      type: "state_sync",
      payload: {
        roomState: this.serializeRoomState(),
        connectionCount: this.connections.size,
      },
    };
    conn.send(JSON.stringify(syncMsg));
  }

  /**
   * 推进到下一个玩家
   */
  private advanceTurn() {
    if (!this.room) return;

    do {
      this.room.currentTurn = (this.room.currentTurn + 1) % this.room.numPlayers;
    } while (this.shouldSkipTurn(this.room.currentTurn));

    this.room.phase = "playing";
    this.room.diceValue = null;
    this.room.diceResults = [];
  }

  /**
   * 检查是否应该跳过回合
   */
  private shouldSkipTurn(playerIndex: number): boolean {
    if (!this.room) return false;

    for (const [, player] of this.room.players) {
      if (player.playerIndex === playerIndex && player.skipTurn) {
        player.skipTurn = false;
        return true;
      }
    }
    return false;
  }

  /**
   * 计算新位置
   */
  private calculateNewPosition(player: PlayerState, steps: number): { pos: number; lap: number } {
    if (!this.room) return { pos: player.position, lap: player.lap };

    const totalSteps = this.room.totalSteps;

    if (player.position === -1) {
      const totalDistance = Math.max(0, steps);
      return {
        pos: (totalDistance % totalSteps),
        lap: Math.floor(totalDistance / totalSteps),
      };
    }

    const currentDistance = player.lap * totalSteps + player.position;
    const totalDistance = Math.max(0, currentDistance + steps);

    return {
      pos: totalDistance % totalSteps,
      lap: Math.floor(totalDistance / totalSteps),
    };
  }

  /**
   * 获取玩家数组
   */
  private getPlayersArray(): PlayerState[] {
    if (!this.room) return [];
    return Array.from(this.room.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
  }

  /**
   * 序列化房间状态（用于同步）
   */
  private serializeRoomState() {
    if (!this.room) throw new Error("Room not initialized");

    return {
      id: this.room.id,
      boardTiles: this.room.boardTiles,
      players: this.getPlayersArray(),
      currentTurn: this.room.currentTurn,
      phase: this.room.phase,
      diceValue: this.room.diceValue,
      diceResults: this.room.diceResults,
      diceRollerIndex: this.room.diceRollerIndex,
      activeEvent: this.room.activeEvent,
      activeCard: this.room.activeCard,
      lapsToWin: this.room.lapsToWin,
      totalSteps: this.room.totalSteps,
      numPlayers: this.room.numPlayers,
      eventDensity: this.room.eventDensity,
      winner: this.room.winner,
      logs: this.room.logs,
    };
  }

  /**
   * 广播消息给所有连接
   */
  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const conn of this.getConnections()) {
      conn.send(data);
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(conn: Party.Connection, message: string) {
    const errorMsg: ServerMessage = {
      type: "error",
      payload: { message },
    };
    conn.send(JSON.stringify(errorMsg));
  }

  /**
   * 获取所有连接
   */
  private getConnections(): Party.Connection[] {
    // PartyKit 会在运行时提供 connections
    return (this as any).ctx?.connections 
      ? Array.from((this as any).ctx.connections)
      : [];
  }
}

// Export empty object for module system
export {};
