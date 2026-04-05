/** Shared Joyride styles — reads CSS custom properties so it works in light and dark */

/** Build styles dynamically so they pick up the current theme */
export function getTheaterTourStyles() {
  const isDark = !document.documentElement.classList.contains('light');
  return {
    tooltip: {
      background: isDark
        ? 'linear-gradient(180deg, hsl(220, 6%, 13%) 0%, hsl(220, 5%, 9%) 100%)'
        : 'linear-gradient(180deg, hsl(40, 15%, 97%) 0%, hsl(40, 12%, 93%) 100%)',
      borderRadius: '8px',
      border: isDark
        ? '1px solid rgba(212, 175, 55, 0.15)'
        : '1px solid rgba(180, 140, 30, 0.2)',
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
      padding: '20px 24px',
      maxWidth: '360px',
      fontFamily: '"Inter", system-ui, sans-serif',
    },
    tooltipContainer: {
      textAlign: 'left' as const,
    },
    tooltipTitle: {
      fontFamily: '"Playfair Display", serif',
      color: isDark ? 'hsl(43, 74%, 55%)' : 'hsl(38, 60%, 35%)',
      fontSize: '16px',
      fontWeight: 600,
      letterSpacing: '0.01em',
      marginBottom: '4px',
    },
    tooltipContent: {
      color: isDark ? 'hsl(25, 8%, 65%)' : 'hsl(25, 10%, 40%)',
      fontSize: '13px',
      lineHeight: '1.6',
      padding: '4px 0 12px',
    },
    tooltipFooter: {
      marginTop: '0',
    },
    buttonPrimary: {
      background: 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
      color: 'hsl(220, 6%, 9%)',
      border: 'none',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      padding: '8px 18px',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(212,175,55,0.2)',
    },
    buttonBack: {
      color: isDark ? 'hsl(25, 8%, 50%)' : 'hsl(25, 10%, 45%)',
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      marginRight: '8px',
    },
    buttonClose: {
      top: '8px',
      right: '8px',
      width: '24px',
      height: '24px',
      color: isDark ? 'hsl(25, 8%, 35%)' : 'hsl(25, 10%, 55%)',
      padding: '0',
    },
    buttonSkip: {
      color: isDark ? 'hsl(25, 8%, 45%)' : 'hsl(25, 10%, 50%)',
      fontSize: '11px',
    },
    arrow: {
      color: isDark ? 'hsl(220, 6%, 13%)' : 'hsl(40, 15%, 97%)',
    },
    spotlight: {
      borderRadius: '8px',
    },
    overlay: {
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)',
    },
  };
}

/** Static reference for backwards compat — defaults to dark */
export const theaterTourStyles = {
  tooltip: {
    background: 'linear-gradient(180deg, hsl(220, 6%, 13%) 0%, hsl(220, 5%, 9%) 100%)',
    borderRadius: '8px',
    border: '1px solid rgba(212, 175, 55, 0.15)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
    padding: '20px 24px',
    maxWidth: '360px',
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  tooltipContainer: { textAlign: 'left' as const },
  tooltipTitle: {
    fontFamily: '"Playfair Display", serif',
    color: 'hsl(43, 74%, 55%)',
    fontSize: '16px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    marginBottom: '4px',
  },
  tooltipContent: {
    color: 'hsl(25, 8%, 65%)',
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '4px 0 12px',
  },
  tooltipFooter: { marginTop: '0' },
  buttonPrimary: {
    background: 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
    color: 'hsl(220, 6%, 9%)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '8px 18px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(212,175,55,0.2)',
  },
  buttonBack: { color: 'hsl(25, 8%, 50%)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginRight: '8px' },
  buttonClose: { top: '8px', right: '8px', width: '24px', height: '24px', color: 'hsl(25, 8%, 35%)', padding: '0' },
  buttonSkip: { color: 'hsl(25, 8%, 45%)', fontSize: '11px' },
  arrow: { color: 'hsl(220, 6%, 13%)' },
  spotlight: { borderRadius: '8px' },
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
};

/** Shared Joyride locale */
export const theaterTourLocale = {
  last: 'End',
  close: 'Close',
};

/** Shared Joyride options */
export const theaterTourOptions = {
  closeButtonAction: 'skip' as const,
  zIndex: 200,
  scrollOffset: 100,
};
