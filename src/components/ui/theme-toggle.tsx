"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    const nowDark = !html.classList.contains("dark");
    if (nowDark) {
      html.classList.add("dark");
      localStorage.setItem("colecta-theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("colecta-theme", "light");
    }
    setIsDark(nowDark);
  }

  // Evitar hydration mismatch
  if (!mounted) {
    return (
      <button
        className={`flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground ${className ?? ""}`}
        aria-hidden
      >
        <span className="text-base">○</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition
        ${isDark
          ? "border-slate-600 bg-slate-800 text-yellow-300 hover:bg-slate-700"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
        } ${className ?? ""}`}
    >
      <span className="text-base leading-none">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
