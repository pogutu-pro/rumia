import type { ComponentType } from 'react';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Home, Search, ShieldCheck, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../lib/theme';

type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;

/**
 * Mirrors the web PWA bottom nav (web/src/components/pwa/BottomNav.tsx):
 * Home · Search · Verify · Account. Wishlist lives under Account on web, so it
 * is kept reachable as a route but hidden from the tab bar.
 */
interface TabConfig {
  /** Route file name inside app/(tabs)/ */
  name: string;
  label: string;
  icon: IconComponent;
}

const TABS: TabConfig[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'explore', label: 'Search', icon: Search },
  { name: 'verify', label: 'Verify', icon: ShieldCheck },
  { name: 'profile', label: 'Account', icon: User },
];

function renderTabIcon(Icon: IconComponent) {
  return function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return (
      <Icon
        size={size}
        color={color as string}
        strokeWidth={focused ? 2.4 : 2}
        fill={focused ? (color as string) : 'transparent'}
      />
    );
  };
}

export default function TabLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      {TABS.map(({ name, label, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarAccessibilityLabel: label,
            tabBarIcon: renderTabIcon(icon),
          }}
        />
      ))}
      {/* Kept as a route (Wishlist) but hidden to match web PWA nav. */}
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}