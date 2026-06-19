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
import { IconX, IconClock, IconUsers } from './Icon';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  eventName: string;
  eventDate: string;
}

const PRICE_PER_PERSON_PER_HOUR = 800;

const TABLES = [
  { id: 1, seats: 2 },
  { id: 2, seats: 2 },
  { id: 3, seats: 4 },
  { id: 4, seats: 4 },
  { id: 5, seats: 6 },
  { id: 6, seats: 6 },
];

export default function BookingModal({ visible, onClose, eventName, eventDate }: BookingModalProps) {
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState(1);
  const [people, setPeople] = useState(2);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const expectedSpending = duration * people * PRICE_PER_PERSON_PER_HOUR;
  const availableTables = TABLES.filter(t => t.seats >= people);

  const handleConfirm = () => {
    if (selectedTable) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Book {eventName}</Text>
            <Text style={styles.headerSub}>{eventDate}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <IconX size={20} color={COLORS.textSub} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>
          {/* Duration */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <IconClock size={18} color={COLORS.purple400} />
              <Text style={styles.rowLabel}>Duration</Text>
            </View>
            <View style={styles.counter}>
              <Pressable style={styles.counterBtn} onPress={() => setDuration(Math.max(1, duration - 1))} hitSlop={8}>
                <Text style={styles.counterBtnText}>−</Text>
              </Pressable>
              <Text style={styles.counterValue}>{duration} hour{duration !== 1 ? 's' : ''}</Text>
              <Pressable style={styles.counterBtn} onPress={() => setDuration(Math.min(8, duration + 1))} hitSlop={8}>
                <Text style={styles.counterBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* People */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <IconUsers size={18} color={COLORS.purple400} />
              <Text style={styles.rowLabel}>People</Text>
            </View>
            <View style={styles.counter}>
              <Pressable
                style={styles.counterBtn}
                onPress={() => { setPeople(Math.max(1, people - 1)); setSelectedTable(null); }}
                hitSlop={8}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </Pressable>
              <Text style={styles.counterValue}>{people} person{people !== 1 ? 's' : ''}</Text>
              <Pressable
                style={styles.counterBtn}
                onPress={() => { setPeople(Math.min(12, people + 1)); setSelectedTable(null); }}
                hitSlop={8}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Table selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select a Table</Text>
            {availableTables.length > 0 ? (
              <>
                {/* Stage label */}
                <View style={styles.stageLabel}>
                  <Text style={styles.stageLabelText}>Stage / DJ</Text>
                </View>
                <View style={styles.tableGrid}>
                  {availableTables.map(table => (
                    <Pressable
                      key={table.id}
                      style={[styles.tableBox, selectedTable === table.id && styles.tableBoxSelected]}
                      onPress={() => setSelectedTable(table.id)}
                    >
                      <Text style={[styles.tableNum, selectedTable === table.id && styles.tableNumSelected]}>
                        T{table.id}
                      </Text>
                      <Text style={[styles.tableSeats, selectedTable === table.id && styles.tableSeatsSelected]}>
                        {table.seats} seats
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Bar label */}
                <View style={styles.barLabel}>
                  <Text style={styles.barLabelText}>Bar</Text>
                </View>
              </>
            ) : (
              <View style={styles.noTables}>
                <Text style={styles.noTablesText}>No tables for {people} people — try fewer guests</Text>
              </View>
            )}
          </View>

          {/* Minimum spend */}
          <View style={styles.spendCard}>
            <Text style={styles.spendLabel}>Minimum Spend</Text>
            <Text style={styles.spendAmount}>₹{expectedSpending.toLocaleString('en-IN')}</Text>
            <Text style={styles.spendSub}>₹{PRICE_PER_PERSON_PER_HOUR.toLocaleString('en-IN')}/person/hour</Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.base) }]}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, !selectedTable && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmText}>Confirm Booking</Text>
          </Pressable>
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

  body:        { flex: 1 },
  bodyContent: { padding: SPACING.base, gap: SPACING.md },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.base,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowLabel: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg },

  counter:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  counterBtn:    {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnText: { color: COLORS.text, fontSize: FONT_SIZE.xl, lineHeight: 22 },
  counterValue:  { color: COLORS.text, fontSize: FONT_SIZE.body, minWidth: 80, textAlign: 'center' },

  section:      { gap: SPACING.sm },
  sectionLabel: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.medium },

  stageLabel: {
    backgroundColor: COLORS.purpleBg40, borderRadius: RADIUS.sm,
    paddingVertical: SPACING.xs, alignItems: 'center', marginBottom: SPACING.sm,
  },
  stageLabelText: { color: COLORS.purple400, fontSize: FONT_SIZE.sm },

  tableGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tableBox:      {
    width: '30%', aspectRatio: 1.4,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tableBoxSelected: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg20 },
  tableNum:         { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  tableNumSelected: { color: COLORS.purple400 },
  tableSeats:       { color: COLORS.textSub, fontSize: FONT_SIZE.xs },
  tableSeatsSelected: { color: COLORS.purple400 },

  barLabel: {
    backgroundColor: COLORS.blueBg, borderRadius: RADIUS.sm,
    paddingVertical: SPACING.xs, alignItems: 'center', marginTop: SPACING.sm,
  },
  barLabelText: { color: COLORS.blue400, fontSize: FONT_SIZE.sm },

  noTables:     {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.xl, alignItems: 'center',
  },
  noTablesText: { color: COLORS.warning, fontSize: FONT_SIZE.body, textAlign: 'center' },

  spendCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.base, gap: SPACING.xs,
  },
  spendLabel:  { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  spendAmount: { color: COLORS.purple400, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  spendSub:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  footer: {
    flexDirection: 'row', gap: SPACING.sm,
    padding: SPACING.base,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText:   { color: COLORS.textSub, fontSize: FONT_SIZE.bodyLg },
  confirmBtn:   {
    flex: 2, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple600,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { backgroundColor: COLORS.purpleBg40, opacity: 0.6 },
  confirmText:  { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
});
