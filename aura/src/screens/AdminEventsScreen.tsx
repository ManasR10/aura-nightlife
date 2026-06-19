/**
 * AdminEventsScreen — venue admin manages events for their venue.
 *
 * Shows upcoming/ongoing events for this venue (scraped or manually created).
 * Admins can create manual events (title, date, time, price, performers).
 * Manual events are written to /events via the adminCreateEvent callable.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { fnSouth } from '../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack, IconX } from '../components/Icon';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminEvents'>;

interface EventItem {
  id:         string;
  title:      string;
  startAt:    Date;
  status:     string;
  source:     string;
  priceText:  string | null;
  performers: string[];
}

interface NewEventForm {
  title:      string;
  dateText:   string;    // 'YYYY-MM-DD'
  timeText:   string;    // 'HH:MM'
  priceText:  string;
  performers: string;    // comma-separated
  description: string;
}

const EMPTY_FORM: NewEventForm = {
  title: '', dateText: '', timeText: '',
  priceText: '', performers: '', description: '',
};

export function AdminEventsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName } = route.params;

  const [events,       setEvents]       = useState<EventItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState<NewEventForm>(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState('');

  const loadEvents = useCallback(async () => {
    try {
      const snap = await firestore()
        .collection('events')
        .where('venueId', '==', venueId)
        .where('status', 'in', ['upcoming', 'ongoing'])
        .orderBy('startAt', 'asc')
        .limit(30)
        .get();

      setEvents(snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id:         doc.id,
          title:      d.title,
          startAt:    d.startAt?.toDate?.() ?? new Date(),
          status:     d.status,
          source:     d.source ?? 'manual',
          priceText:  d.priceText ?? null,
          performers: d.performers ?? [],
        };
      }));
    } catch (err) {
      console.error('AdminEvents load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function setField(key: keyof NewEventForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setFormError('');
  }

  async function handleSubmitEvent() {
    if (!form.title.trim()) { setFormError('Event title is required.'); return; }
    if (!form.dateText.trim() || !form.timeText.trim()) { setFormError('Date and time are required.'); return; }

    // Parse date + time into a timestamp
    const startISO = `${form.dateText.trim()}T${form.timeText.trim()}:00`;
    const startDate = new Date(startISO);
    if (isNaN(startDate.getTime())) { setFormError('Invalid date or time format.'); return; }

    setSubmitting(true);
    try {
      await fnSouth.httpsCallable('adminCreateEvent')({
        venueId,
        title:       form.title.trim(),
        startAt:     startDate.toISOString(),
        priceText:   form.priceText.trim() || null,
        performers:  form.performers.split(',').map((p) => p.trim()).filter(Boolean),
        description: form.description.trim() || null,
      });

      setShowCreate(false);
      setForm(EMPTY_FORM);
      setRefreshing(true);
      loadEvents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteEvent(ev: EventItem) {
    if (ev.source !== 'manual') {
      Alert.alert('Cannot delete', 'Scraped events can only be cancelled by AURA admins.');
      return;
    }
    Alert.alert('Remove Event', `Remove "${ev.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            // Direct Firestore writes to /events are blocked by rules.
            // Use the adminCancelEvent callable which verifies ownership server-side.
            await fnSouth.httpsCallable('adminCancelEvent')({ venueId, eventId: ev.id });
            setEvents((prev) => prev.filter((e) => e.id !== ev.id));
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove event.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <IconBack size={22} color={COLORS.textSub} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{venueName}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadEvents(); }}
            tintColor={COLORS.purple400}
          />
        }
      >
        {events.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptyText}>
              Events from BookMyShow and District appear here automatically.{'\n'}
              Use the + Add button to create a manual event.
            </Text>
            <Pressable style={styles.addEventBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.addEventBtnText}>Create Event</Text>
            </Pressable>
          </View>
        ) : (
          events.map((ev) => (
            <View key={ev.id} style={styles.eventCard}>
              <View style={styles.eventRow}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{ev.title}</Text>
                  {ev.performers.length > 0 && (
                    <Text style={styles.performers} numberOfLines={1}>
                      {ev.performers.join(' · ')}
                    </Text>
                  )}
                  <Text style={styles.eventDate}>{formatDate(ev.startAt)}</Text>
                </View>
                <View style={styles.eventMeta}>
                  <StatusBadge status={ev.status} />
                  {ev.priceText && <Text style={styles.price}>{ev.priceText}</Text>}
                  <Text style={styles.source}>{ev.source}</Text>
                </View>
              </View>
              {ev.source === 'manual' && (
                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteEvent(ev)}>
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Create Event Modal ────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
            <Text style={styles.modalTitle}>New Event</Text>
            <Pressable onPress={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormError(''); }}>
              <IconX size={22} color={COLORS.textSub} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <FormField label="Event Title *">
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(v) => setField('title', v)}
                placeholder="e.g. Saturday Night with DJ Arjun"
                placeholderTextColor={COLORS.textMuted}
              />
            </FormField>

            <View style={styles.dateTimeRow}>
              <FormField label="Date *" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={form.dateText}
                  onChangeText={(v) => setField('dateText', v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </FormField>
              <FormField label="Time *" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={form.timeText}
                  onChangeText={(v) => setField('timeText', v)}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </FormField>
            </View>

            <FormField label="Price">
              <TextInput
                style={styles.input}
                value={form.priceText}
                onChangeText={(v) => setField('priceText', v)}
                placeholder="e.g. ₹500 cover · Free before 10 PM"
                placeholderTextColor={COLORS.textMuted}
              />
            </FormField>

            <FormField label="Performers">
              <TextInput
                style={styles.input}
                value={form.performers}
                onChangeText={(v) => setField('performers', v)}
                placeholder="DJ Arjun, MC Riya (comma separated)"
                placeholderTextColor={COLORS.textMuted}
              />
            </FormField>

            <FormField label="Description">
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.description}
                onChangeText={(v) => setField('description', v)}
                placeholder="What's special about tonight?"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </FormField>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitEvent}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitBtnText}>Create Event</Text>
              }
            </Pressable>

            <Text style={styles.modalNote}>
              Event will appear live immediately and is visible to users in the app.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = status === 'ongoing' ? COLORS.success : COLORS.purple400;
  return (
    <View style={[badgeStyles.wrap, { borderColor: color + '66' }]}>
      <Text style={[badgeStyles.text, { color }]}>{status}</Text>
    </View>
  );
}

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[formStyles.wrap, style]}>
      <Text style={formStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title:    { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  subtitle: { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  addBtn: {
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs,
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
  },
  addBtnText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.xl, gap: SPACING.sm },
  emptyBox: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.base },
  emptyTitle: { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  emptyText:  { color: COLORS.textSub, fontSize: FONT_SIZE.body,   textAlign: 'center', lineHeight: 22 },
  addEventBtn: {
    marginTop: SPACING.base, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.md,
  },
  addEventBtnText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  eventCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.base, gap: SPACING.sm,
  },
  eventRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  eventInfo:  { flex: 1 },
  eventTitle: { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, marginBottom: 4 },
  performers: { color: COLORS.purple400, fontSize: FONT_SIZE.sm, marginBottom: 4 },
  eventDate:  { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  eventMeta:  { alignItems: 'flex-end', gap: SPACING.xs },
  price:      { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  source:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  deleteBtn:  { alignSelf: 'flex-end' },
  deleteBtnText: { color: COLORS.live, fontSize: FONT_SIZE.sm },
  // Modal
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  modalBody:  { padding: SPACING.xl, gap: SPACING.base, paddingBottom: SPACING.xxxl },
  dateTimeRow: { flexDirection: 'row', gap: SPACING.md },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: FONT_SIZE.body, minHeight: 44,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  formError:  { color: COLORS.live, fontSize: FONT_SIZE.body, textAlign: 'center' },
  submitBtn: {
    backgroundColor: COLORS.purple600, height: 48, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  modalNote:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  text: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
});

const formStyles = StyleSheet.create({
  wrap:  { gap: SPACING.xs },
  label: { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
});
