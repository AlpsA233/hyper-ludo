// 游戏阶段类型
export type GamePhase =
  | "setup"
  | "settings"
  | "playing"
  | "config_cards"
  | "config_events"
  | "config_manager"
  | "event"
  | "win";

// 玩家颜色配置
export interface ColorConfig {
  name: string;
  hex: string;
}

// 卡牌效果
export interface CardEffect {
  move?: number;
  skip?: boolean;
  restart?: boolean;
}

// 卡牌
export interface Card {
  id: number;
  rarity: "NR" | "R" | "SR" | "SSR";
  name: string;
  desc: string;
  pattern: string;
  target: "SELF" | "PICK_ONE" | "RANDOM_OTHER" | "ALL_OTHERS";
  effect: CardEffect;
  instanceId?: number;
}

// 游戏事件
export interface GameEvent {
  id: number;
  text: string;
  type: "MOVE" | "SKIP" | "NONE" | "RESTART_LAP";
  target: "SELF" | "ALL_PLAYERS" | "RANDOM_OTHER";
  val: number;
  color?: string; // 事件颜色标识
}

// 玩家
export interface Player {
  id: number;
  color: ColorConfig;
  pos: number;
  lap: number;
  startPos: number; // 记录玩家的起始位置，用于正确计算圈数
  shield: boolean;
  skipTurn: boolean;
  cards: Card[];
  avatar?: string; // 玩家头像（emoji或图片URL）
}

// 背景设置
export interface BackgroundSettings {
  type: "color" | "image";
  value: string; // 颜色值或图片URL
}

// 棋盘瓦片
export interface BoardTile {
  id: "SAFE" | "CUSTOM";
}

// 坐标
export interface Position {
  x: number;
  y: number;
}
