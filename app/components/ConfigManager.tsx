"use client";

import React, { useState } from "react";
import {
  Download,
  Upload,
  Copy,
  Check,
  Loader,
  AlertCircle,
} from "lucide-react";
import type { Card, GameEvent } from "@/app/types";

interface ConfigManagerProps {
  cards: Card[];
  events: GameEvent[];
  onLoadCards: (cards: Card[]) => void;
  onLoadEvents: (events: GameEvent[]) => void;
}

export default function ConfigManager({
  cards,
  events,
  onLoadCards,
  onLoadEvents,
}: ConfigManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [configId, setConfigId] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards, events }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "导出失败");
      }

      const data = await response.json();
      setConfigId(data.id);
      setMessage({
        type: "success",
        text: `配置导出成功: ${data.id}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "导出失败",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!configId.trim()) {
      setMessage({
        type: "error",
        text: "请输入配置ID",
      });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/config?id=${encodeURIComponent(configId)}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "导入失败");
      }

      const config = await response.json();
      onLoadCards(config.cards);
      onLoadEvents(config.events);

      setMessage({
        type: "success",
        text: `配置导入成功（${config.id}）`,
      });
      setConfigId("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "导入失败",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        if (config.cards && config.events) {
          onLoadCards(config.cards);
          onLoadEvents(config.events);
          setMessage({
            type: "success",
            text: "本地配置导入成功",
          });
        } else {
          throw new Error("配置格式无效");
        }
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "导入失败",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleLocalExport = () => {
    const config = {
      cards,
      events,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hyper-ludo-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setMessage({
      type: "success",
      text: "配置已下载到本地",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 消息 */}
      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/20 border border-green-500 text-green-300"
              : "bg-red-500/20 border border-red-500 text-red-300"
          }`}>
          {message.type === "success" ? (
            <Check size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {message.text}
        </div>
      )}

      {/* 导出区域 */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Download size={16} className="text-cyan-400" />
          导出配置
        </h3>
        <div className="space-y-2 text-xs">
          <p className="text-gray-400">
            导出当前卡牌和事件配置到网络存储或本地文件
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-3 py-2 rounded-lg bg-cyan-600/50 hover:bg-cyan-600 border border-cyan-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {isExporting ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              导出到网络
            </button>
            <button
              onClick={handleLocalExport}
              className="flex-1 px-3 py-2 rounded-lg bg-purple-600/50 hover:bg-purple-600 border border-purple-500 text-white font-bold flex items-center justify-center gap-2 transition-colors">
              <Download size={14} />
              导出本地
            </button>
          </div>
          {configId && (
            <div className="bg-black/40 rounded p-3 space-y-2">
              <p className="text-gray-300">配置ID (可分享给他人):</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={configId}
                  readOnly
                  className="flex-1 bg-black/60 border border-white/20 rounded px-3 py-1 text-xs text-white"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 导入区域 */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Upload size={16} className="text-purple-400" />
          导入配置
        </h3>
        <div className="space-y-2 text-xs">
          <p className="text-gray-400">从网络存储或本地文件导入配置</p>

          {/* 网络导入 */}
          <div className="space-y-2">
            <label className="text-gray-400">从配置ID导入</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={configId}
                onChange={(e) => setConfigId(e.target.value)}
                placeholder="输入8位配置ID..."
                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
              />
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-3 py-2 rounded-lg bg-purple-600/50 hover:bg-purple-600 border border-purple-500 text-white font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
                {isImporting ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                导入
              </button>
            </div>
          </div>

          {/* 本地导入 */}
          <div className="space-y-2">
            <label className="text-gray-400">从本地文件导入</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 rounded-lg bg-cyan-600/50 hover:bg-cyan-600 border border-cyan-500 text-white font-bold flex items-center justify-center gap-2 transition-colors">
              <Upload size={14} />
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
