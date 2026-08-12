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
  ink: '#17231E', muted: '#617068', primary: '#176B4D', primaryDark: '#0E523A', primarySoft: '#DDF3E8',
  cream: '#F5F3EC', surface: '#FFFFFF', background: '#F4F7F5', border: '#DDE5E0', danger: '#A33A32',
  dangerSoft: '#FBE7E4', gold: '#8A6500', field: '#FFFFFF', fieldBorder: '#C9D5CE', subtle: '#EEF3F0',
  secondaryBorder: '#B9DEC9', dangerBorder: '#F1C7C2', close: '#E8EDEA', tabInactive: '#65756D',
  progressTrack: '#E5EBE7', accentSoft: '#F1F0FF', accentBorder: '#C8C5EF', accentText: '#3F3C87',
  unreadSurface: '#FAFFFC', unreadBorder: '#9BCDB2', timestamp: '#7B8881', warning: '#9A3412',
  photoSurface: '#E8EEEA', overlay: 'rgba(12, 28, 21, .38)', onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  ink: '#F1F6F3', muted: '#AAB8B0', primary: '#3EBC84', primaryDark: '#B9F2D5', primarySoft: '#183C2E',
  cream: '#0B120E', surface: '#17211C', background: '#0F1713', border: '#34453C', danger: '#FF9B92',
  dangerSoft: '#3A211F', gold: '#F1C75B', field: '#111A16', fieldBorder: '#43564C', subtle: '#1D2A23',
  secondaryBorder: '#2C654C', dangerBorder: '#70403C', close: '#27352E', tabInactive: '#93A39A',
  progressTrack: '#2A3931', accentSoft: '#25243D', accentBorder: '#55518B', accentText: '#C8C5FF',
  unreadSurface: '#182A21', unreadBorder: '#357A58', timestamp: '#93A39A', warning: '#FFB08A',
  photoSurface: '#24332B', overlay: 'rgba(0, 0, 0, .62)', onPrimary: '#FFFFFF',
};

// Alles jäetud ainult vanade, Saarly põhivoos kasutamata Expo mallikomponentide jaoks.
export const colors = lightColors;
export const colorsFor = (mode: ThemeMode) => mode === 'dark' ? darkColors : lightColors;
export const shadowFor = (mode: ThemeMode) => ({ boxShadow: mode === 'dark' ? '0 7px 24px rgba(0, 0, 0, .24)' : '0 5px 20px rgba(22, 53, 40, .07)' }) as const;
export const shadow = shadowFor('light');
