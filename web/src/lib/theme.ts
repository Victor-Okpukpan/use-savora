"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/*
  Session-scoped, not persistent. A fresh tab follows the OS preference. Once
  the visitor toggles, the choice is kept in `sessionStorage` — so it survives
  refreshes and in-tab navigation for as long as that tab is open — and is gone
  when the tab closes or a new tab is opened.
*/

const KEY = "savora.theme";
const listeners = new Set<() => void>();

function stored(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** The theme actually on screen: the session choice, or the OS preference. */
export function getEffectiveTheme(): Theme {
  return stored() ?? systemTheme();
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Flip to the opposite of what's showing and keep it for this tab session. */
export function toggleTheme(): void {
  const next: Theme = getEffectiveTheme() === "dark" ? "light" : "dark";
  try {
    window.sessionStorage.setItem(KEY, next);
  } catch {
    /* private mode — the toggle still works for the current page */
  }
  apply(next);
  listeners.forEach((l) => l());
}

export function useEffectiveTheme(): Theme {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      // Track the OS live only while the visitor hasn't chosen for this tab.
      const onSystem = () => {
        if (stored() === null) onChange();
      };
      mq.addEventListener("change", onSystem);
      return () => {
        listeners.delete(onChange);
        mq.removeEventListener("change", onSystem);
      };
    },
    getEffectiveTheme,
    () => "light" as Theme,
  );
}

/**
 * Runs in <head> before first paint: if this tab session has a chosen theme,
 * put it on <html> before the CSS resolves so there's no flash.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=sessionStorage.getItem("${KEY}");if(v==="light"||v==="dark")document.documentElement.setAttribute("data-theme",v);}catch(e){}})();`;
