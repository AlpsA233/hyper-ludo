import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, GameEvent } from "../types";

interface UserProfile {
  backgroundType: "color" | "image";
  backgroundValue: string;
  playerAvatars: string[];
  playerNames: string[];
}

interface UseUserDataReturn {
  // 数据
  cardDatabase: Card[];
  eventDatabase: GameEvent[];
  backgroundType: "color" | "image";
  backgroundValue: string;
  playerAvatars: string[];
  playerNames: string[];

  // 加载状态
  loading: boolean;
  error: string | null;

  // 保存方法
  saveCards: (cards: Card[]) => Promise<void>;
  saveEvents: (events: GameEvent[]) => Promise<void>;
  saveProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

const DEFAULT_AVATARS = Array(8).fill("👤");
const DEFAULT_NAMES: string[] = [];

/**
 * 用户数据同步 Hook
 * - 登录用户: 从 Supabase 读写数据
 * - 游客模式: 使用 localStorage
 */
export function useUserData(
  userId: string | null,
  defaultCards: Card[],
  defaultEvents: GameEvent[],
): UseUserDataReturn {
  const [cardDatabase, setCardDatabase] = useState<Card[]>(defaultCards);
  const [eventDatabase, setEventDatabase] =
    useState<GameEvent[]>(defaultEvents);
  const [backgroundType, setBackgroundType] = useState<"color" | "image">(
    "color",
  );
  const [backgroundValue, setBackgroundValue] = useState<string>("#050510");
  const [playerAvatars, setPlayerAvatars] = useState<string[]>(DEFAULT_AVATARS);
  const [playerNames, setPlayerNames] = useState<string[]>(DEFAULT_NAMES);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从 localStorage 加载数据 (游客模式或初始化)
  const loadFromLocalStorage = () => {
    try {
      const savedCards = localStorage.getItem("party_ludo_cards");
      if (savedCards) setCardDatabase(JSON.parse(savedCards));
      else setCardDatabase(defaultCards);

      const savedEvents = localStorage.getItem("party_ludo_events");
      if (savedEvents) setEventDatabase(JSON.parse(savedEvents));
      else setEventDatabase(defaultEvents);

      const savedBg = localStorage.getItem("hyper_ludo_background");
      if (savedBg) {
        const bg = JSON.parse(savedBg);
        setBackgroundType(bg.type);
        setBackgroundValue(bg.value);
      }

      const savedAvatars = localStorage.getItem("hyper_ludo_avatars");
      if (savedAvatars) setPlayerAvatars(JSON.parse(savedAvatars));

      const savedNames = localStorage.getItem("hyper_ludo_player_names");
      if (savedNames) setPlayerNames(JSON.parse(savedNames));
    } catch (err) {
      console.error("Failed to load from localStorage:", err);
    }
  };

  // 从 Supabase 加载数据 (登录用户)
  const loadFromSupabase = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // 并行加载所有数据
      const [cardsRes, eventsRes, profileRes] = await Promise.all([
        supabase
          .from("user_cards")
          .select("cards")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("user_events")
          .select("events")
          .eq("user_id", userId)
          .single(),
        supabase.from("user_profiles").select("*").eq("id", userId).single(),
      ]);

      // 加载卡牌
      if (cardsRes.data?.cards) {
        setCardDatabase(cardsRes.data.cards as Card[]);
      } else {
        // 首次登录，从 localStorage 迁移到云端
        const savedCards = localStorage.getItem("party_ludo_cards");
        const cards = savedCards ? JSON.parse(savedCards) : defaultCards;
        setCardDatabase(cards);
        // 自动保存到云端
        await supabase.from("user_cards").upsert({
          user_id: userId,
          cards: cards,
        });
      }

      // 加载事件
      if (eventsRes.data?.events) {
        setEventDatabase(eventsRes.data.events as GameEvent[]);
      } else {
        // 首次登录，从 localStorage 迁移
        const savedEvents = localStorage.getItem("party_ludo_events");
        const events = savedEvents ? JSON.parse(savedEvents) : defaultEvents;
        setEventDatabase(events);
        await supabase.from("user_events").upsert({
          user_id: userId,
          events: events,
        });
      }

      // 加载个人设置
      if (profileRes.data) {
        setBackgroundType(profileRes.data.background_type as "color" | "image");
        setBackgroundValue(profileRes.data.background_value);
        setPlayerAvatars(profileRes.data.player_avatars || DEFAULT_AVATARS);
        setPlayerNames(profileRes.data.player_names || DEFAULT_NAMES);
      } else {
        // 首次登录，从 localStorage 迁移
        const savedBg = localStorage.getItem("hyper_ludo_background");
        const savedAvatars = localStorage.getItem("hyper_ludo_avatars");
        const savedNames = localStorage.getItem("hyper_ludo_player_names");

        const bg = savedBg
          ? JSON.parse(savedBg)
          : { type: "color", value: "#050510" };
        const avatars = savedAvatars
          ? JSON.parse(savedAvatars)
          : DEFAULT_AVATARS;
        const names = savedNames ? JSON.parse(savedNames) : DEFAULT_NAMES;

        setBackgroundType(bg.type);
        setBackgroundValue(bg.value);
        setPlayerAvatars(avatars);
        setPlayerNames(names);

        // 创建用户配置
        await supabase.from("user_profiles").upsert({
          id: userId,
          background_type: bg.type,
          background_value: bg.value,
          player_avatars: avatars,
          player_names: names,
        });
      }
    } catch (err: any) {
      console.error("Failed to load from Supabase:", err);
      setError(err.message || "加载数据失败");
      // 失败时回退到 localStorage
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    if (userId) {
      loadFromSupabase();
    } else {
      loadFromLocalStorage();
      setLoading(false);
    }
  }, [userId]);

  // 保存卡牌到云端或本地
  const saveCards = async (cards: Card[]) => {
    setCardDatabase(cards);

    // 保存到 localStorage (备份)
    localStorage.setItem("party_ludo_cards", JSON.stringify(cards));

    // 保存到 Supabase (登录用户)
    if (userId) {
      try {
        await supabase.from("user_cards").upsert({
          user_id: userId,
          cards: cards,
        });
      } catch (err) {
        console.error("Failed to save cards to Supabase:", err);
        // 静默失败，已保存到 localStorage
      }
    }
  };

  // 保存事件到云端或本地
  const saveEvents = async (events: GameEvent[]) => {
    setEventDatabase(events);

    localStorage.setItem("party_ludo_events", JSON.stringify(events));

    if (userId) {
      try {
        await supabase.from("user_events").upsert({
          user_id: userId,
          events: events,
        });
      } catch (err) {
        console.error("Failed to save events to Supabase:", err);
      }
    }
  };

  // 保存个人设置
  const saveProfile = async (profile: Partial<UserProfile>) => {
    const updates: any = {};

    if (profile.backgroundType !== undefined) {
      setBackgroundType(profile.backgroundType);
      updates.background_type = profile.backgroundType;
    }

    if (profile.backgroundValue !== undefined) {
      setBackgroundValue(profile.backgroundValue);
      updates.background_value = profile.backgroundValue;
    }

    if (profile.playerAvatars !== undefined) {
      setPlayerAvatars(profile.playerAvatars);
      updates.player_avatars = profile.playerAvatars;
      localStorage.setItem(
        "hyper_ludo_avatars",
        JSON.stringify(profile.playerAvatars),
      );
    }

    if (profile.playerNames !== undefined) {
      setPlayerNames(profile.playerNames);
      updates.player_names = profile.playerNames;
      localStorage.setItem(
        "hyper_ludo_player_names",
        JSON.stringify(profile.playerNames),
      );
    }

    // 保存背景到 localStorage
    if (profile.backgroundType || profile.backgroundValue) {
      const bg = {
        type: profile.backgroundType || backgroundType,
        value: profile.backgroundValue || backgroundValue,
      };
      localStorage.setItem("hyper_ludo_background", JSON.stringify(bg));
    }

    // 保存到 Supabase
    if (userId && Object.keys(updates).length > 0) {
      try {
        await supabase.from("user_profiles").upsert({
          id: userId,
          ...updates,
        });
      } catch (err) {
        console.error("Failed to save profile to Supabase:", err);
      }
    }
  };

  return {
    cardDatabase,
    eventDatabase,
    backgroundType,
    backgroundValue,
    playerAvatars,
    playerNames,
    loading,
    error,
    saveCards,
    saveEvents,
    saveProfile,
  };
}
