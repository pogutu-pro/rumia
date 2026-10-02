import type { ReactNode } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, radii } from '../../lib/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: number;
  scrollable?: boolean;
}

/**
 * Mobile bottom-sheet modal matching the web mobile sheet:
 *  - white, rounded-t-[24px]
 *  - drag handle w-9 h-[3px] rounded-full bg-gray-300
 *  - shadow-[0_-4px_30px_rgba(0,0,0,0.12)]
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight,
  scrollable = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const content = (
    <View
      style={[
        styles.sheet,
        maxHeight != null ? { maxHeight } : styles.maxHeight,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>
      {scrollable ? (
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>{children}</View>
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,6,23,0.4)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radii['4xl'],
    borderTopRightRadius: radii['4xl'],
    ...shadows.sheet,
  },
  maxHeight: { maxHeight: '92%' },
  handleWrap: { justifyContent: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#d1d5db', alignSelf: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});