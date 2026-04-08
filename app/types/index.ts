// 游戏阶段类型
export type GamePhase =
  | "auth"
  | "setup"
  | "settings"
  | "room_select" // 新增：房间选择（创建/加入房间）
  | "room_lobby" // 新增：房间大厅（等待玩家）
  | "playing"
  | "multiplayer" // 新增：多人游戏模式
  | "config_cards"
  | "config_events"
  | "config_manager"
  | "library_manager"
  | "event"
  | "paused"
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

// 游戏事件进度范围
export interface ProgressRange {
  min: number; // 0-100，游戏进度百分比下限
  max: number; // 0-100，游戏进度百分比上限
}

// 游戏事件
export interface GameEvent {
  id: number;
  text: string;
  type: "MOVE" | "SKIP" | "NONE" | "RESTART_LAP";
  target: "SELF" | "ALL_PLAYERS" | "RANDOM_OTHER";
  val: number;
  color?: string; // 事件颜色标识
  progressRange?: ProgressRange; // 允许出现的游戏进度范围（百分比）
  limitPerPlayer?: number; // 每个玩家最多出现次数
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
  finished?: boolean; // 已完赛（到达目标圈数），仍留在棋盘但跳过其回合
  finishRank?: number; // 完赛排名（1=第一名，2=第二名…）
  activelyLeft?: boolean; // 主动退出房间，不受卡牌/事件影响，跳过其回合
  cards: Card[];
  avatar?: string; // 玩家头像（emoji或图片URL）
  name?: string; // 玩家名称
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
