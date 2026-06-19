/**
 * ClaimRewardScreen — 3-step check-in flow with venue reward at the end.
 *
 * Step 1 (level 0→1): GPS verify
 * Step 2 (level 1→2): Post first clip
 * Step 3 (level 2→3): Post second clip after 30-min cooldown
 * Claim: One tap → get redemption code — no UPI, no payment
 *
 * The redemption code is shown to venue staff who verify it in their dashboard.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import firestore from '@react-native-firebase/firestore';
import { Copy, Share2 } from 'lucide-react-native';
import { fnSouth } from '../firebase/fns';
import { getNightKey } from '../utils/nightKey';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack, IconMapPin } from '../components/Icon';
import type { CheckInLevel, RewardStatus, RootStackParamList } from '../types';
import { useAuth } from '../auth/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'ClaimReward'>;

interface SessionState {
  level:                 CheckInLevel;
  rewardStatus:          RewardStatus;
  lastClipAtMs:          number | null;
  cooldownRemainingSecs: number;
}

interface ClaimedReward {
  claimId:        string;
  redemptionCode: string;
  title:          string;
  emoji:          string;
  value:          string;
  description:    string;
}

interface VenueRewardPreview {
  title:      string;
  emoji:      string;
  value:      string;
  rewardType: string;
  cashAmount: number | null;
  requiredClips:     number;
  clipCooldownMinutes: number;
}

const COOLDOWN_MS = 30 * 60 * 1000;

export function ClaimRewardScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName } = route.params;
  const { authUser } = useAuth();

  const [session,        setSession]       = useState<SessionState | null>(null);
  const [rewardPreview,  setRewardPreview] = useState<VenueRewardPreview | null>(null);
  const [loading,        setLoading]       = useState(false);
  const [error,          setError]         = useState('');
  const [claimed,        setClaimed]       = useState<ClaimedReward | null>(null);
  const [copied,         setCopied]        = useState(false);

  const [countdown,     setCountdown]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch venue reward preview so user sees what they're earning from step 1
  useEffect(() => {
    let cancelled = false;
    firestore().collection('venueRewards')
      .where('venueId', '==', venueId)
      .where('active',  '==', true)
      .limit(1)
      .get()
      .then((snap) => {
        if (cancelled || snap.empty) return;
        const d = snap.docs[0].data();
        setRewardPreview({
          title:               d.title       ?? 'Aura Reward',
          emoji:               d.emoji       ?? '🎁',
          value:               d.value       ?? '',
          rewardType:          d.rewardType  ?? 'free_drink',
          cashAmount:          d.cashAmount  ?? null,
          requiredClips:       d.eligibility?.requiredClips       ?? 2,
          clipCooldownMinutes: d.eligibility?.clipCooldownMinutes ?? 30,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [venueId]);

  const startCountdown = useCallback((lastClipAtMs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const rem = Math.max(0, Math.ceil((lastClipAtMs + COOLDOWN_MS - Date.now()) / 1000));
      setCountdown(rem);
      if (rem === 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useFocusEffect(
    useCallback(() => {
      if (!authUser?.uid) return;
      let cancelled = false;
      const nightKey  = getNightKey();
      const sessionId = `${authUser.uid}_${venueId}_${nightKey}`;

      const unsub = firestore()
        .collection('checkInSessions')
        .doc(sessionId)
        .onSnapshot((snap) => {
          if (cancelled) return;
          if (!snap.exists) { setSession(null); return; }
          const d = snap.data()!;
          const lastClipAtMs = (d.lastClipAt as { toMillis?: () => number } | null)?.toMillis?.() ?? null;
          const cooldownRemainingSecs = lastClipAtMs
            ? Math.max(0, Math.ceil((lastClipAtMs + COOLDOWN_MS - Date.now()) / 1000))
            : 0;
          const state: SessionState = {
            level:                 d.level as CheckInLevel,
            rewardStatus:          d.rewardStatus as RewardStatus,
            lastClipAtMs,
            cooldownRemainingSecs,
          };
          setSession(state);
          if (state.level === 2 && lastClipAtMs && state.rewardStatus === 'locked') {
            startCountdown(lastClipAtMs);
          }
        }, () => {});

      return () => { cancelled = true; unsub(); };
    }, [authUser?.uid, venueId, startCountdown]),
  );

  // Step 1: GPS verify

  async function handleCheckIn() {
    setLoading(true); setError('');
    try {
      const coords = await new Promise<{ latitude: number; longitude: number }>(
        (resolve, reject) =>
          Geolocation.getCurrentPosition(
            ({ coords: c }) => resolve({ latitude: c.latitude, longitude: c.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
          ),
      );
      const res = await fnSouth.httpsCallable('startCheckIn')({
        venueId, userLat: coords.latitude, userLng: coords.longitude,
      });
      setSession(res.data as SessionState);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      setError(
        msg.includes('denied') ? 'Location access denied. Enable in Settings.' :
        msg.includes('away') || msg.includes('within') ? msg :
        'Could not verify location. Please try again.',
      );
    } finally { setLoading(false); }
  }

  // Post clip

  function handlePostClip() {
    navigation.navigate('RecordVideo', { venueId, venueName, fromCheckin: true });
  }

  // Claim reward — no UPI, just one tap

  async function handleClaim() {
    setLoading(true); setError('');
    try {
      const res  = await fnSouth.httpsCallable('claimSessionReward')({ venueId });
      const data = res.data as ClaimedReward;
      // CF returns claimId (new) — handle both for backward compat during rollout
      setClaimed({ ...data, claimId: (data as any).claimId ?? (data as any).rewardId ?? '' });
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Could not claim reward. Try again.');
    } finally { setLoading(false); }
  }

  // Copy code

  function handleCopy() {
    if (!claimed) return;
    Clipboard.setString(claimed.redemptionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!claimed) return;
    try {
      await Share.share({
        message: `I earned a reward at ${venueName} on Aura!\nCode: ${claimed.redemptionCode}\n${claimed.title} — ${claimed.value}`,
      });
    } catch { /* cancelled */ }
  }

  const level        = session?.level ?? 0;
  const rewardStatus = session?.rewardStatus ?? 'locked';
  const cooldownOver = countdown === 0;

  // Claimed success screen

  if (claimed) {
    return (
      <View style={[st.container, { paddingBottom: insets.bottom }]}>
        <Header insets={insets} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={st.successBody} showsVerticalScrollIndicator={false}>

          <View style={st.successIconWrap}>
            <Text style={st.rewardEmoji}>{claimed.emoji}</Text>
          </View>
          <Text style={st.successTitle}>{claimed.title}</Text>
          <Text style={st.successValue}>{claimed.value}</Text>
          <Text style={st.successDesc}>{claimed.description}</Text>
          <Text style={st.venueBadgeText}>📍 {venueName}</Text>

          {/* Redemption code */}
          <View style={st.codeCard}>
            <Text style={st.codeLabel}>Your Redemption Code</Text>
            <Text style={st.codeText}>{claimed.redemptionCode}</Text>
            <Text style={st.codeHint}>Show this to venue staff</Text>
          </View>

          {/* Actions */}
          <View style={st.codeActions}>
            <Pressable style={st.copyBtn} onPress={handleCopy}>
              <Copy size={16} color={COLORS.purple400} />
              <Text style={st.copyBtnText}>{copied ? '✓ Copied!' : 'Copy Code'}</Text>
            </Pressable>
            <Pressable style={st.shareBtn} onPress={handleShare}>
              <Share2 size={16} color={COLORS.textSub} />
              <Text style={st.shareBtnText}>Share</Text>
            </Pressable>
          </View>

          <View style={st.validNote}>
            <Text style={st.validNoteText}>Valid for 30 days · Ref: {claimed.claimId.slice(0, 8).toUpperCase()}</Text>
          </View>

          <Pressable style={st.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={st.primaryBtnText}>Back to Venue</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Main check-in flow

  return (
    <View style={[st.container, { paddingBottom: insets.bottom }]}>
      <Header insets={insets} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>

        {/* Venue badge */}
        <View style={st.venueBadge}>
          <IconMapPin size={14} color={COLORS.purple400} />
          <Text style={st.venueBadgeText} numberOfLines={1}>{venueName}</Text>
        </View>

        {/* 3-bar progress */}
        <ProgressBar level={level} rewardStatus={rewardStatus} />

        {/* Reward preview — shown from step 1 so user knows what they're earning */}
        {rewardPreview && rewardStatus !== 'claimed' && (
          <View style={st.rewardPreviewCard}>
            <Text style={st.rewardPreviewLabel}>YOU'RE EARNING</Text>
            <View style={st.rewardPreviewRow}>
              <Text style={st.rewardPreviewEmoji}>{rewardPreview.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.rewardPreviewTitle}>{rewardPreview.title}</Text>
                <Text style={st.rewardPreviewValue}>{rewardPreview.value}</Text>
              </View>
            </View>
            <Text style={st.rewardPreviewHint}>
              {rewardPreview.requiredClips} clips · {rewardPreview.clipCooldownMinutes > 0 ? `${rewardPreview.clipCooldownMinutes}min gap` : 'no gap required'} · geo-verified
            </Text>
          </View>
        )}

        {/* Step 1 */}
        {level === 0 && (
          <View style={st.card}>
            <Text style={st.cardEmoji}>📍</Text>
            <Text style={st.cardTitle}>Confirm You're Here</Text>
            <Text style={st.cardBody}>GPS-verify your location at {venueName}.</Text>
            {error ? <Text style={st.errorText}>{error}</Text> : null}
            <Pressable style={[st.primaryBtn, loading && st.btnDisabled]} onPress={handleCheckIn} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={st.primaryBtnText}>Verify Location</Text>}
            </Pressable>
          </View>
        )}

        {/* Step 2 */}
        {level === 1 && (
          <View style={st.card}>
            <Text style={st.cardEmoji}>✅</Text>
            <Text style={st.cardTitle}>You're Checked In!</Text>
            <Text style={st.cardBody}>Post a 10-30 second clip of what's happening inside to earn the first bar.</Text>
            <Pressable style={st.primaryBtn} onPress={handlePostClip}>
              <Text style={st.primaryBtnText}>Post a Clip →</Text>
            </Pressable>
          </View>
        )}

        {/* Step 3 */}
        {level === 2 && rewardStatus === 'locked' && (
          <View style={st.card}>
            <Text style={st.cardEmoji}>🎬</Text>
            <Text style={st.cardTitle}>First Clip Posted!</Text>
            {cooldownOver ? (
              <>
                <Text style={st.cardBody}>Cooldown done. Post your second clip to unlock your reward.</Text>
                <Pressable style={st.primaryBtn} onPress={handlePostClip}>
                  <Text style={st.primaryBtnText}>Post Second Clip →</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={st.cardBody}>Come back soon to post your second clip and unlock your reward.</Text>
                <View style={st.cooldownBox}>
                  <Text style={st.cooldownLabel}>Next clip unlocks in</Text>
                  <Text style={st.cooldownTimer}>{formatCountdown(countdown)}</Text>
                </View>
                <Pressable style={[st.primaryBtn, st.btnDisabled]} disabled>
                  <Text style={st.primaryBtnText}>Post Second Clip</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Step 4 — Claim */}
        {level === 3 && rewardStatus === 'unlocked' && (
          <View style={st.card}>
            <Text style={st.cardEmoji}>🎉</Text>
            <Text style={st.cardTitle}>Reward Unlocked!</Text>
            <Text style={st.cardBody}>
              Both clips done. Tap below to claim your reward from {venueName}.
            </Text>
            {error ? <Text style={st.errorText}>{error}</Text> : null}
            <Pressable style={[st.claimBtn, loading && st.btnDisabled]} onPress={handleClaim} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={st.claimBtnText}>🎁 Claim Reward</Text>
              }
            </Pressable>
          </View>
        )}

        {/* How it works */}
        <View style={st.infoBlock}>
          <Text style={st.infoTitle}>How it works</Text>
          <InfoRow icon="📍" text="Check in within 200 m of the venue" />
          <InfoRow icon="🎬" text="Post a 10-30 s clip of the vibe" />
          <InfoRow icon="⏱"  text="Wait 30 min then post a second clip" />
          <InfoRow icon="🎁" text="Claim your reward — show the code to staff" />
        </View>

      </ScrollView>
    </View>
  );
}

// Sub-components

function Header({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  return (
    <View style={[st.header, { paddingTop: insets.top + SPACING.sm }]}>
      <Pressable style={st.backBtn} onPress={onBack} accessibilityRole="button">
        <IconBack size={22} color={COLORS.text} />
      </Pressable>
      <Text style={st.headerTitle}>Check In & Earn</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function ProgressBar({ level, rewardStatus }: { level: CheckInLevel; rewardStatus: RewardStatus }) {
  const s1 = level >= 1;
  const s2 = level >= 2;
  const s3 = level >= 3 || rewardStatus === 'claimed';
  return (
    <View style={st.progressWrap}>
      <ProgressSeg done={s1} label="Check In" />
      <View style={{ width: SPACING.xs }} />
      <ProgressSeg done={s2} label="Clip 1" />
      <View style={{ width: SPACING.xs }} />
      <ProgressSeg done={s3} label="Clip 2" />
    </View>
  );
}

function ProgressSeg({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={st.segWrap}>
      <View style={[st.segBar, done && st.segBarDone]} />
      <Text style={[st.segLabel, done && st.segLabelDone]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={st.infoRow}>
      <Text style={st.infoIcon}>{icon}</Text>
      <Text style={st.infoText}>{text}</Text>
    </View>
  );
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Styles

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' },

  body:        { padding: SPACING.base, gap: SPACING.xl, paddingBottom: SPACING.xxxl },
  successBody: { padding: SPACING.base, alignItems: 'center', gap: SPACING.base, paddingBottom: SPACING.xxxl },

  venueBadge:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'center', backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple500, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, borderRadius: RADIUS.full },
  venueBadgeText: { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, maxWidth: 220 },

  progressWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  segWrap:      { flex: 1, alignItems: 'center', gap: SPACING.xs },
  segBar:       { height: 6, borderRadius: 3, width: '100%', backgroundColor: COLORS.border },
  segBarDone:   { backgroundColor: COLORS.purple500 },
  segLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  segLabelDone: { color: COLORS.purple400 },

  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center', gap: SPACING.base,
  },
  cardEmoji: { fontSize: 48 },
  cardTitle: { color: COLORS.text,    fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  cardBody:  { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22 },

  cooldownBox:  { alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  cooldownLabel:{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  cooldownTimer:{ color: COLORS.text, fontSize: 32, fontWeight: FONT_WEIGHT.bold, fontVariant: ['tabular-nums'] },

  primaryBtn:     { alignSelf: 'stretch', backgroundColor: COLORS.purple600, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:    { opacity: 0.45 },
  primaryBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  claimBtn:     { alignSelf: 'stretch', backgroundColor: COLORS.purple600, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.purple500, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  claimBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },

  errorText: { color: COLORS.live, fontSize: FONT_SIZE.body, textAlign: 'center' },

  // Success screen
  successIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.purpleBg20, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl },
  rewardEmoji:     { fontSize: 52 },
  successTitle:    { color: COLORS.text,    fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successValue:    { color: COLORS.purple400, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successDesc:     { color: COLORS.textSub, fontSize: FONT_SIZE.body, textAlign: 'center' },

  // Code card
  codeCard: {
    alignSelf: 'stretch', backgroundColor: COLORS.bgCard,
    borderWidth: 2, borderColor: COLORS.purple700, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm,
  },
  codeLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  codeText:  { color: COLORS.white, fontSize: 40, fontWeight: FONT_WEIGHT.bold, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  codeHint:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  codeActions: { flexDirection: 'row', gap: SPACING.sm, alignSelf: 'stretch' },
  copyBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: 44, backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, borderRadius: RADIUS.md },
  copyBtnText: { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, height: 44, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md },
  shareBtnText: { color: COLORS.textSub, fontSize: FONT_SIZE.body },

  validNote: { alignItems: 'center' },
  validNoteText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // Reward preview
  rewardPreviewCard:   { backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700, borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.sm },
  rewardPreviewLabel:  { color: COLORS.purple400, fontSize: 10, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  rewardPreviewRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rewardPreviewEmoji:  { fontSize: 28 },
  rewardPreviewTitle:  { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  rewardPreviewValue:  { color: COLORS.purple400, fontSize: FONT_SIZE.body },
  rewardPreviewHint:   { color: '#6b7280', fontSize: FONT_SIZE.xs },

  // Info block
  infoBlock: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.sm },
  infoTitle: { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.xs },
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoIcon:  { fontSize: 16, width: 22, textAlign: 'center', marginTop: 1 },
  infoText:  { flex: 1, color: COLORS.textSub, fontSize: FONT_SIZE.body, lineHeight: 20 },
});
