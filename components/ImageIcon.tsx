import Svg, { Rect, Circle, Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function ImageIcon({ size = 24, color = '#000' }: Props) {
  const s = size / 24;
  const sw = 2 * s;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Frame */}
      <Rect x="2" y="3" width="20" height="18" rx="3" ry="3"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {/* Sun dot */}
      <Circle cx="8.5" cy="8.5" r="1.5"
        stroke={color} strokeWidth={sw} />
      {/* Mountain */}
      <Path d="M2 15l5-5 4 4 3-3 8 8"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
