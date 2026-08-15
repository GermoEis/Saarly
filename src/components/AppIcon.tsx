import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type AppIconName = 'list' | 'check' | 'floating' | 'notes' | 'bell' | 'chevron-down' | 'chevron-right' | 'archive' | 'image' | 'user' | 'ship';

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
  </Svg>;
}
