/**
 * Small visual atoms used by ProfileScreen — stat tile, empty card,
 * collapsible accordion, level dots, and the two reward status badges.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme';
import { IconChevDown, IconChevRight } from '../Icon';

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={a.stat}>
      <Text style={a.statNum}>{value}</Text>
      <Text style={a.statLbl}>{label}</Text>
    </View>
  );
}

export function EmptyCard({ text }: { text: string }) {
  return (
    <View style={a.emptyCard}>
      <Text style={a.emptyCardText}>{text}</Text>
    </View>
  );
}

export function AccordionSection({
  icon, title, badge, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={a.accordionWrap}>
      <Pressable style={a.accordionHd} onPress={onToggle} accessibilityRole="button">
        <View style={a.accordionLeft}>
          {icon}
          <Text style={a.accordionTitle}>{title}</Text>
          {badge != null && badge > 0 && (
            <View style={a.accordionBadge}>
              <Text style={a.accordionBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {open
          ? <IconChevDown size={18} color={COLORS.textMuted} />
          : <IconChevRight size={18} color={COLORS.textMuted} />
        }
      </Pressable>
      {open && <View style={a.accordionBody}>{children}</View>}
    </View>
  );
}

export function LevelDots({ level }: { level: number }) {
  return (
    <View style={a.levelDots}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[a.dot, level >= n && a.dotFilled]} />
      ))}
    </View>
  );
}

export function RewardStatusPill({ status }: { status: string }) {
  const cfg =
    status === 'fulfilled' ? { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'Fulfilled' } :
    status === 'paid'      ? { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'Paid'      } :
    status === 'approved'  ? { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'Approved'  } :
    status === 'rejected'  ? { bg: '#450a0a', border: '#dc2626', text: '#f87171', label: 'Rejected'  } :
                             { bg: '#1e1b4b', border: COLORS.purple700, text: COLORS.purple400, label: 'Pending' };
  return (
    <View style={[a.paidBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[a.paidBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

export function RewardStatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'claimed'  ? { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'Claimed'  } :
    status === 'unlocked' ? { bg: '#1c1917', border: '#f59e0b', text: '#fbbf24', label: 'Claim Now'} :
                            { bg: COLORS.bgCard, border: COLORS.border, text: COLORS.textMuted, label: 'In Progress' };
  return (
    <View style={[a.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[a.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={a.pbTrack}>
      <View style={[a.pbFill, { width: `${Math.min(Math.round(progress * 100), 100)}%` as `${number}%` }]} />
    </View>
  );
}

const a = StyleSheet.create({
  stat:   { flex: 1, alignItems: 'center', gap: 2 },
  statNum:{ color: COLORS.purple400, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  statLbl:{ color: COLORS.textSub, fontSize: FONT_SIZE.base },

  emptyCard:    { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.xl, alignItems: 'center' },
  emptyCardText:{ color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22 },

  accordionWrap: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginBottom: SPACING.sm, overflow: 'hidden' },
  accordionHd:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.base },
  accordionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  accordionTitle:{ color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  accordionBadge:{ backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full },
  accordionBadgeText: { color: COLORS.purple400, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  accordionBody: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.base, borderTopWidth: 1, borderTopColor: COLORS.border },

  levelDots:   { flexDirection: 'row', gap: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotFilled:   { backgroundColor: COLORS.purple500 },

  paidBadge:    { backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  paidBadgeText:{ color: '#4ade80', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },

  statusBadge:    { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  statusBadgeText:{ fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },

  pbTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  pbFill:  { height: '100%', backgroundColor: COLORS.purple500, borderRadius: 4 },
});
