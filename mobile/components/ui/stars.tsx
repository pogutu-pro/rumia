import { Pressable, View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

const FILLED = '#fbbf24';
const EMPTY = '#e2e8f0';

interface StarRowProps {
  rating: number;
  size?: number;
  gap?: number;
}

/** Display-only star row (web: fill-amber-400 / fill-slate-200, 5 stars). */
export function StarRow({ rating, size = 14, gap = 2 }: StarRowProps) {
  const filledCount = Math.round(rating);
  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={0}
          fill={star <= filledCount ? FILLED : EMPTY}
          color={star <= filledCount ? FILLED : EMPTY}
        />
      ))}
    </View>
  );
}

interface StarRatingInputProps {
  value: number;
  size?: number;
  onChange: (value: number) => void;
}

/** Tap-to-rate star input (amber filled, slate empty). Tapping the current
 * value again clears it back to 0, mirroring the previous composer behaviour. */
export function StarRatingInput({ value, size = 20, onChange }: StarRatingInputProps) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <Pressable key={star} hitSlop={6} onPress={() => onChange(star === value ? 0 : star)}>
            <Star
              size={size}
              strokeWidth={filled ? 0 : 1.5}
              stroke={filled ? FILLED : '#cbd5e1'}
              fill={filled ? FILLED : 'transparent'}
              color={filled ? FILLED : '#cbd5e1'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});