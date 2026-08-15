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
  ink: '#18211D', muted: '#68716C', primary: '#176B4D', primaryDark: '#0F513A', primarySoft: '#EAF3EE',
  cream: '#F3F5F3', surface: '#FFFFFF', background: '#F5F6F5', border: '#E1E5E2', danger: '#A63D38',
  dangerSoft: '#FBF1F0', gold: '#856413', field: '#FFFFFF', fieldBorder: '#CBD2CD', subtle: '#F3F5F4',
  secondaryBorder: '#C8D8CF', dangerBorder: '#E8CAC7', close: '#F0F2F1', tabInactive: '#737C77',
  progressTrack: '#E7EBE8', accentSoft: '#F3F2F8', accentBorder: '#D8D5E5', accentText: '#4B4774',
  unreadSurface: '#F8FBF9', unreadBorder: '#AFCCBC', timestamp: '#828A86', warning: '#95411F',
  photoSurface: '#ECEFEC', overlay: 'rgba(12, 20, 16, .46)', onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  ink: '#F0F3F1', muted: '#A6AEA9', primary: '#45BE86', primaryDark: '#B9E9D1', primarySoft: '#19382B',
  cream: '#0D120F', surface: '#161D19', background: '#101512', border: '#303A34', danger: '#F19A94',
  dangerSoft: '#352321', gold: '#E4C56B', field: '#121814', fieldBorder: '#465149', subtle: '#1C2420',
  secondaryBorder: '#355E49', dangerBorder: '#6A4440', close: '#252D28', tabInactive: '#929B95',
  progressTrack: '#2B342F', accentSoft: '#242432', accentBorder: '#4E4D67', accentText: '#CBC9EA',
  unreadSurface: '#19251E', unreadBorder: '#3C6A53', timestamp: '#929B95', warning: '#F5AD88',
  photoSurface: '#252D28', overlay: 'rgba(0, 0, 0, .66)', onPrimary: '#07150E',
};

// Alles jäetud ainult vanade, Saarly põhivoos kasutamata Expo mallikomponentide jaoks.
export const colors = lightColors;
export const colorsFor = (mode: ThemeMode) => mode === 'dark' ? darkColors : lightColors;
export const shadowFor = (mode: ThemeMode) => ({ boxShadow: mode === 'dark' ? '0 1px 2px rgba(0, 0, 0, .24)' : '0 1px 2px rgba(20, 35, 28, .045)' }) as const;
export const shadow = shadowFor('light');
