"use client";

import { useEffect, useMemo, useState } from "react";
import type { Topic } from "@global-pulse/shared";
import { getDisplayTopicName } from "@/lib/utils/topic-name";

const WATCHLIST_KEY = "gp_watchlist_v1";
const WATCHLIST_ALERT_KEY = "gp_watchlist_alerts_v1";

export interface WatchlistItem {
  topicId: number;
  name: string;
  regionId: string;
  lifecycleStage: string | null;
  heatScore: number;
  sentiment: number | null;
  updatedAt: string;
}

function readWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as WatchlistItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item.topicId === "number");
  } catch {
    return [];
  }
}

function readAlertCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(WATCHLIST_ALERT_KEY);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeWatchlist(items: WatchlistItem[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("gp-watchlist-changed"));
}

function writeAlertCount(count: number): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WATCHLIST_ALERT_KEY, String(Math.max(0, count)));
  window.dispatchEvent(new CustomEvent("gp-watchlist-alerts"));
}

function toWatchlistItem(topic: Topic): WatchlistItem | null {
  if (typeof topic.id !== "number") {
    return null;
  }
  const name = getDisplayTopicName({
    id: topic.id,
    regionId: topic.regionId,
    nameKo: topic.nameKo,
    nameEn: topic.nameEn,
    summaryKo: topic.summaryKo,
    summaryEn: topic.summaryEn,
    sampleTitles: topic.sampleTitles,
    keywords: topic.keywords,
    entities: topic.entities ?? [],
  });
  return {
    topicId: topic.id,
    name,
    regionId: topic.regionId,
    lifecycleStage: topic.lifecycleStage ?? null,
    heatScore: topic.heatScore,
    sentiment: topic.sentiment,
    updatedAt: new Date().toISOString(),
  };
}

export function useWatchlist(topics: Topic[]) {
  const [items, setItems] = useState<WatchlistItem[]>(() => readWatchlist());
  const [alertCount, setAlertCount] = useState<number>(() => readAlertCount());

  useEffect(() => {
    const syncWatchlist = () => setItems(readWatchlist());
    const syncAlerts = () => setAlertCount(readAlertCount());

    window.addEventListener("gp-watchlist-changed", syncWatchlist as EventListener);
    window.addEventListener("gp-watchlist-alerts", syncAlerts as EventListener);
    window.addEventListener("storage", syncWatchlist);
    window.addEventListener("storage", syncAlerts);

    return () => {
      window.removeEventListener("gp-watchlist-changed", syncWatchlist as EventListener);
      window.removeEventListener("gp-watchlist-alerts", syncAlerts as EventListener);
      window.removeEventListener("storage", syncWatchlist);
      window.removeEventListener("storage", syncAlerts);
    };
  }, []);

  useEffect(() => {
    if (items.length === 0 || topics.length === 0) {
      return;
    }

    const topicById = new Map<number, Topic>();
    for (const topic of topics) {
      if (typeof topic.id === "number") {
        topicById.set(topic.id, topic);
      }
    }

    let changed = false;
    let transitionCount = 0;

    const nextItems = items.map((item) => {
      const liveTopic = topicById.get(item.topicId);
      if (!liveTopic) {
        return item;
      }

      const nextLifecycle = liveTopic.lifecycleStage ?? null;
      const liveTopicName = getDisplayTopicName({
        id: liveTopic.id,
        regionId: liveTopic.regionId,
        nameKo: liveTopic.nameKo,
        nameEn: liveTopic.nameEn,
        summaryKo: liveTopic.summaryKo,
        summaryEn: liveTopic.summaryEn,
        sampleTitles: liveTopic.sampleTitles,
        keywords: liveTopic.keywords,
        entities: liveTopic.entities ?? [],
      });
      if (
        item.lifecycleStage !== nextLifecycle &&
        (nextLifecycle === "peaking" || nextLifecycle === "fading")
      ) {
        transitionCount += 1;
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Global Pulse Watchlist", {
            body: `${liveTopicName}: ${nextLifecycle}`,
          });
        }
      }

      const next: WatchlistItem = {
        ...item,
        name: liveTopicName,
        lifecycleStage: nextLifecycle,
        heatScore: liveTopic.heatScore,
        sentiment: liveTopic.sentiment,
        updatedAt: new Date().toISOString(),
      };

      if (
        next.lifecycleStage !== item.lifecycleStage ||
        next.heatScore !== item.heatScore ||
        next.sentiment !== item.sentiment ||
        next.name !== item.name
      ) {
        changed = true;
      }

      return next;
    });

    if (changed) {
      writeWatchlist(nextItems);
    }

    if (transitionCount > 0) {
      writeAlertCount(readAlertCount() + transitionCount);
    }
  }, [items, topics]);

  const watchedTopicIds = useMemo(() => new Set(items.map((item) => item.topicId)), [items]);

  const toggleWatch = (topic: Topic) => {
    const watchItem = toWatchlistItem(topic);
    if (!watchItem) {
      return;
    }

    const next = watchedTopicIds.has(watchItem.topicId)
      ? items.filter((item) => item.topicId !== watchItem.topicId)
      : [...items, watchItem];

    writeWatchlist(next);
  };

  const clearAlerts = () => {
    writeAlertCount(0);
    setAlertCount(0);
  };

  const requestBrowserNotification = async () => {
    if (typeof Notification === "undefined") {
      return "unsupported" as const;
    }
    const permission = await Notification.requestPermission();
    return permission;
  };

  return {
    items,
    alertCount,
    watchedTopicIds,
    isWatched: (topicId: number | undefined) => (typeof topicId === "number" ? watchedTopicIds.has(topicId) : false),
    toggleWatch,
    clearAlerts,
    requestBrowserNotification,
  };
}
