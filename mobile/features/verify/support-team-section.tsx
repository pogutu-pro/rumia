import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Crown, Headset, MessageCircle, ShieldCheck } from 'lucide-react-native';
import type { components } from '../../lib/api/types';
import { buildWhatsAppUrl } from '../../lib/utils/whatsapp';
import { palette, radii } from '../../lib/theme';

export type AgentSupport = components['schemas']['app__features__agents__schemas__AgentRead'];

interface SupportTeamSectionProps {
  agents: AgentSupport[];
  variant?: 'owner' | 'team';
}

function OwnerCard({ agent }: { agent: AgentSupport }) {
  const message = `Hello ${agent.name}, I need help with an issue on Rumia and would like to report it directly to you. Please help me resolve it.`;

  return (
    <View style={styles.ownerCard}>
      <View style={styles.cardTop}>
        <View style={styles.avatarWrap}>
          {agent.profile_photo_url ? (
            <Image source={{ uri: agent.profile_photo_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{agent.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.crownBadge}>
            <Crown size={12} color={palette.amber[600]} />
          </View>
        </View>

        <View style={styles.cardIdentity}>
          <Text style={styles.cardName} numberOfLines={1}>
            {agent.name}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.pill, styles.ownerPill]}>
              <Crown size={11} color={palette.amber[700]} />
              <Text style={styles.ownerPillText}>Platform Owner</Text>
            </View>
            <View style={[styles.pill, styles.verifiedPill]}>
              <ShieldCheck size={11} color={palette.emerald[700]} />
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          </View>
          <Text style={styles.cardBio} numberOfLines={2}>
            {agent.bio || "Rumia's main support — personally helping students verify before they pay."}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.whatsappBtn, pressed && styles.pressed]}
        onPress={() => Linking.openURL(buildWhatsAppUrl(agent.whatsapp, message))}
      >
        <MessageCircle size={16} color="#ffffff" fill="#ffffff" />
        <Text style={styles.whatsappBtnText}>WhatsApp</Text>
      </Pressable>
    </View>
  );
}

function TeamCard({ agent }: { agent: AgentSupport }) {
  const message = `Hello ${agent.name}, I'm a student on Rumia and would like help verifying a hostel before I pay.`;
  return (
    <View style={styles.teamCard}>
      <View style={styles.teamTop}>
        {agent.profile_photo_url ? (
          <Image source={{ uri: agent.profile_photo_url }} style={styles.teamAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatarFallback, styles.teamAvatar]}>
            <Text style={styles.avatarFallbackText}>{agent.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.teamName} numberOfLines={1}>
          {agent.name}
        </Text>
      </View>
      {agent.bio ? (
        <Text style={styles.teamBio} numberOfLines={2}>
          {agent.bio}
        </Text>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.whatsappBtn, pressed && styles.pressed]}
        onPress={() => Linking.openURL(buildWhatsAppUrl(agent.whatsapp, message))}
      >
        <MessageCircle size={15} color="#ffffff" fill="#ffffff" />
        <Text style={styles.whatsappBtnText}>WhatsApp</Text>
      </Pressable>
    </View>
  );
}

export function SupportTeamSection({ agents, variant }: SupportTeamSectionProps) {
  if (!agents.length) return null;

  if (variant === 'team') {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color={palette.slate[700]} />
          <Text style={styles.sectionTitle}>Customer Support Team</Text>
        </View>
        <Text style={styles.sectionSub}>
          Hand-picked helpers, also ready to assist with your verification questions.
        </Text>
        <View style={styles.teamGrid}>
          {agents.map((agent) => (
            <TeamCard key={agent.id} agent={agent} />
          ))}
        </View>
      </View>
    );
  }

  const owner = agents.find((a) => a.is_founder);
  if (!owner) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Headset size={18} color={palette.slate[700]} />
        <Text style={styles.sectionTitle}>Report an Issue or Get Help</Text>
      </View>
      <Text style={styles.sectionSub}>
        The platform owner is one WhatsApp message away. If something looks wrong or you&apos;re unsure,
        reach out directly before paying.
      </Text>
      <View style={styles.ownerWrap}>
        <OwnerCard agent={owner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, padding: 20, borderWidth: 1, borderColor: '#1B1B181A', borderRadius: radii['2xl'], backgroundColor: '#ffffff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1B1B18' },
  sectionSub: { fontSize: 12, color: '#1B1B1880', lineHeight: 18, marginTop: 4 },
  ownerWrap: { marginTop: 16 },
  ownerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 16,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: palette.amber[200] },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.emerald[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 20, fontWeight: '800', color: palette.emerald[700] },
  crownBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: '800', color: palette.slate[900] },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  ownerPill: { backgroundColor: palette.amber[50], borderWidth: 1, borderColor: palette.amber[200] },
  ownerPillText: { fontSize: 9, fontWeight: '700', color: palette.amber[700], letterSpacing: 0.6 },
  verifiedPill: { backgroundColor: palette.emerald[50], borderWidth: 1, borderColor: palette.emerald[200] },
  verifiedPillText: { fontSize: 9, fontWeight: '700', color: palette.emerald[700], letterSpacing: 0.6 },
  cardBio: { fontSize: 12, color: palette.slate[500], lineHeight: 17, marginTop: 8 },
  whatsappBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.emerald[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  whatsappBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  teamGrid: { marginTop: 14, gap: 10 },
  teamCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.slate[200],
    borderRadius: radii['2xl'],
    padding: 14,
  },
  teamTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamAvatar: { width: 34, height: 34, borderRadius: 17 },
  teamName: { fontSize: 14, fontWeight: '700', color: palette.slate[900], flex: 1 },
  teamBio: { fontSize: 11, color: palette.slate[500], lineHeight: 16, marginTop: 6 },
  pressed: { opacity: 0.8 },
});