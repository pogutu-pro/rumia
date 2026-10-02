import React, { type ComponentType, useState } from 'react';
import { Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Text, View, type ColorValue } from 'react-native';
import { Home, Search, ShieldCheck, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, palette } from '../../lib/theme';
import { useSessionStore } from '../../stores/session';

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
  { name: 'profile', label: 'Account', icon: User }
];

function renderTabIcon(Icon: IconComponent) {
  return function TabIcon({
    color,
    focused,
    size
  }: {
    color: ColorValue;
    focused: boolean;
    size: number;
  }) {
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

function getInitials(name?: string, email?: string) {
  const source = (name || email || '').trim();
  if (!source) {
    return 'R';
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2);
  }

  return source.slice(0, 2).toUpperCase();
}

function AccountTabIcon({
  color,
  focused,
  size
}: {
  color: ColorValue;
  focused: boolean;
  size: number;
}) {
  const user = useSessionStore((state) => state.user);
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUri = user?.avatar_url && !imageFailed ? user.avatar_url : null;
  const initials = getInitials(user?.full_name, user?.email);

  return (
    <View
      style={{
        width: size + 8,
        height: size + 8,
        borderRadius: 999,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: avatarUri
          ? palette.slate[100]
          : focused
            ? palette.emerald[100]
            : palette.slate[100],
        borderWidth: 1,
        borderColor: focused ? (color as string) : palette.slate[200]
      }}
    >
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <Text
          style={{
            color: focused ? (color as string) : palette.slate[700],
            fontSize: Math.max(size * 0.38, 9),
            fontWeight: '700'
          }}
        >
          {initials}
        </Text>
      ) : (
        <User size={size * 0.66} color={color as string} />
      )}
    </View>
  );
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
          paddingTop: 6
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' }
      }}
    >
      {TABS.map(({ name, label, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarAccessibilityLabel: label,
            tabBarIcon: ({ color, focused, size }) =>
              name === 'profile' ? (
                <AccountTabIcon color={color} focused={focused} size={size} />
              ) : (
                renderTabIcon(icon)({ color, focused, size })
              )
          }}
        />
      ))}
      {/* Kept as a route (Wishlist) but hidden to match web PWA nav. */}
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}
