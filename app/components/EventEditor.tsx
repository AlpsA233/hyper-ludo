"use client";

import React, { useState } from "react";
import { MessageSquare, Save, Trash2, Sparkles } from "lucide-react";
import type { GameEvent } from "@/app/types";
import type { Translations } from "@/app/locales";

interface EventEditorProps {
  events: GameEvent[];
  onSave: (events: GameEvent[]) => void;
  onCancel: () => void;
  t: Translations;
}

// 预设颜色选项
const EVENT_COLORS = [
  { name: "绿色", value: "#10b981" },
  { name: "蓝色", value: "#3b82f6" },
  { name: "紫色", value: "#8b5cf6" },
  { name: "粉色", value: "#ec4899" },
  { name: "红色", value: "#ef4444" },
  { name: "橙色", value: "#f59e0b" },
  { name: "黄色", value: "#eab308" },
  { name: "青色", value: "#06b6d4" },
];

export default function EventEditor({
  events,
  onSave,
  onCancel,
  t,
}: EventEditorProps) {
  const [editList, setEditList] = useState(events);
  const [newItem, setNewItem] = useState<Omit<GameEvent, "id">>({
    text: "",
    type: "NONE",
    target: "SELF",
    val: 0,
    color: EVENT_COLORS[0].value,
    progressRange: { min: 0, max: 100 },
  });

  const save = () => {
    onSave(editList);
  };

  const addEvent = () => {
    if (newItem.text.trim()) {
      setEditList([...editList, { ...newItem, id: Date.now() }]);
      setNewItem({
        text: "",
        type: "NONE",
        target: "SELF",
        val: 0,
        color: EVENT_COLORS[0].value,
        progressRange: { min: 0, max: 100 },
      });
    }
  };

  const getTargetDisplay = (target: GameEvent["target"]) => {
    switch (target) {
      case "SELF":
        return "当前玩家";
      case "ALL_PLAYERS":
        return "所有玩家";
      case "RANDOM_OTHER":
        return "随机其他玩家";
      default:
        return target;
    }
  };

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col animate-fade-in overflow-hidden">
      <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/60 flex-shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="text-purple-400" /> {t.eventEditor.title}
        </h2>
        <button
          onClick={save}
          className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
          <Save size={18} /> {t.eventEditor.save}
        </button>
      </div>
      <div className="p-4 flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              {t.eventEditor.createNew}
            </h3>

            {/* Event Content */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.eventEditor.content}
              </label>
              <textarea
                value={newItem.text}
                onChange={(e) =>
                  setNewItem({ ...newItem, text: e.target.value })
                }
                className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm h-24 outline-none focus:border-purple-500 transition-colors resize-none"
                placeholder={t.eventEditor.placeholder}
              />
            </div>

            {/* Color Selection */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-2">
                {t.eventEditor.color}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() =>
                      setNewItem({ ...newItem, color: color.value })
                    }
                    className={`h-10 rounded-lg transition-all border-2 ${
                      newItem.color === color.value
                        ? "border-white scale-110 shadow-lg"
                        : "border-transparent hover:border-white/30"
                    }`}
                    style={{
                      backgroundColor: color.value,
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Progress Range Selection */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-3">
                游戏进度范围 ({newItem.progressRange?.min || 0}% -{" "}
                {newItem.progressRange?.max || 100}%)
              </label>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] text-gray-600">开始</span>
                    <span className="text-sm font-bold text-cyan-400">
                      {newItem.progressRange?.min || 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newItem.progressRange?.min || 0}
                    onChange={(e) => {
                      const min = parseInt(e.target.value);
                      const max = newItem.progressRange?.max || 100;
                      if (min <= max) {
                        setNewItem({
                          ...newItem,
                          progressRange: { min, max },
                        });
                      }
                    }}
                    className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] text-gray-600">结束</span>
                    <span className="text-sm font-bold text-cyan-400">
                      {newItem.progressRange?.max || 100}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newItem.progressRange?.max || 100}
                    onChange={(e) => {
                      const max = parseInt(e.target.value);
                      const min = newItem.progressRange?.min || 0;
                      if (max >= min) {
                        setNewItem({
                          ...newItem,
                          progressRange: { min, max },
                        });
                      }
                    }}
                    className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
              <p className="text-[9px] text-gray-600 mt-3">
                事件在游戏进度 {newItem.progressRange?.min || 0}% 到{" "}
                {newItem.progressRange?.max || 100}% 时可能出现
              </p>
            </div>

            {/* Target Selection */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.eventEditor.target}
              </label>
              <select
                value={newItem.target}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    target: e.target.value as GameEvent["target"],
                  })
                }
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs outline-none focus:border-purple-500 transition-colors">
                <option value="SELF">{t.eventEditor.targetSelf}</option>
                <option value="ALL_PLAYERS">
                  {t.eventEditor.targetAllPlayers}
                </option>
                <option value="RANDOM_OTHER">
                  {t.eventEditor.targetRandomOther}
                </option>
              </select>
            </div>

            {/* Effect Type and Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">
                  {t.eventEditor.effect}
                </label>
                <select
                  value={newItem.type}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      type: e.target.value as GameEvent["type"],
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs outline-none focus:border-purple-500 transition-colors">
                  <option value="NONE">{t.eventEditor.effectNone}</option>
                  <option value="MOVE">{t.eventEditor.effectMove}</option>
                  <option value="RESTART_LAP">
                    {t.eventEditor.effectRestart}
                  </option>
                  <option value="SKIP">{t.eventEditor.effectSkip}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">
                  {t.eventEditor.value}
                </label>
                <input
                  type="number"
                  value={newItem.val}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      val: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={
                    newItem.type === "NONE" ||
                    newItem.type === "RESTART_LAP" ||
                    newItem.type === "SKIP"
                  }
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs outline-none disabled:opacity-20 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {newItem.type === "MOVE" && (
              <p className="text-[9px] text-gray-600 -mt-2">
                {t.eventEditor.valueHint}
              </p>
            )}

            <button
              onClick={addEvent}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold border border-white/10 mt-auto transition-all shadow-lg hover:shadow-purple-500/50">
              {t.eventEditor.addEvent}
            </button>
          </div>

          {/* Event List */}
          <div className="lg:col-span-2 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {editList.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm italic">{t.eventEditor.noEvents}</p>
              </div>
            ) : (
              editList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between group hover:bg-white/10 transition-all"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: item.color || "#8b5cf6",
                  }}>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white mb-2">
                      {item.text}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-gray-500 uppercase tracking-wide flex-wrap">
                      <span
                        className="px-2 py-1 rounded"
                        style={{
                          backgroundColor: `${item.color || "#8b5cf6"}20`,
                          color: item.color || "#8b5cf6",
                        }}>
                        {getTargetDisplay(item.target)}
                      </span>
                      <span className="text-gray-600">·</span>
                      <span className="text-cyan-400">
                        {item.type}
                        {item.val !== 0 && ` (${item.val})`}
                      </span>
                      {item.progressRange && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span className="text-green-400">
                            进度 {item.progressRange.min}-
                            {item.progressRange.max}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setEditList(editList.filter((i) => i.id !== item.id))
                    }
                    className="text-gray-600 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
