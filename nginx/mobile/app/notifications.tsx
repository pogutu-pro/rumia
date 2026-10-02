import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  MessageCircle,
  Star,
  CalendarCheck,
  Home,
  CreditCard,
  CheckCheck,
  ChevronLeft,
  Lock,
} from 'lucide-react-native';
import type { AppNotification } from '../lib/api/schema';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, notificationsKey } from '../features/notifications/queries';
import { useSessionStore } from '../stores/session';
import { timeAgo } from '../lib/time';
import { EmptyState, Skeleton } from '../lib/components/ui';
import { palette, radii } from '../lib/theme';

function typeIcon(type: string, color: string, size: number) {
  switch (type) {
    case 'message':
      return <MessageCircle size={size} color={color} />;
    case 'review':
      return <Star size={size} color={color} />;
    case 'booking':
      return <CalendarCheck size={size} color={color} />;
    case 'listing':
      return <Home size={size} color={color} />;
    case 'payment':
      return <CreditCard size={size} color={color} />;
    default:
      return <Bell size={size} color={color} />;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  const { data, isLoading, isRefetching, refetch } = useQuery<AppNotification[]>({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    enabled: isAuthenticated,
  });

  const unreadCount = (data ?? []).filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <EmptyState
          icon={<Lock size={26} color={palette.slate[400]} />}
          title="Sign in to view notifications"
          subtitle="Get notified about new hostels, reviews and messages."
          actionLabel="Sign In"
          onAction={() => router.push('/(auth)/login')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}>
          <ChevronLeft size={22} color={palette.slate[900]} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {isLoading ? '' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        {!isLoading && unreadCount > 0 && (
          <Pressable onPress={() => markAllMutation.mutate()} disabled={markAllMutation.isPending} hitSlop={8}>
            {markAllMutation.isPending ? (
              <Text style={styles.markAllText}>Marking…</Text>
            ) : (
              <View style={styles.markAllRow}>
                <CheckCheck size={14} color={palette.emerald[700]} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <FlatList
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.listContent}
          renderItem={() => <Skeleton style={styles.skeletonRow} />}
        />
      ) : (data ?? []).length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Bell size={26} color={palette.slate[400]} />}
            title="No notifications yet"
            subtitle="When there&apos;s something new, you&apos;ll see it here."
            actionLabel="Browse Hostels"
            onAction={() => router.replace('/')}
          />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.emerald[600]} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.pressed]}
              onPress={() => {
                if (!item.read) {
                  markReadMutation.mutate(item.id);
                }
              }}
            >
              <View style={[styles.rowIcon, !item.read && styles.rowIconUnread]}>
                {typeIcon(item.type, item.read ? palette.slate[400] : palette.emerald[700], 18)}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.slate[100],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: palette.slate[900] },
  subtitle: { color: palette.slate[500], fontSize: 12, marginTop: 1 },
  markAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { color: palette.emerald[700], fontSize: 12, fontWeight: '600' },
  center: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 40, gap: 8 },
  skeletonRow: { height: 84, borderRadius: radii.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii.xl,
    padding: 14,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: palette.emerald[50],
    borderColor: palette.emerald[100],
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconUnread: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.emerald[200],
  },
  rowBody: { flex: 1 },
  rowTitle: { color: palette.slate[700], fontSize: 14, fontWeight: '600' },
  rowTitleUnread: { color: palette.slate[900], fontWeight: '700' },
  rowMessage: { color: palette.slate[500], fontSize: 13, marginTop: 2 },
  rowTime: { color: palette.slate[400], fontSize: 11, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.emerald[600] },
  pressed: { opacity: 0.6 },
});