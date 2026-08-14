import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export const THEME_COLORS = {
  orange: { primary: '#FF6B00', secondary: '#FFB800' },
  blue: { primary: '#3B82F6', secondary: '#60A5FA' },
  green: { primary: '#10B981', secondary: '#34D399' },
  red: { primary: '#EF4444', secondary: '#F87171' },
  purple: { primary: '#8B5CF6', secondary: '#A78BFA' }
};

export type ThemeColorName = keyof typeof THEME_COLORS;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accentColor: ThemeColorName;
  setAccentColor: (color: ThemeColorName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('nyghto-theme');
    return (saved as Theme) || 'dark';
  });

  const [accentColor, setAccentColor] = useState<ThemeColorName>(() => {
    const saved = localStorage.getItem('nyghto-accent');
    return (saved as ThemeColorName) || 'orange';
  });

  useEffect(() => {
    localStorage.setItem('nyghto-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('nyghto-accent', accentColor);
    const colors = THEME_COLORS[accentColor];
    if (colors) {
      document.documentElement.style.setProperty('--theme-accent', colors.primary);
      document.documentElement.style.setProperty('--theme-accent-secondary', colors.secondary);
    }
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
