import type { Card, ColorConfig, GameEvent } from "@/app/types";

// 玩家颜色配置
export const COLORS: ColorConfig[] = [
  { name: "Red", hex: "#FF2A6D" },
  { name: "Blue", hex: "#05D9E8" },
  { name: "Green", hex: "#00FF9C" },
  { name: "Yellow", hex: "#FFD700" },
  { name: "Purple", hex: "#D355FF" },
  { name: "Orange", hex: "#FF8C00" },
  { name: "Cyan", hex: "#01F1F1" },
  { name: "Pink", hex: "#FF00CC" },
];

// 稀有度配置
export const RARITY_CONFIG = {
  NR: {
    label: "NR",
    color: "#94a3b8",
    bg: "bg-slate-500/20",
    border: "border-slate-500/50",
  },
  R: {
    label: "R",
    color: "#38bdf8",
    bg: "bg-sky-500/20",
    border: "border-sky-500/50",
  },
  SR: {
    label: "SR",
    color: "#fbbf24",
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
  },
  SSR: {
    label: "SSR",
    color: "#f472b6",
    bg: "bg-pink-500/20",
    border: "border-pink-500/50",
  },
} as const;

// 默认卡牌数据库
export const DEFAULT_CARD_DB: Card[] = [
  {
    id: 1,
    rarity: "NR",
    name: "信号干扰",
    desc: "使随机一名对手后退 3 格",
    pattern: "📡",
    target: "RANDOM_OTHER",
    effect: { move: -3 },
  },
  {
    id: 2,
    rarity: "R",
    name: "禁航指令",
    desc: "指定一名对手下回合暂停",
    pattern: "🚫",
    target: "PICK_ONE",
    effect: { skip: true },
  },
  {
    id: 5,
    rarity: "SSR",
    name: "降维打击",
    desc: "指定一名对手直接被撞回起点",
    pattern: "🌌",
    target: "PICK_ONE",
    effect: { restart: true },
  },
  {
    id: 6,
    rarity: "NR",
    name: "助燃剂",
    desc: "自己前进 4 格",
    pattern: "🔥",
    target: "SELF",
    effect: { move: 4 },
  },
];

// 默认事件数据库
export const DEFAULT_EVENT_DB: GameEvent[] = [
  {
    id: 1,
    text: "做十个俯卧撑",
    type: "MOVE",
    target: "SELF",
    val: 2,
    color: "#10b981",
    progressRange: { min: 0, max: 100 },
  },
  {
    id: 2,
    text: "喝半杯啤酒",
    type: "SKIP",
    target: "SELF",
    val: 0,
    color: "#f59e0b",
    progressRange: { min: 0, max: 100 },
  },
  {
    id: 3,
    text: "模仿一种动物叫声",
    type: "NONE",
    target: "SELF",
    val: 0,
    color: "#8b5cf6",
    progressRange: { min: 0, max: 100 },
  },
  {
    id: 4,
    text: "退回本圈起点",
    type: "RESTART_LAP",
    target: "SELF",
    val: 0,
    color: "#ef4444",
    progressRange: { min: 0, max: 100 },
  },
];
