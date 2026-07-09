import { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { formatCurrency } from '../utils/currency';
import { moneyText } from '../theme';

// Counts up (or down) to `value` with an ease-out — a small crafted detail:
// the owed amount ticks into place instead of just appearing.
export default function AnimatedMoney({
  value, style, duration = 750,
}: {
  value: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  displayRef.current = display;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (Math.abs(to - from) < 0.005) { setDisplay(to); return; }
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <Text style={[moneyText, style]}>{formatCurrency(display)}</Text>;
}
