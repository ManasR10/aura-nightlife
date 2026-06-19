/**
 * AdminRewardsScreen — venue admin manages their reward policy and
 * verifies redemption codes.
 *
 * Tab 1 — My Reward: configure reward type, eligibility rules, limits.
 * Tab 2 — Verify Code: staff marks a code as fulfilled + recent claims list.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Gift, CheckCircle, XCircle, Search, ChevronDown, ChevronUp } from 'lucide-react-native';
import { fnSouth } from '../firebase/fns';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack } from '../components/Icon';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminRewards'>;

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = ['🍸', '🎟️', '💸', '🍕', '🎉', '🌟', '🎁', '🍻', '🥂', '🎶'];

const TYPE_OPTIONS: Array<{ id: string; label: string; isCash: boolean }> = [
  { id: 'cash',       label: '💰 Cash',       isCash: true  },
  { id: 'free_drink', label: '🍸 Free Drink',  isCash: false },
  { id: 'discount',   label: '💸 Discount',    isCash: false },
  { id: 'free_entry', label: '🎟 Free Entry',  isCash: false },
  { id: 'guestlist',  label: '📋 Guest List',  isCash: false },
  { id: 'points',     label: '⭐ Points',       isCash: false },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveReward {
  rewardId:          string;
  title:             string;
  description:       string;
  emoji:             string;
  rewardType:        string;
  cashAmount:        number | null;
  value:             string;
  active:            boolean;
  claimCount:        number;
  requiredClips:     number;
  clipCooldown:      number;
  perUserPerNight:   number;
  maxClaimsPerNight: number;
  dailyBudgetINR:    number | null;
  createdAt:         FirebaseFirestoreTypes.Timestamp;
}

interface RewardStats {
  claimsToday:    number;
  fulfilledCount: number;
  pendingCount:   number;
  budgetUsed:     number;
  budgetRemaining: number | null;
  capsRemaining:  number;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function AdminRewardsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName } = route.params;

  const [activeReward,  setActiveReward]  = useState<ActiveReward | null>(null);
  const [recentClaims,  setRecentClaims]  = useState<any[]>([]);
  const [rewardStats,   setRewardStats]   = useState<RewardStats | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [statsLoading,  setStatsLoading]  = useState(false);
  const [tab,           setTab]           = useState<'reward' | 'verify'>('reward');

  // Basic form
  const [emoji,        setEmoji]        = useState('🍸');
  const [rewardType,   setRewardType]   = useState('free_drink');
  const [cashAmount,   setCashAmount]   = useState('');
  const [title,        setTitle]        = useState('');
  const [value,        setValue]        = useState('');
  const [description,  setDescription]  = useState('Show this code to our staff');
  const [saving,       setSaving]       = useState(false);

  // Eligibility / limits (advanced)
  const [rulesOpen,         setRulesOpen]         = useState(false);
  const [requiredClips,     setRequiredClips]     = useState(2);
  const [clipCooldown,      setClipCooldown]      = useState(30);
  const [perUserPerNight,   setPerUserPerNight]   = useState(1);
  const [maxClaimsPerNight, setMaxClaimsPerNight] = useState(100);
  const [dailyBudgetINR,    setDailyBudgetINR]    = useState('');

  // Verify tab
  const [code,         setCode]         = useState('');
  const [redeeming,    setRedeeming]    = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [rewardSnap, claimsSnap] = await Promise.all([
          firestore().collection('venueRewards')
            .where('venueId', '==', venueId)
            .where('active', '==', true)
            .limit(1).get(),
          firestore().collection('rewardClaims')
            .where('venueId', '==', venueId)
            .orderBy('createdAt', 'desc')
            .limit(20).get(),
        ]);

        if (cancelled) return;

        if (!rewardSnap.empty) {
          const d = rewardSnap.docs[0].data();
          const r: ActiveReward = {
            rewardId:          rewardSnap.docs[0].id,
            title:             d.title,
            description:       d.description,
            emoji:             d.emoji,
            rewardType:        d.rewardType ?? 'free_drink',
            cashAmount:        d.cashAmount ?? null,
            value:             d.value,
            active:            d.active,
            claimCount:        d.claimCount ?? 0,
            requiredClips:     d.eligibility?.requiredClips     ?? 2,
            clipCooldown:      d.eligibility?.clipCooldownMinutes ?? 30,
            perUserPerNight:   d.limits?.perUserPerNight   ?? 1,
            maxClaimsPerNight: d.limits?.maxClaimsPerNight ?? 100,
            dailyBudgetINR:    d.limits?.dailyBudgetINR    ?? null,
            createdAt:         d.createdAt,
          };
          setActiveReward(r);
          setEmoji(r.emoji);
          setRewardType(r.rewardType);
          setCashAmount(r.cashAmount != null ? String(r.cashAmount) : '');
          setTitle(r.title);
          setValue(r.value);
          setDescription(r.description);
          setRequiredClips(r.requiredClips);
          setClipCooldown(r.clipCooldown);
          setPerUserPerNight(r.perUserPerNight);
          setMaxClaimsPerNight(r.maxClaimsPerNight);
          setDailyBudgetINR(r.dailyBudgetINR != null ? String(r.dailyBudgetINR) : '');
        }

        setRecentClaims(claimsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Fetch stats separately (non-blocking)
        setStatsLoading(true);
        try {
          const statsRes = await fnSouth.httpsCallable('adminGetRewardStats')({ venueId });
          if (!cancelled) setRewardStats(statsRes.data as RewardStats);
        } catch { /* stats are non-critical */ }
        finally { if (!cancelled) setStatsLoading(false); }

      } catch (err) {
        console.warn('AdminRewardsScreen load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [venueId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveReward() {
    if (!title.trim() || !value.trim()) {
      Alert.alert('Fill in title and value'); return;
    }
    if (rewardType === 'cash' && (!cashAmount || isNaN(Number(cashAmount)))) {
      Alert.alert('Enter a valid cash amount'); return;
    }
    setSaving(true);
    try {
      await fnSouth.httpsCallable('adminCreateVenueReward')({
        venueId,
        title:       title.trim(),
        description: description.trim(),
        emoji,
        rewardType,
        cashAmount:  rewardType === 'cash' ? Number(cashAmount) : null,
        value:       value.trim(),
        expiresAt:   null,
        eligibility: {
          requiresCheckIn:     true,
          requiredClips,
          clipCooldownMinutes: clipCooldown,
          geoRequired:         true,
          maxDistanceMeters:   200,
        },
        limits: {
          perUserPerNight,
          maxClaimsPerNight,
          dailyBudgetINR: dailyBudgetINR ? Number(dailyBudgetINR) : null,
        },
        activeWindow: null,
      });
      Alert.alert('✅ Reward saved', 'Users can now earn this reward at your venue.');
    } catch (err: unknown) {
      Alert.alert('Save failed', (err as { message?: string })?.message ?? 'Try again.');
    } finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!activeReward) return;
    Alert.alert(
      'Deactivate reward?',
      "Users won't earn this reward until you set a new one.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate', style: 'destructive',
          onPress: async () => {
            try {
              await fnSouth.httpsCallable('adminDeactivateVenueReward')({ rewardId: activeReward.rewardId });
              setActiveReward(null);
              setTitle(''); setValue(''); setCashAmount('');
            } catch (err: unknown) {
              Alert.alert('Failed', (err as { message?: string })?.message ?? 'Try again.');
            }
          },
        },
      ],
    );
  }

  async function handleRedeem() {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      setRedeemResult({ success: false, message: 'Enter the 6-character code.' }); return;
    }
    setRedeeming(true); setRedeemResult(null);
    try {
      const res  = await fnSouth.httpsCallable('adminMarkRewardRedeemed')({ redemptionCode: c });
      const data = res.data as { title: string; value: string; emoji: string };
      setRedeemResult({ success: true, message: `${data.emoji} Fulfilled: ${data.title} — ${data.value}` });
      setCode('');
      setRecentClaims((prev) =>
        prev.map((r) => r.redemptionCode === c ? { ...r, status: 'fulfilled' } : r),
      );
      // Bump stats
      setRewardStats((prev) => prev
        ? { ...prev, fulfilledCount: prev.fulfilledCount + 1, pendingCount: Math.max(0, prev.pendingCount - 1) }
        : prev,
      );
    } catch (err: unknown) {
      setRedeemResult({
        success: false,
        message: (err as { message?: string })?.message ?? 'Code not found or already fulfilled.',
      });
    } finally { setRedeeming(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple400} size="large" />
      </View>
    );
  }

  const isCash = rewardType === 'cash';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <IconBack size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Rewards</Text>
          <Text style={s.headerSub} numberOfLines={1}>{venueName}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['reward', 'verify'] as const).map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            {t === 'reward'
              ? <Gift      size={14} color={tab === t ? COLORS.purple400 : COLORS.textMuted} />
              : <CheckCircle size={14} color={tab === t ? COLORS.purple400 : COLORS.textMuted} />
            }
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === 'reward' ? 'My Reward' : 'Verify Code'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── REWARD TAB ──────────────────────────────────────────────────── */}
        {tab === 'reward' && (
          <>
            {/* Active reward card */}
            {activeReward ? (
              <View style={s.activeCard}>
                <View style={s.activeCardTop}>
                  <Text style={s.activeEmoji}>{activeReward.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activeTitle}>{activeReward.title}</Text>
                    <Text style={s.activeValue}>{activeReward.value}</Text>
                  </View>
                  <View style={s.activeBadge}>
                    <View style={s.activeDot} />
                    <Text style={s.activeBadgeText}>Active</Text>
                  </View>
                </View>

                <View style={s.activeRules}>
                  <RuleChip label={`${activeReward.requiredClips} clips`} />
                  <RuleChip label={activeReward.clipCooldown > 0 ? `${activeReward.clipCooldown}min gap` : 'No cooldown'} />
                  <RuleChip label={`${activeReward.perUserPerNight}/user/night`} />
                  <RuleChip label={`${activeReward.maxClaimsPerNight} max/night`} />
                  {activeReward.dailyBudgetINR != null && (
                    <RuleChip label={`₹${activeReward.dailyBudgetINR} budget`} />
                  )}
                </View>

                {/* Tonight's stats */}
                <View style={s.statsRow}>
                  {statsLoading ? (
                    <ActivityIndicator color={COLORS.purple400} size="small" />
                  ) : rewardStats ? (
                    <>
                      <StatPill label="Claims tonight" value={String(rewardStats.claimsToday)} />
                      <StatPill label="Fulfilled" value={String(rewardStats.fulfilledCount)} />
                      <StatPill label="Remaining" value={String(rewardStats.capsRemaining)} />
                      {rewardStats.budgetRemaining !== null && (
                        <StatPill label="Budget left" value={`₹${rewardStats.budgetRemaining}`} highlight />
                      )}
                    </>
                  ) : null}
                </View>

                <Pressable style={s.deactivateBtn} onPress={handleDeactivate}>
                  <Text style={s.deactivateBtnText}>Deactivate</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.noRewardCard}>
                <Text style={{ fontSize: 32 }}>🎁</Text>
                <Text style={s.noRewardTitle}>No active reward</Text>
                <Text style={s.noRewardSub}>
                  Set a reward below — users earn it after checking in at your venue.
                </Text>
              </View>
            )}

            {/* Form */}
            <Text style={s.formLabel}>{activeReward ? 'UPDATE REWARD' : 'CREATE REWARD'}</Text>

            {/* Emoji */}
            <View style={s.emojiRow}>
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  style={[s.emojiBtn, emoji === e && s.emojiBtnActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={s.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            {/* Reward type */}
            <View style={s.typeRow}>
              {TYPE_OPTIONS.map((t) => (
                <Pressable
                  key={t.id}
                  style={[s.typeChip, rewardType === t.id && s.typeChipActive]}
                  onPress={() => setRewardType(t.id)}
                >
                  <Text style={[s.typeChipText, rewardType === t.id && s.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Cash amount — only for cash type */}
            {isCash && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>Cash Amount (₹)</Text>
                <TextInput
                  style={s.input}
                  value={cashAmount}
                  onChangeText={setCashAmount}
                  placeholder="e.g. 50"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={s.field}>
              <Text style={s.fieldLabel}>Reward Name</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder={isCash ? 'e.g. Cash Reward' : 'e.g. Free Welcome Drink'}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>{isCash ? 'Value displayed to user' : 'What they get'}</Text>
              <TextInput
                style={s.input}
                value={value}
                onChangeText={setValue}
                placeholder={isCash ? 'e.g. ₹50 cash' : 'e.g. 1 Cocktail of choice'}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Instructions for staff</Text>
              <TextInput
                style={s.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Show this code to bar staff"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Preview */}
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>User sees this</Text>
              <View style={s.previewInner}>
                <Text style={s.previewEmoji}>{emoji}</Text>
                <View>
                  <Text style={s.previewTitle}>{title || 'Reward Name'}</Text>
                  <Text style={s.previewValue}>{value || 'What they get'}</Text>
                </View>
              </View>
            </View>

            {/* Advanced rules toggle */}
            <Pressable style={s.rulesToggle} onPress={() => setRulesOpen((v) => !v)}>
              {rulesOpen ? <ChevronUp size={16} color={COLORS.textMuted} /> : <ChevronDown size={16} color={COLORS.textMuted} />}
              <Text style={s.rulesToggleText}>Reward Rules</Text>
              <Text style={s.rulesToggleSub}>
                {requiredClips} clips · {clipCooldown}min gap · {perUserPerNight}/user · {maxClaimsPerNight} cap
              </Text>
            </Pressable>

            {rulesOpen && (
              <View style={s.rulesPanel}>

                <Text style={s.rulesSectionLabel}>ELIGIBILITY</Text>
                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>Required Clips</Text>
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => setRequiredClips((v) => Math.max(1, v - 1))}>
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={s.stepValue}>{requiredClips}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setRequiredClips((v) => Math.min(3, v + 1))}>
                      <Text style={s.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>Clip Gap (minutes)</Text>
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => setClipCooldown((v) => Math.max(0, v - 15))}>
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={s.stepValue}>{clipCooldown}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setClipCooldown((v) => Math.min(120, v + 15))}>
                      <Text style={s.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={[s.rulesSectionLabel, { marginTop: SPACING.md }]}>LIMITS</Text>

                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>Per user per night</Text>
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => setPerUserPerNight((v) => Math.max(1, v - 1))}>
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={s.stepValue}>{perUserPerNight}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setPerUserPerNight((v) => Math.min(5, v + 1))}>
                      <Text style={s.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={s.ruleRow}>
                  <Text style={s.ruleLabel}>Max claims per night</Text>
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => setMaxClaimsPerNight((v) => Math.max(10, v - 10))}>
                      <Text style={s.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={s.stepValue}>{maxClaimsPerNight}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setMaxClaimsPerNight((v) => Math.min(500, v + 10))}>
                      <Text style={s.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[s.field, { marginTop: SPACING.sm }]}>
                  <Text style={s.fieldLabel}>Daily Budget ₹ (blank = no cap)</Text>
                  <TextInput
                    style={s.input}
                    value={dailyBudgetINR}
                    onChangeText={setDailyBudgetINR}
                    placeholder="e.g. 5000"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </View>

              </View>
            )}

            <Pressable
              style={[s.saveBtn, saving && s.btnDisabled]}
              onPress={handleSaveReward}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={s.saveBtnText}>{activeReward ? 'Update Reward' : 'Activate Reward'}</Text>
              }
            </Pressable>
          </>
        )}

        {/* ── VERIFY TAB ──────────────────────────────────────────────────── */}
        {tab === 'verify' && (
          <>
            <View style={s.redeemCard}>
              <Text style={s.redeemTitle}>Verify Redemption Code</Text>
              <Text style={s.redeemSub}>Enter the 6-character code a user shows you.</Text>

              <View style={s.codeInputRow}>
                <TextInput
                  style={s.codeInput}
                  value={code}
                  onChangeText={(t) => { setCode(t.toUpperCase().slice(0, 6)); setRedeemResult(null); }}
                  placeholder="A3K9Z2"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
                <Pressable
                  style={[s.redeemBtn, redeeming && s.btnDisabled]}
                  onPress={handleRedeem}
                  disabled={redeeming}
                >
                  {redeeming
                    ? <ActivityIndicator color={COLORS.white} size="small" />
                    : <Search size={18} color={COLORS.white} />
                  }
                </Pressable>
              </View>

              {redeemResult && (
                <View style={[
                  s.redeemResult,
                  {
                    borderColor:     redeemResult.success ? '#16a34a' : '#dc2626',
                    backgroundColor: redeemResult.success ? '#052e16' : '#450a0a',
                  },
                ]}>
                  {redeemResult.success
                    ? <CheckCircle size={16} color="#4ade80" />
                    : <XCircle    size={16} color="#f87171" />
                  }
                  <Text style={[s.redeemResultText, { color: redeemResult.success ? '#4ade80' : '#f87171' }]}>
                    {redeemResult.message}
                  </Text>
                </View>
              )}
            </View>

            {recentClaims.length > 0 && (
              <View style={s.claimsBlock}>
                <Text style={s.claimsTitle}>Recent Claims</Text>
                {recentClaims.map((r) => (
                  <View key={r.id} style={s.claimRow}>
                    <Text style={s.claimEmoji}>{r.emoji ?? '🎁'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.claimCode}>{r.redemptionCode}</Text>
                      <Text style={s.claimMeta}>
                        {r.title}  ·  {r.createdAt?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '—'}
                      </Text>
                    </View>
                    <ClaimStatusBadge status={r.status} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RuleChip({ label }: { label: string }) {
  return (
    <View style={rc.chip}>
      <Text style={rc.label}>{label}</Text>
    </View>
  );
}
const rc = StyleSheet.create({
  chip:  { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  label: { color: '#9ca3af', fontSize: 10, fontWeight: FONT_WEIGHT.medium },
});

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={sp.pill}>
      <Text style={sp.value}>{value}</Text>
      <Text style={[sp.label, highlight && { color: COLORS.purple400 }]}>{label}</Text>
    </View>
  );
}
const sp = StyleSheet.create({
  pill:  { alignItems: 'center', gap: 1 },
  value: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  label: { color: '#6b7280', fontSize: 9, textAlign: 'center' },
});

function ClaimStatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'fulfilled' ? { bg: '#052e16', border: '#16a34a', text: '#4ade80', label: 'Fulfilled' } :
    status === 'rejected'  ? { bg: '#450a0a', border: '#dc2626', text: '#f87171', label: 'Rejected'  } :
                             { bg: COLORS.purpleBg10, border: COLORS.purple700, text: COLORS.purple400, label: 'Pending' };
  return (
    <View style={[csb.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[csb.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}
const csb = StyleSheet.create({
  badge: { borderWidth: 1, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  text:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  headerSub:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  tabRow:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.md },
  tabBtnActive:    { borderBottomWidth: 2, borderBottomColor: COLORS.purple500 },
  tabBtnText:      { color: COLORS.textMuted, fontSize: FONT_SIZE.body },
  tabBtnTextActive:{ color: COLORS.purple400, fontWeight: FONT_WEIGHT.medium },

  body: { padding: SPACING.base, gap: SPACING.base, paddingBottom: 80 },

  activeCard:    { backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.md },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  activeEmoji:   { fontSize: 36 },
  activeTitle:   { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  activeValue:   { color: COLORS.purple400, fontSize: FONT_SIZE.body },
  activeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#052e16', borderWidth: 1, borderColor: '#16a34a', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  activeDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  activeBadgeText:{ color: '#4ade80', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  activeRules:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  statsRow:      { flexDirection: 'row', gap: SPACING.xl, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.purple700 },
  deactivateBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  deactivateBtnText:{ color: '#f87171', fontSize: FONT_SIZE.sm },

  noRewardCard: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm },
  noRewardTitle:{ color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  noRewardSub:  { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 20 },

  formLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8 },

  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emojiBtn: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg10 },
  emojiText: { fontSize: 22 },

  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  typeChip:          { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  typeChipActive:    { backgroundColor: COLORS.purpleBg10, borderColor: COLORS.purple700 },
  typeChipText:      { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  typeChipTextActive:{ color: COLORS.purple400 },

  field:      { gap: SPACING.xs },
  fieldLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  input: {
    height: 44, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.base, color: COLORS.text, fontSize: FONT_SIZE.body,
  },

  previewCard:  { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.sm },
  previewLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 0.5 },
  previewInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  previewEmoji: { fontSize: 36 },
  previewTitle: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  previewValue: { color: COLORS.purple400, fontSize: FONT_SIZE.body },

  rulesToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  rulesToggleText: { color: COLORS.textSub, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, flex: 1 },
  rulesToggleSub:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  rulesPanel: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.sm },
  rulesSectionLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8 },
  ruleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ruleLabel:  { color: COLORS.text, fontSize: FONT_SIZE.body },
  stepper:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepBtn:    { width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:{ color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  stepValue:  { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, minWidth: 30, textAlign: 'center' },

  saveBtn:     { height: 48, backgroundColor: COLORS.purple600, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  redeemCard:   { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.xl, gap: SPACING.md },
  redeemTitle:  { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  redeemSub:    { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  codeInputRow: { flexDirection: 'row', gap: SPACING.sm },
  codeInput: {
    flex: 1, height: 50, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, color: COLORS.text,
    fontSize: 22, fontWeight: FONT_WEIGHT.bold, letterSpacing: 6, textAlign: 'center',
  },
  redeemBtn:        { width: 50, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.purple600, alignItems: 'center', justifyContent: 'center' },
  redeemResult:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md },
  redeemResultText: { flex: 1, fontSize: FONT_SIZE.body, lineHeight: 20 },

  claimsBlock: { gap: SPACING.sm },
  claimsTitle: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  claimRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.base },
  claimEmoji:  { fontSize: 22 },
  claimCode:   { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold, letterSpacing: 3 },
  claimMeta:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
});
