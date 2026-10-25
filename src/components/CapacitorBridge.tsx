"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export default function CapacitorBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#4f46e5" });
      await SplashScreen.hide();
    })();
  }, []);

  return null;
}
