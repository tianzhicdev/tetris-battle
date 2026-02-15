/**
 * Theme Context
 * Provides theme state to all components via React context
 */

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { getTheme, DEFAULT_THEME_ID, type Theme } from '../themes/index';
import { getCurrentThemeId, applyTheme } from '../services/themeService';

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  userId?: string;
}

export function ThemeProvider({ children, userId }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [isLoading, setIsLoading] = useState(true);

  const theme = useMemo(() => getTheme(themeId), [themeId]);

  // Load theme on mount
  useEffect(() => {
    getCurrentThemeId(userId).then(id => {
      setThemeId(id);
      setIsLoading(false);
    });
  }, [userId]);

  // Apply theme and persist
  const handleSetTheme = async (newThemeId: string) => {
    await applyTheme(newThemeId, userId);
    setThemeId(newThemeId);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme: handleSetTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
