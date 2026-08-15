export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  ink: string; muted: string; primary: string; primaryDark: string; primarySoft: string;
  cream: string; surface: string; background: string; border: string; danger: string;
  dangerSoft: string; gold: string; field: string; fieldBorder: string; subtle: string;
  secondaryBorder: string; dangerBorder: string; close: string; tabInactive: string;
  progressTrack: string; accentSoft: string; accentBorder: string; accentText: string;
  unreadSurface: string; unreadBorder: string; timestamp: string; warning: string;
  photoSurface: string; overlay: string; onPrimary: string;
}

export const lightColors: ThemeColors = {
  ink: '#14231C', muted: '#607068', primary: '#0F7A57', primaryDark: '#07543C', primarySoft: '#E4F4EC',
  cream: '#F2F6F3', surface: '#FFFFFF', background: '#F6F8F7', border: '#DCE5E0', danger: '#B23B35',
  dangerSoft: '#FFF0EE', gold: '#8C650A', field: '#FFFFFF', fieldBorder: '#C7D4CD', subtle: '#F0F4F2',
  secondaryBorder: '#B8DCCA', dangerBorder: '#F0C4C0', close: '#EDF1EF', tabInactive: '#687870',
  progressTrack: '#E8EEEA', accentSoft: '#F1F0FA', accentBorder: '#D3D0EA', accentText: '#47417E',
  unreadSurface: '#F7FCF9', unreadBorder: '#91C9AB', timestamp: '#7B8881', warning: '#9B3B17',
  photoSurface: '#E9EFEB', overlay: 'rgba(8, 23, 16, .48)', onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  ink: '#F1F6F3', muted: '#A9B8B0', primary: '#4BCB91', primaryDark: '#BFF3D9', primarySoft: '#173B2C',
  cream: '#09110D', surface: '#142019', background: '#0C1510', border: '#2C3D34', danger: '#FF9E97',
  dangerSoft: '#3A211F', gold: '#F1CA67', field: '#101A14', fieldBorder: '#41554A', subtle: '#1B2921',
  secondaryBorder: '#2D664D', dangerBorder: '#73433F', close: '#25342C', tabInactive: '#91A198',
  progressTrack: '#29382F', accentSoft: '#24233A', accentBorder: '#565184', accentText: '#D2CFFF',
  unreadSurface: '#16281E', unreadBorder: '#367D59', timestamp: '#91A198', warning: '#FFB08A',
  photoSurface: '#223129', overlay: 'rgba(0, 0, 0, .68)', onPrimary: '#071A12',
};

// Alles jäetud ainult vanade, Saarly põhivoos kasutamata Expo mallikomponentide jaoks.
export const colors = lightColors;
export const colorsFor = (mode: ThemeMode) => mode === 'dark' ? darkColors : lightColors;
export const shadowFor = (mode: ThemeMode) => ({ boxShadow: mode === 'dark' ? '0 10px 28px rgba(0, 0, 0, .22)' : '0 1px 2px rgba(20, 35, 28, .04), 0 10px 30px rgba(20, 64, 45, .055)' }) as const;
export const shadow = shadowFor('light');
