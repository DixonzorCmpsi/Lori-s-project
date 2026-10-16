import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'dark' | 'light';
/**
 * 'calendar' (shown as "Simple") is the default for new users. 'default' (shown as "Classic") is the clean sidebar look; 'fancy' is the original theater look;
 * 'calendar' is the Production Calendar look (Default layout rules plus a top
 * navigation bar and a road-to-opening phase bar).
 */
export type UiStyle = 'default' | 'fancy' | 'calendar';

/** Colour sets for the Calendar style. */
export const PALETTES = [
  { id: 'graphite', label: 'Graphite', swatch: '#5eead4', base: '#17181b' },
  { id: 'teal', label: 'Teal', swatch: '#5eead4', base: '#121e1d' },
  { id: 'indigo', label: 'Indigo', swatch: '#8da2ff', base: '#151a30' },
  { id: 'plum', label: 'Plum', swatch: '#d8a4ff', base: '#1d1523' },
  { id: 'amber', label: 'Amber', swatch: '#fbbf24', base: '#1d1913' },
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  /** The base style in effect (pre-login pages always use 'fancy'). 'calendar' counts as 'default' here. */
  uiStyle: 'default' | 'fancy';
  /** True when the Production Calendar look is in effect (also implies uiStyle 'default'). */
  isCalendar: boolean;
  /** The user's saved choice, shown in Account settings. */
  preferredStyle: UiStyle;
  setUiStyle: (style: UiStyle) => void;
  /** Colour set used by the Calendar style. */
  palette: PaletteId;
  setPalette: (p: PaletteId) => void;
  /** Pre-login pages call this so they keep their original look. */
  setForceFancy: (force: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
  uiStyle: 'default',
  isCalendar: true,
  preferredStyle: 'calendar',
  setUiStyle: () => {},
  palette: 'graphite',
  setPalette: () => {},
  setForceFancy: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = 'dcb-theme';
const STYLE_KEY = 'dcb-style';
const PALETTE_KEY = 'dcb-palette';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readStorage(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });
  const [preferredStyle, setUiStyle] = useState<UiStyle>(() => {
    const saved = readStorage(STYLE_KEY);
    if (saved === 'default' || saved === 'fancy' || saved === 'calendar') return saved;
    return 'calendar';
  });

  const [palette, setPalette] = useState<PaletteId>(() => {
    const saved = readStorage(PALETTE_KEY);
    return PALETTES.some(p => p.id === saved) ? (saved as PaletteId) : 'graphite';
  });

  const [forceFancy, setForceFancy] = useState(false);
  const effective: UiStyle = forceFancy ? 'fancy' : preferredStyle;
  const uiStyle = effective === 'fancy' ? 'fancy' : 'default';
  const isCalendar = effective === 'calendar';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    writeStorage(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ui-default', uiStyle === 'default');
    root.classList.toggle('ui-fancy', uiStyle === 'fancy');
    root.classList.toggle('ui-calendar', isCalendar);
  }, [uiStyle, isCalendar]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    writeStorage(PALETTE_KEY, palette);
  }, [palette]);

  useEffect(() => {
    writeStorage(STYLE_KEY, preferredStyle);
  }, [preferredStyle]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark', uiStyle, isCalendar, preferredStyle, setUiStyle, palette, setPalette, setForceFancy }}>
      {children}
    </ThemeContext.Provider>
  );
}
