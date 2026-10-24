export const tokens = {
  light: {
    background: '#FFFFFF',
    surface: '#F3F3F3',
    surfaceHover: '#EAEAEA',
    text: '#000000',
    muted: '#5E5E5E',
    border: '#E2E2E2',
    primary: '#000000',
    primaryHover: '#1F1F1F',
    primaryText: '#FFFFFF',
    accent: '#276EF1',
    success: '#05A357',
    warning: '#FFC043',
    danger: '#E11900',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1C',
    surfaceHover: '#2A2A2A',
    text: '#FFFFFF',
    muted: '#A6A6A6',
    border: '#333333',
    primary: '#FFFFFF',
    primaryHover: '#E0E0E0',
    primaryText: '#000000',
    accent: '#276EF1',
    success: '#05A357',
    warning: '#FFC043',
    danger: '#E11900',
  },
  radii: {
    button: '8px',
    card: '12px',
    chip: '9999px',
  },
  heights: {
    button: '56px',
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: 'text-[32px] sm:text-[36px] font-bold tracking-tight leading-tight',
    h2: 'text-[24px] sm:text-[28px] font-bold tracking-tight leading-snug',
    h3: 'text-[18px] sm:text-[20px] font-bold tracking-tight',
    body: 'text-[16px] leading-normal',
    caption: 'text-[13px] leading-snug',
    small: 'text-[11px] font-medium tracking-wide',
  },
  shadows: {
    sheet: '0 -4px 20px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.12)',
    floating: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
    none: 'none',
  },
} as const;

export type ThemeMode = 'light' | 'dark';
export type ColorTokens = typeof tokens.light;
