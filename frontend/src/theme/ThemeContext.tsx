import React, { createContext, useContext, useEffect, useState } from 'react';
import { tokens, ThemeMode, ColorTokens } from './tokens';

interface ThemeContextType {
  mode: ThemeMode;
  tokens: ColorTokens;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  tokens: tokens.light,
  toggleTheme: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campusride_theme') as ThemeMode;
      if (saved === 'dark' || saved === 'light') return saved;
      // Default to light as specified in prompt: "light is default, dark is optional"
      return 'light';
    }
    return 'light';
  });

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('campusride_theme', newMode);
      if (newMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const toggleTheme = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setCampusRideTheme = setMode;
    }
  }, [mode]);

  const currentTokens = tokens[mode];

  return (
    <ThemeContext.Provider value={{ mode, tokens: currentTokens, toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
