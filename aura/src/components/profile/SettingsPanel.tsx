/**
 * SettingsPanel — the "Account & Settings" sheet inside ProfileScreen.
 * Owns the sectioned settings UI plus the inline name editor and the
 * delete-account confirmation flow.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  User, Phone, Bell, MapPin as MapPinIcon,
  FileText, Shield, Info, Trash2, ChevronRight,
  Check, X as XIcon,
} from 'lucide-react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme';
import type { UserDoc } from '../../types';

interface SettingsPanelProps {
  authUser:    FirebaseAuthTypes.User | null;
  userDoc:     UserDoc | null;
  editName:    string; setEditName: (v: string) => void;
  saving:      boolean;
  onSave:      () => void;
}

export function SettingsPanel({
  authUser, userDoc, editName, setEditName, saving, onSave,
}: SettingsPanelProps) {
  const [editingField, setEditingField] = useState<'name' | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);

  async function handleSaveField() {
    await onSave();
    setEditingField(null);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your Aura account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type "DELETE" to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await auth().currentUser?.delete();
                    } catch {
                      Alert.alert(
                        'Re-authentication required',
                        'Please sign out and sign back in, then try deleting again.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  const phone = authUser?.phoneNumber ?? '';
  const email = authUser?.email ?? '';
  const contact = phone || email || '—';

  return (
    <View style={sp.wrap}>
      <SettingsSection label="ACCOUNT">
        <SettingsRow
          icon={<User size={16} color={COLORS.purple400} />}
          label="Display Name"
          value={userDoc?.displayName || authUser?.displayName || 'Not set'}
          onPress={() => setEditingField('name')}
          showChevron
        />
        {editingField === 'name' && (
          <InlineEditor
            value={editName}
            onChange={setEditName}
            placeholder="Your name"
            saving={saving}
            onSave={handleSaveField}
            onCancel={() => setEditingField(null)}
            keyboardType="default"
          />
        )}

        <SettingsRow
          icon={<Phone size={16} color="#6b7280" />}
          label={phone ? 'Phone' : 'Email'}
          value={contact}
          locked
        />
      </SettingsSection>

      <SettingsSection label="PREFERENCES">
        <View style={sp.row}>
          <View style={sp.rowLeft}>
            <View style={sp.iconWrap}><Bell size={16} color={COLORS.purple400} /></View>
            <View>
              <Text style={sp.rowLabel}>Push Notifications</Text>
              <Text style={sp.rowSub}>Nearby venues, events & rewards</Text>
            </View>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={setNotifEnabled}
            trackColor={{ false: '#374151', true: COLORS.purple600 }}
            thumbColor={notifEnabled ? '#fff' : '#9ca3af'}
          />
        </View>

        <View style={[sp.row, sp.rowLast]}>
          <View style={sp.rowLeft}>
            <View style={sp.iconWrap}><MapPinIcon size={16} color={COLORS.purple400} /></View>
            <View>
              <Text style={sp.rowLabel}>Location Access</Text>
              <Text style={sp.rowSub}>Used only during check-ins</Text>
            </View>
          </View>
          <Text style={sp.rowBadge}>Active</Text>
        </View>
      </SettingsSection>

      <SettingsSection label="ABOUT">
        <SettingsRow
          icon={<Info size={16} color="#6b7280" />}
          label="App Version"
          value="1.0.0 (beta)"
          locked
        />
        <SettingsRow
          icon={<FileText size={16} color="#6b7280" />}
          label="Terms of Service"
          onPress={() => Linking.openURL('https://auraapp.in/terms')}
          showChevron
        />
        <SettingsRow
          icon={<Shield size={16} color="#6b7280" />}
          label="Privacy Policy"
          onPress={() => Linking.openURL('https://auraapp.in/privacy')}
          showChevron
          isLast
        />
      </SettingsSection>

      <SettingsSection label="DANGER ZONE" danger>
        <Pressable style={sp.dangerRow} onPress={handleDeleteAccount}>
          <View style={sp.rowLeft}>
            <View style={[sp.iconWrap, { backgroundColor: '#450a0a' }]}>
              <Trash2 size={16} color="#f87171" />
            </View>
            <View>
              <Text style={sp.dangerLabel}>Delete Account</Text>
              <Text style={sp.rowSub}>Permanently remove all your data</Text>
            </View>
          </View>
          <ChevronRight size={16} color="#f87171" />
        </Pressable>
      </SettingsSection>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SettingsSection({
  label, children, danger,
}: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <View style={sp.section}>
      <Text style={[sp.sectionLabel, danger && { color: '#f87171' }]}>{label}</Text>
      <View style={sp.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon, label, value, valueStyle, onPress, showChevron, locked, isLast,
}: {
  icon:         React.ReactNode;
  label:        string;
  value?:       string;
  valueStyle?:  object;
  onPress?:     () => void;
  showChevron?: boolean;
  locked?:      boolean;
  isLast?:      boolean;
}) {
  return (
    <Pressable
      style={[sp.row, isLast && sp.rowLast]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={sp.rowLeft}>
        <View style={sp.iconWrap}>{icon}</View>
        <Text style={sp.rowLabel}>{label}</Text>
      </View>
      <View style={sp.rowRight}>
        {value ? (
          <Text style={[sp.rowValue, valueStyle]} numberOfLines={1}>{value}</Text>
        ) : null}
        {showChevron && <ChevronRight size={14} color="#4b5563" />}
        {locked && <View style={sp.lockDot} />}
      </View>
    </Pressable>
  );
}

function InlineEditor({
  value, onChange, placeholder, saving, onSave, onCancel, keyboardType, hint,
}: {
  value: string; onChange: (v: string) => void;
  placeholder: string; saving: boolean;
  onSave: () => void; onCancel: () => void;
  keyboardType?: KeyboardTypeOptions; hint?: string;
}) {
  return (
    <View style={sp.editor}>
      <TextInput
        style={sp.editorInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#4b5563"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      {hint && <Text style={sp.editorHint}>{hint}</Text>}
      <View style={sp.editorActions}>
        <Pressable style={sp.editorCancelBtn} onPress={onCancel}>
          <XIcon size={14} color="#9ca3af" />
          <Text style={sp.editorCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[sp.editorSaveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Check size={14} color="#fff" />
                <Text style={sp.editorSaveText}>Save</Text>
              </>
          }
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const sp = StyleSheet.create({
  wrap:        { paddingTop: SPACING.md, gap: SPACING.lg },

  section:     { gap: SPACING.xs },
  sectionLabel:{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8, paddingHorizontal: 4 },
  sectionCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  rowRight:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, maxWidth: '45%' },
  iconWrap:{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  rowLabel:{ color: COLORS.text, fontSize: FONT_SIZE.body },
  rowSub:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 1 },
  rowValue:{ color: COLORS.textSub, fontSize: FONT_SIZE.sm, textAlign: 'right', flex: 1 },
  rowBadge:{ color: '#4ade80', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  lockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },

  dangerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
  },
  dangerLabel: { color: '#f87171', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },

  editor: {
    backgroundColor: COLORS.bgCard, paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.purple700,
    gap: SPACING.sm,
  },
  editorInput: {
    height: 40, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.purple700,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.base,
    color: COLORS.text, fontSize: FONT_SIZE.body,
  },
  editorHint:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  editorActions:{ flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end' },
  editorCancelBtn:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  editorCancelText:{ color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  editorSaveBtn:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.purple600 },
  editorSaveText:{ color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
});
