"use client";

import React, { useState } from "react";
import { CreditCard, Save, Trash2, Sparkles } from "lucide-react";
import type { Card, CardEffect } from "@/app/types";
import type { Translations } from "@/app/locales";
import { RARITY_CONFIG } from "@/app/constants";

interface CardEditorProps {
  cards: Card[];
  onSave: (cards: Card[]) => void;
  onCancel: () => void;
  t: Translations;
}

type EffectType = "move" | "skip" | "restart";

export default function CardEditor({
  cards,
  onSave,
  onCancel,
  t,
}: CardEditorProps) {
  const [editList, setEditList] = useState(cards);
  const [newItem, setNewItem] = useState<Omit<Card, "instanceId" | "id">>({
    rarity: "NR",
    name: "",
    desc: "",
    pattern: "🎲",
    target: "SELF",
    effect: { move: 0 },
  });
  const [effectType, setEffectType] = useState<EffectType>("move");

  const save = () => {
    onSave(editList);
  };

  const addCard = () => {
    if (newItem.name.trim()) {
      setEditList([...editList, { ...newItem, id: Date.now() }]);
      setNewItem({
        rarity: "NR",
        name: "",
        desc: "",
        pattern: "🎲",
        target: "SELF",
        effect: { move: 0 },
      });
      setEffectType("move");
    }
  };

  const handleEffectTypeChange = (type: EffectType) => {
    setEffectType(type);
    if (type === "move") {
      setNewItem({ ...newItem, effect: { move: 0 } });
    } else if (type === "skip") {
      setNewItem({ ...newItem, effect: { skip: true } });
    } else if (type === "restart") {
      setNewItem({ ...newItem, effect: { restart: true } });
    }
  };

  const getEffectDisplay = (effect: CardEffect) => {
    if (effect.move !== undefined) {
      return effect.move > 0
        ? `前进 ${effect.move} 格`
        : effect.move < 0
          ? `后退 ${Math.abs(effect.move)} 格`
          : "原地不动";
    }
    if (effect.skip) return "暂停一回合";
    if (effect.restart) return "回到起点";
    return "无效果";
  };

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col animate-fade-in overflow-hidden">
      <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/60 flex-shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="text-cyan-400" /> {t.cardEditor.title}
        </h2>
        <button
          onClick={save}
          className="bg-cyan-600 hover:bg-cyan-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
          <Save size={18} /> {t.cardEditor.save}
        </button>
      </div>
      <div className="p-4 flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              {t.cardEditor.createNew}
            </h3>

            {/* Name and Emoji */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">
                  {t.cardEditor.name}
                </label>
                <input
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs focus:border-cyan-500 focus:outline-none transition-colors"
                  placeholder="卡牌名称"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">
                  {t.cardEditor.emoji}
                </label>
                <input
                  value={newItem.pattern}
                  onChange={(e) =>
                    setNewItem({ ...newItem, pattern: e.target.value })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-center text-lg focus:border-cyan-500 focus:outline-none transition-colors"
                  placeholder="🎲"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.cardEditor.description}
              </label>
              <textarea
                value={newItem.desc}
                onChange={(e) =>
                  setNewItem({ ...newItem, desc: e.target.value })
                }
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs h-16 focus:border-cyan-500 focus:outline-none transition-colors resize-none"
                placeholder="描述卡牌效果..."
              />
            </div>

            {/* Rarity */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.cardEditor.rarity}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["NR", "R", "SR", "SSR"] as const).map((rarity) => (
                  <button
                    key={rarity}
                    onClick={() => setNewItem({ ...newItem, rarity })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${
                      newItem.rarity === rarity
                        ? "scale-105 shadow-lg"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: RARITY_CONFIG[rarity].color,
                      backgroundColor: `${RARITY_CONFIG[rarity].color}20`,
                      color: RARITY_CONFIG[rarity].color,
                    }}>
                    {rarity}
                  </button>
                ))}
              </div>
            </div>

            {/* Target */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.cardEditor.target}
              </label>
              <select
                value={newItem.target}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    target: e.target.value as Card["target"],
                  })
                }
                className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs focus:border-cyan-500 focus:outline-none transition-colors">
                <option value="SELF">{t.cardEditor.targetSelf}</option>
                <option value="PICK_ONE">{t.cardEditor.targetPickOne}</option>
                <option value="RANDOM_OTHER">
                  {t.cardEditor.targetRandomOther}
                </option>
                <option value="ALL_OTHERS">
                  {t.cardEditor.targetAllOthers}
                </option>
              </select>
            </div>

            {/* Effect Type */}
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">
                {t.cardEditor.effectType}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleEffectTypeChange("move")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    effectType === "move"
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                      : "bg-black/40 border-white/10 text-gray-400 hover:border-white/30"
                  }`}>
                  移动
                </button>
                <button
                  onClick={() => handleEffectTypeChange("skip")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    effectType === "skip"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "bg-black/40 border-white/10 text-gray-400 hover:border-white/30"
                  }`}>
                  暂停
                </button>
                <button
                  onClick={() => handleEffectTypeChange("restart")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    effectType === "restart"
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-black/40 border-white/10 text-gray-400 hover:border-white/30"
                  }`}>
                  重启
                </button>
              </div>
            </div>

            {/* Move Distance (only for move effect) */}
            {effectType === "move" && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">
                  {t.cardEditor.moveDistance}
                </label>
                <input
                  type="number"
                  value={newItem.effect.move || 0}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      effect: {
                        ...newItem.effect,
                        move: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs focus:border-cyan-500 focus:outline-none transition-colors"
                  placeholder="0"
                />
                <p className="text-[9px] text-gray-600 mt-1">
                  {t.cardEditor.moveHint}
                </p>
              </div>
            )}

            <button
              onClick={addCard}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-bold border border-white/10 mt-auto transition-all shadow-lg hover:shadow-cyan-500/50">
              {t.cardEditor.addCard}
            </button>
          </div>

          {/* Card List */}
          <div className="lg:col-span-2 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {editList.map((card) => (
              <div
                key={card.id}
                className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between hover:bg-white/10 transition-all">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-3xl">{card.pattern}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{card.name}</span>
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded border"
                        style={{
                          borderColor: RARITY_CONFIG[card.rarity].color,
                          color: RARITY_CONFIG[card.rarity].color,
                          backgroundColor: `${RARITY_CONFIG[card.rarity].color}20`,
                        }}>
                        {card.rarity}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500">{card.desc}</div>
                    <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-2">
                      <span>目标: {card.target}</span>
                      <span>·</span>
                      <span className="text-cyan-400">
                        {getEffectDisplay(card.effect)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setEditList(editList.filter((c) => c.id !== card.id))
                  }
                  className="text-gray-600 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {editList.length === 0 && (
              <div className="text-center py-20 text-gray-600">
                <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">暂无卡牌，开始创建吧！</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
