import Svg, { Rect, Circle, Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function CameraIcon({ size = 24, color = '#000' }: Props) {
  const s = size / 24;
  const sw = 2 * s;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Body */}
      <Rect x="2" y="7" width="20" height="14" rx="3" ry="3"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {/* Viewfinder bump */}
      <Path d="M8 7V5.5C8 4.67 8.67 4 9.5 4h5C15.33 4 16 4.67 16 5.5V7"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {/* Lens */}
      <Circle cx="12" cy="14" r="3"
        stroke={color} strokeWidth={sw} />
    </Svg>
  );
}
