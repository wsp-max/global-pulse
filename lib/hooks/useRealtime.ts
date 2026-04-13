"use client";

import { useEffect } from "react";

export function useRealtime(_channelName: string, onMessage: () => void) {
  useEffect(() => {
    const timer = window.setInterval(onMessage, 60_000);
    return () => window.clearInterval(timer);
  }, [onMessage]);
}


