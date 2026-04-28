'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Theme } from '@/lib/types';

interface ThemeCtx {
  theme: Theme;            // user preference
  effective: 'light' | 'dark';
  locked: boolean;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = 'theme-preference';

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyClass(effective: 'light' | 'dark') {
  const root = document.documentElement;
  if (effective === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function ThemeProvider({
  children,
  initial = 'system',
  override = null,
}: {
  children: React.ReactNode;
  initial?: Theme;
  override?: Theme | null;
}) {
  // Stored user preference (may be overridden by `override`).
  const [theme, setThemeState] = useState<Theme>(initial);
  const [sysIsDark, setSysIsDark] = useState<boolean>(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
      setThemeState(stored);
    }
    setSysIsDark(systemTheme() === 'dark');

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSysIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effective: 'light' | 'dark' = useMemo(() => {
    const t = override ?? theme;
    if (t === 'system') return sysIsDark ? 'dark' : 'light';
    return t;
  }, [theme, override, sysIsDark]);

  useEffect(() => {
    applyClass(effective);
  }, [effective]);

  const setTheme = useCallback((t: Theme) => {
    if (override) return; // locked by role
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, [override]);

  const value: ThemeCtx = {
    theme,
    effective,
    locked: !!override,
    setTheme,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used within ThemeProvider');
  return v;
}
