import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconX, IconPartyPopper, IconUsers, IconHouse, IconHeart } from './Icon';

interface VIPOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  venueName: string;
}

const PRIVATE_EVENTS = [
  {
    id: 'birthday',
    title: 'Birthday Celebration',
    Icon: IconPartyPopper,
    minPeople: 20,
    description: 'Celebrate your special day with exclusive venue access',
  },
  {
    id: 'corporate',
    title: 'Corporate Events',
    Icon: IconUsers,
    minPeople: 30,
    description: 'Team building, conferences, and company celebrations',
  },
  {
    id: 'venue-buyout',
    title: 'Full Venue Buyout',
    Icon: IconHouse,
    minPeople: 100,
    description: 'Complete privacy with exclusive access to the entire venue',
  },
  {
    id: 'wedding',
    title: 'Wedding Events',
    Icon: IconHeart,
    minPeople: 50,
    description: 'Make your wedding celebration unforgettable',
  },
];

export default function VIPOptionsModal({ visible, onClose, venueName }: VIPOptionsModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>VIP & Private Events</Text>
            <Text style={styles.headerSub}>Host your private event at {venueName}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <IconX size={20} color={COLORS.textSub} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {PRIVATE_EVENTS.map(event => {
            const isSelected = selectedOption === event.id;
            return (
              <Pressable
                key={event.id}
                style={[styles.eventCard, isSelected && styles.eventCardSelected]}
                onPress={() => setSelectedOption(event.id)}
              >
                <View style={styles.eventIcon}>
                  <event.Icon size={24} color={COLORS.purple400} />
                </View>
                <View style={styles.eventText}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventDesc}>{event.description}</Text>
                  <View style={styles.eventBadge}>
                    <Text style={styles.eventBadgeText}>Min. {event.minPeople} people</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.base) }]}>
          <Pressable
            style={[styles.requestBtn, !selectedOption && styles.requestBtnDisabled]}
            onPress={() => { if (selectedOption) onClose(); }}
          >
            <Text style={styles.requestBtnText}>Request Private Event</Text>
          </Pressable>
          <Text style={styles.footerNote}>
            Our events team will contact you within 24 hours
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerText: { flex: 1 },
  headerTitle: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  headerSub:   { color: COLORS.textSub, fontSize: FONT_SIZE.body, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { padding: SPACING.base, gap: SPACING.md },

  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.base,
  },
  eventCardSelected: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg10 },

  eventIcon: {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.purpleBg10,
    alignItems: 'center', justifyContent: 'center',
  },
  eventText:  { flex: 1, gap: SPACING.xs },
  eventTitle: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  eventDesc:  { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  eventBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  eventBadgeText: { color: COLORS.purple400, fontSize: FONT_SIZE.sm },

  footer: {
    padding: SPACING.base, gap: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  requestBtn: {
    height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple600,
    alignItems: 'center', justifyContent: 'center',
  },
  requestBtnDisabled: { backgroundColor: COLORS.purpleBg40, opacity: 0.6 },
  requestBtnText:     { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  footerNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
});
