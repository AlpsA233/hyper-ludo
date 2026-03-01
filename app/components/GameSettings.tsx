"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Save,
  X,
  Palette,
  Image as ImageIcon,
  User,
  Upload,
  Loader,
} from "lucide-react";
import { uploadImageToLskyPro } from "@/app/lib/lskyPro";
import type { Translations } from "@/app/locales";

interface GameSettingsProps {
  onSave: () => void;
  onCancel: () => void;
  t: Translations;
  initialBgType: "color" | "image";
  initialBgValue: string;
  initialAvatars: string[];
  initialPlayerNames: string[];
  onSaveSettings: (settings: {
    backgroundType: "color" | "image";
    backgroundValue: string;
    playerAvatars: string[];
    playerNames: string[];
  }) => Promise<void>;
}

const PRESET_COLORS = [
  "#050510",
  "#1a0b2e",
  "#16213e",
  "#0f3460",
  "#533483",
  "#2d4059",
  "#1f1f1f",
  "#2c003e",
];

const DEFAULT_EMOJIS = [
  "👤",
  "😀",
  "😎",
  "🤖",
  "👻",
  "🐶",
  "🐱",
  "🦊",
  "🐼",
  "🦁",
  "🐯",
  "🐸",
  "🦄",
  "🐉",
  "🎮",
  "⚡",
  "🔥",
  "💎",
  "🌟",
  "🎯",
];

export default function GameSettings({
  onSave,
  onCancel,
  t,
  initialBgType,
  initialBgValue,
  initialAvatars,
  initialPlayerNames,
  onSaveSettings,
}: GameSettingsProps) {
  const [bgType, setBgType] = useState<"color" | "image">(initialBgType);
  const [bgValue, setBgValue] = useState(initialBgValue);
  const [avatars, setAvatars] = useState<string[]>(initialAvatars);
  const [playerNames, setPlayerNames] = useState<string[]>(initialPlayerNames);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingAvatarIndex, setEditingAvatarIndex] = useState<number | null>(
    null,
  );
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // 使用传入的初始值
    setBgType(initialBgType);
    setBgValue(initialBgValue);
    setAvatars(initialAvatars);
    setPlayerNames(initialPlayerNames);
  }, [initialBgType, initialBgValue, initialAvatars, initialPlayerNames]);

  const handleSave = async () => {
    // 保存到云端或本地
    await onSaveSettings({
      backgroundType: bgType,
      backgroundValue: bgValue,
      playerAvatars: avatars,
      playerNames: playerNames,
    });
    onSave();
  };

  const updateAvatar = (playerIndex: number, avatar: string) => {
    const newAvatars = [...avatars];
    newAvatars[playerIndex] = avatar;
    setAvatars(newAvatars);
  };

  const updatePlayerName = (playerIndex: number, name: string) => {
    const newNames = [...playerNames];
    newNames[playerIndex] = name;
    setPlayerNames(newNames);
  };

  const handleFileUpload = async (playerIndex: number, file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImageToLskyPro(file);
      updateAvatar(playerIndex, url);
      setEditingAvatarIndex(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.settings.uploadFailed;
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleBackgroundUpload = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImageToLskyPro(file);
      setBgValue(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.settings.uploadFailed;
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed top-[90px] left-0 right-0 bottom-0 z-[100] bg-[#050510] flex flex-col animate-fade-in overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-black/60 flex-shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Palette className="text-cyan-400" /> {t.settings.title}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
          <button
            onClick={handleSave}
            className="bg-cyan-600 hover:bg-cyan-500 px-4 sm:px-6 py-1 sm:py-2 rounded-lg font-bold flex items-center gap-2 transition-colors text-sm sm:text-base">
            <Save size={16} className="sm:size-[18px]" /> {t.common.save}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* 错误提示 */}
          {uploadError && (
            <div className="bg-red-600/20 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm flex items-center justify-between">
              <span>{uploadError}</span>
              <button
                onClick={() => setUploadError(null)}
                className="text-red-300 hover:text-red-200">
                <X size={16} />
              </button>
            </div>
          )}
          {/* 背景设置 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ImageIcon size={20} className="text-purple-400" />
              {t.settings.backgroundSettings}
            </h3>

            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setBgType("color")}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    bgType === "color"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}>
                  {t.settings.backgroundColor}
                </button>
                <button
                  onClick={() => setBgType("image")}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    bgType === "image"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}>
                  {t.settings.backgroundImage}
                </button>
              </div>

              {bgType === "color" && (
                <div className="space-y-3">
                  <label className="text-sm text-gray-400">
                    {t.settings.selectColor}
                  </label>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setBgValue(color)}
                        className={`h-12 rounded-lg transition-all border-2 ${
                          bgValue === color
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent hover:border-white/30"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-400">
                      {t.settings.colorCodeInput}
                    </label>
                    <input
                      type="text"
                      value={bgValue}
                      onChange={(e) => setBgValue(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {bgType === "image" && (
                <div>
                  <label className="text-sm text-gray-400 block mb-2">
                    {t.settings.imageUrl}
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={bgValue}
                        onChange={(e) => setBgValue(e.target.value)}
                        placeholder={t.settings.imageUrlPlaceholder}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() =>
                          document.getElementById("bg-file-input")?.click()
                        }
                        disabled={uploading}
                        className="px-4 py-2 rounded-lg bg-purple-600/50 hover:bg-purple-600 border border-purple-500 text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                        {uploading ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <Upload size={16} />
                        )}
                        {t.settings.uploadBackground}
                      </button>
                      <input
                        id="bg-file-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleBackgroundUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    提示：推荐使用高分辨率图片，支持 jpg, png, webp 格式
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 玩家头像设置 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User size={20} className="text-cyan-400" />
              {t.settings.playerAvatars}
            </h3>

            <div className="space-y-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 flex-shrink-0 relative group cursor-pointer transition-opacity hover:opacity-75"
                      style={{
                        borderColor: `hsl(${(i * 360) / 8}, 70%, 60%)`,
                        backgroundColor: `hsl(${(i * 360) / 8}, 70%, 20%)`,
                      }}>
                      {avatars[i].startsWith("http") ? (
                        <img
                          src={avatars[i]}
                          alt={`Player ${i + 1}`}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        avatars[i]
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload size={16} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold mb-1">
                        {t.settings.playerName}
                      </div>
                      <input
                        type="text"
                        value={playerNames[i]}
                        onChange={(e) => updatePlayerName(i, e.target.value)}
                        placeholder={`${t.player} ${i + 1}`}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-500 mb-2"
                      />
                      <input
                        type="text"
                        value={avatars[i]}
                        onChange={(e) => updateAvatar(i, e.target.value)}
                        placeholder={t.settings.imageUrlPlaceholder}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-1 text-xs mt-1 outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => fileInputRefs.current[i]?.click()}
                        disabled={uploading}
                        className="mt-2 text-xs px-3 py-1 rounded bg-cyan-600/50 hover:bg-cyan-600 border border-cyan-500 text-white flex items-center gap-1 transition-colors disabled:opacity-50">
                        {uploading ? (
                          <Loader size={12} className="animate-spin" />
                        ) : (
                          <Upload size={12} />
                        )}
                        {t.settings.uploadAvatar}
                      </button>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[i] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(i, e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => updateAvatar(i, emoji)}
                        className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 transition-all text-xl flex items-center justify-center">
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
