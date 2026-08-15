import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type AppIconName = 'list' | 'check' | 'floating' | 'notes' | 'bell' | 'chevron-down' | 'chevron-right' | 'archive' | 'image' | 'user' | 'ship' | 'plus' | 'alert' | 'edit' | 'external' | 'phone' | 'refresh' | 'sun' | 'moon' | 'camera' | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'help' | 'euro' | 'close';

export function AppIcon({ name, size = 22, color, strokeWidth = 2 }: { name: AppIconName; size?: number; color: string; strokeWidth?: number }) {
  const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {name === 'list' ? <>
      <Circle cx="5" cy="6" r="1" fill={color} />
      <Circle cx="5" cy="12" r="1" fill={color} />
      <Circle cx="5" cy="18" r="1" fill={color} />
      <Line x1="9" y1="6" x2="20" y2="6" {...common} />
      <Line x1="9" y1="12" x2="20" y2="12" {...common} />
      <Line x1="9" y1="18" x2="20" y2="18" {...common} />
    </> : null}
    {name === 'check' ? <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="m8 12 2.6 2.6L16.5 9" {...common} />
    </> : null}
    {name === 'floating' ? <Circle cx="12" cy="12" r="8.5" {...common} /> : null}
    {name === 'notes' ? <>
      <Rect x="5" y="3" width="14" height="18" rx="2.5" {...common} />
      <Line x1="8.5" y1="8" x2="15.5" y2="8" {...common} />
      <Line x1="8.5" y1="12" x2="15.5" y2="12" {...common} />
      <Line x1="8.5" y1="16" x2="13" y2="16" {...common} />
    </> : null}
    {name === 'bell' ? <>
      <Path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8Z" {...common} />
      <Path d="M10 20h4" {...common} />
    </> : null}
    {name === 'chevron-down' ? <Path d="m7 9 5 5 5-5" {...common} /> : null}
    {name === 'chevron-right' ? <Path d="m9 6 6 6-6 6" {...common} /> : null}
    {name === 'archive' ? <>
      <Rect x="4" y="5" width="16" height="15" rx="2" {...common} />
      <Path d="M3 5h18V3H3v2Zm6 5h6" {...common} />
    </> : null}
    {name === 'image' ? <>
      <Rect x="3" y="4" width="18" height="16" rx="2.5" {...common} />
      <Circle cx="9" cy="10" r="1.5" {...common} />
      <Path d="m5.5 18 4.5-4 3 2.5 2.5-2 3 3.5" {...common} />
    </> : null}
    {name === 'user' ? <>
      <Circle cx="12" cy="8" r="3.5" {...common} />
      <Path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" {...common} />
    </> : null}
    {name === 'ship' ? <>
      <Path d="M4 13h16l-2.5 5H7L4 13Z" {...common} />
      <Path d="M9 13V6h6v7M12 6V3M3 21c1.2 0 1.8-1 3-1s1.8 1 3 1 1.8-1 3-1 1.8 1 3 1 1.8-1 3-1 1.8 1 3 1" {...common} />
    </> : null}
    {name === 'plus' ? <Path d="M12 5v14M5 12h14" {...common} /> : null}
    {name === 'alert' ? <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M12 7.5v5.5M12 16.5h.01" {...common} />
    </> : null}
    {name === 'edit' ? <>
      <Path d="m14.5 5.5 4 4M5 19l2.8-.6L19 7.2 16.8 5 5.6 16.2 5 19Z" {...common} />
    </> : null}
    {name === 'external' ? <>
      <Path d="M14 5h5v5M19 5l-8 8" {...common} />
      <Path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" {...common} />
    </> : null}
    {name === 'phone' ? <Path d="M8 4 5 6c.4 6.7 6.3 12.6 13 13l2-3-4-2-1.5 2c-3-.8-5.7-3.5-6.5-6.5L10 8 8 4Z" {...common} /> : null}
    {name === 'refresh' ? <>
      <Path d="M20 7v5h-5M4 17v-5h5" {...common} />
      <Path d="M18.5 11A7 7 0 0 0 6.2 7.2L4 10M5.5 13A7 7 0 0 0 17.8 16.8L20 14" {...common} />
    </> : null}
    {name === 'sun' ? <>
      <Circle cx="12" cy="12" r="3.5" {...common} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...common} />
    </> : null}
    {name === 'moon' ? <Path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" {...common} /> : null}
    {name === 'camera' ? <>
      <Path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" {...common} />
      <Circle cx="12" cy="13" r="3.5" {...common} />
    </> : null}
    {name === 'arrow-up' ? <Path d="m7 11 5-5 5 5M12 6v12" {...common} /> : null}
    {name === 'arrow-down' ? <Path d="m7 13 5 5 5-5M12 18V6" {...common} /> : null}
    {name === 'arrow-left' ? <Path d="m14 6-6 6 6 6" {...common} /> : null}
    {name === 'help' ? <>
      <Circle cx="12" cy="12" r="9" {...common} />
      <Path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01" {...common} />
    </> : null}
    {name === 'euro' ? <>
      <Path d="M18 7.5A6 6 0 1 0 18 16.5M5 10h9M5 14h8" {...common} />
    </> : null}
    {name === 'close' ? <Path d="m6 6 12 12M18 6 6 18" {...common} /> : null}
  </Svg>;
}
