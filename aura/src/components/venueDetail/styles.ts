/**
 * Shared stylesheet for VenueDetailScreen + its 4 tab components
 * (Overview, Events, Media, Info). Imported by all five files so each
 * component renders against the same visual system.
 */
import { Dimensions, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme';

const SCREEN_W = Dimensions.get('window').width;

export const COL2_SIZE = (SCREEN_W - SPACING.base * 2 - SPACING.sm) / 2;
export const COL3_SIZE = (SCREEN_W - SPACING.base * 2 - SPACING.sm * 2) / 3;

export const venueDetailStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  container: { flex: 1, backgroundColor: COLORS.bg },

  cover:        { height: 280, position: 'relative' },
  coverImage:   { width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  coverTopRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
  },
  coverTopRight: { flexDirection: 'row', gap: SPACING.sm },
  actionCircle: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center', justifyContent: 'center',
  },
  coverFooter: {
    position: 'absolute', bottom: SPACING.base,
    left: SPACING.base, right: SPACING.base, gap: 4,
  },
  coverBadgeRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  openBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  openText: { color: COLORS.black, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8 },
  liveBadge: {
    backgroundColor: COLORS.live + '33', borderWidth: 1, borderColor: COLORS.live,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  liveText:     { color: COLORS.live, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  vibeBadge:    { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  vibeBadgeText:{ fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  coverName:    {
    color: COLORS.white, fontSize: FONT_SIZE.display, fontWeight: FONT_WEIGHT.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  coverAddress: { color: 'rgba(255,255,255,0.75)', fontSize: FONT_SIZE.body },

  body: { padding: SPACING.base, gap: SPACING.md },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: -SPACING.xl },
  logoBox: {
    width: 72, height: 72, borderRadius: RADIUS.md,
    borderWidth: 3, borderColor: COLORS.bg,
    overflow: 'hidden', backgroundColor: COLORS.bgCard,
  },
  logo:          { width: '100%', height: '100%' },
  identityText:  { flex: 1, paddingTop: SPACING.sm, gap: 4 },
  nameBadgeRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  venueName:     { color: COLORS.text, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold },
  openPill: {
    backgroundColor: COLORS.successBg, borderWidth: 1, borderColor: COLORS.successDark,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  openPillText: { color: COLORS.success, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueType:    { color: COLORS.textSub, fontSize: FONT_SIZE.body, textTransform: 'capitalize' },
  dot:          { color: COLORS.textMuted, fontSize: FONT_SIZE.body },
  rating:       { color: COLORS.textSub, fontSize: FONT_SIZE.body },

  ctaSection:        { gap: SPACING.sm },
  ctaRow:            { flexDirection: 'row', gap: SPACING.sm },
  ctaPrimary:        {
    flex: 1, height: 46, borderRadius: RADIUS.md, backgroundColor: COLORS.purple600,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  ctaPrimaryText:    { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  ctaSecondary:      {
    flex: 1, height: 46, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
  },
  ctaSecondaryText:  { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.medium },

  tileRow: { flexDirection: 'row', gap: SPACING.sm },
  tile: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md, alignItems: 'center', gap: SPACING.xs,
  },
  tileText: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, textAlign: 'center' },

  badgeScroll: { flexGrow: 0 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.purple700,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
  },
  badgeMuted:  { borderColor: COLORS.borderLight },
  badgeText:   { color: COLORS.text, fontSize: FONT_SIZE.sm },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm,
    padding: 4, gap: 2,
  },
  tabItem: {
    flex: 1, paddingVertical: SPACING.sm,
    alignItems: 'center', borderRadius: RADIUS.sm - 2,
  },
  tabItemActive: { backgroundColor: COLORS.white },
  tabText:       { color: COLORS.textSub, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  tabTextActive: { color: COLORS.black,   fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },

  tabContent:   { gap: SPACING.md },
  tabSectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },

  openingNoteCard: {
    backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700,
    borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.sm,
  },
  openingNoteRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  openingNoteIcon: { fontSize: 16 },
  openingNoteLabel: { color: COLORS.purple400, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  openingNoteText:  { color: COLORS.text, fontSize: FONT_SIZE.body, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base, gap: SPACING.md,
  },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:    { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  seeAll:       { color: COLORS.purple400, fontSize: FONT_SIZE.body },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.live, paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  liveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.white },
  livePillText:{ color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  liveStatRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveStat:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  liveStatLabel:{ color: COLORS.textSub, fontSize: FONT_SIZE.body },
  liveStatValue:{ color: COLORS.text,    fontSize: FONT_SIZE.body },

  promoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
    backgroundColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  promoText:    { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.body },
  claimBtn:     {
    backgroundColor: COLORS.purple600, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  claimBtnText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },

  eventPreviewRow: { flexDirection: 'row', gap: SPACING.md, backgroundColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm },
  eventPreviewImg: { width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard },
  eventPreviewImgFallback: { backgroundColor: COLORS.bgCard },
  eventPreviewText: { flex: 1, gap: 4 },
  eventPreviewTitle: { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  eventPreviewDate:  { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  ticketBtn: {
    alignSelf: 'flex-start', backgroundColor: COLORS.purple600,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, marginTop: 2,
  },
  ticketBtnText: { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  mediaGrid3: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  mediaThumb3: {
    width: (SCREEN_W - SPACING.base * 2 - SPACING.base * 2 - SPACING.xs * 2) / 3,
    aspectRatio: 1, borderRadius: RADIUS.sm, overflow: 'hidden',
    backgroundColor: COLORS.border,
  },
  mediaThumbImg:     { width: '100%', height: '100%' },
  mediaThumbFallback:{ alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard },
  mediaFallbackEmoji:{ fontSize: 22 },
  mediaThumbOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaPlayIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  emptyMedia: {
    backgroundColor: COLORS.border, borderRadius: RADIUS.sm,
    padding: SPACING.xl, alignItems: 'center',
  },
  emptyMediaText: { color: COLORS.textMuted, fontSize: FONT_SIZE.body },

  eventCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, overflow: 'hidden',
  },
  eventCardImg:    { height: 160, position: 'relative' },
  eventCardOverlay:{
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  eventCardFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.md, gap: 2,
  },
  eventCardTitle:   { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  eventCardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventCardDate:    { color: COLORS.text, fontSize: FONT_SIZE.sm },
  eventCardBody:    { padding: SPACING.base, gap: SPACING.md },
  eventCardLineupLabel: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, marginBottom: SPACING.xs },
  eventCardLineup:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  performerBadge:   {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  performerBadgeText: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  eventPriceRow:    { flexDirection: 'row', gap: SPACING.sm },
  eventPriceBox:    {
    flex: 1, backgroundColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.md, gap: 4,
  },
  eventPriceBoxLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.xs },
  eventPriceBoxValue: { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  eventBtnRow:      { flexDirection: 'row', gap: SPACING.sm },
  bookBtn:          {
    flex: 1, height: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.purple600,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
  },
  bookBtnText:      { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  vipBtn:           {
    paddingHorizontal: SPACING.base, height: 42, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  vipBtnText:       { color: COLORS.text, fontSize: FONT_SIZE.body },

  mediaSectionLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  mediaSubHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaGrid2:        { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  mediaThumb2:       {
    height: COL2_SIZE, borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.border, position: 'relative',
  },
  mediaThumb2Overlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  mediaPlayIconLg:   {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  mediaThumb2Footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm,
    paddingTop: SPACING.xl,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  mediaUserBadge: {
    backgroundColor: COLORS.purpleBg40, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  mediaUserBadgeText: { color: COLORS.white, fontSize: FONT_SIZE.xs },
  mediaTime:          { color: COLORS.textSub, fontSize: FONT_SIZE.xs },

  mediaGrid3Full:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  mediaThumb3Full: {
    height: COL3_SIZE, borderRadius: RADIUS.sm, overflow: 'hidden',
    backgroundColor: COLORS.border, position: 'relative',
  },

  addVideoBtn: {
    height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  addVideoBtnText: { color: COLORS.text, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },

  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  infoLabel:       { flex: 1, color: COLORS.textSub, fontSize: FONT_SIZE.body },
  infoLabelTappable: { color: COLORS.purple400 },
  policyRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyLabel:     { color: COLORS.textSub, fontSize: FONT_SIZE.body },
  policyValue:     { color: COLORS.text,    fontSize: FONT_SIZE.body },

  emptyState: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.xxl, alignItems: 'center',
  },
  emptyStateText: { color: COLORS.textMuted, fontSize: FONT_SIZE.body, textAlign: 'center' },
});
