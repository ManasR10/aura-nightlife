import React, { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { IconBack, IconPercent, IconTag, IconCheckCircle, IconWallet, IconCreditCard, IconRupee } from './Icon';

interface Offer {
  id: string;
  label: string;
  description: string;
  type: 'flat' | 'percent' | 'cashback';
  value: number;
}

interface PayViaAuraModalProps {
  visible: boolean;
  onClose: () => void;
  venueName: string;
}

const BASE_OFFERS: Offer[] = [
  { id: 'flat10',    label: 'Flat 10% OFF',   description: 'on bill payment',    type: 'percent',  value: 10  },
  { id: 'cashback10',label: '10% cashback',   description: 'after bill payment', type: 'cashback', value: 10  },
  { id: 'flat200',   label: 'Flat ₹200 OFF',  description: 'via Aura Wallet',    type: 'flat',     value: 200 },
];

export default function PayViaAuraModal({ visible, onClose, venueName }: PayViaAuraModalProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep]             = useState<'enter' | 'cart'>('enter');
  const [billAmount, setBillAmount]  = useState('');
  const [appliedOffers, setAppliedOffers] = useState<string[]>([]);

  const amount = parseInt(billAmount, 10) || 0;

  const bankOffers = [
    { id: 'bank1', label: `Flat ₹${Math.round(amount * 0.045)} OFF`, bank: 'HDFC Card' },
    { id: 'bank2', label: `Flat ₹${Math.round(amount * 0.01)} OFF`,  bank: 'SBI Card'  },
  ];

  const toggleOffer = (id: string) => {
    setAppliedOffers(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id],
    );
  };

  const getDiscount = () => {
    let discount = 0;
    appliedOffers.forEach(id => {
      const offer = BASE_OFFERS.find(o => o.id === id);
      if (offer) {
        if (offer.type === 'percent') discount += amount * (offer.value / 100);
        if (offer.type === 'flat')    discount += offer.value;
      }
      const bank = bankOffers.find(b => b.id === id);
      if (bank) {
        const match = bank.label.match(/₹(\d+)/);
        discount += match ? parseInt(match[1], 10) : 0;
      }
    });
    return Math.min(discount, amount);
  };

  const getCashback = () =>
    appliedOffers.includes('cashback10') ? Math.round(amount * 0.1) : 0;

  const discount    = getDiscount();
  const finalAmount = amount - discount;
  const cashback    = getCashback();

  const handleReset = () => {
    setStep('enter');
    setBillAmount('');
    setAppliedOffers([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerBack}
            onPress={step === 'cart' ? () => setStep('enter') : handleClose}
            hitSlop={8}
          >
            <IconBack size={20} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{venueName}</Text>
            <Text style={styles.headerSub}>Pay via Aura</Text>
          </View>
        </View>

        {step === 'enter' ? (
          /* Step 1: Enter bill amount */
          <Pressable style={styles.enterContainer} onPress={Keyboard.dismiss}>
            <View style={styles.amountCard}>
              <Text style={styles.amountCardLabel}>Enter Bill Amount</Text>
              <View style={styles.amountRow}>
                <IconRupee size={28} color={COLORS.text} />
                <TextInput
                  style={styles.amountInput}
                  value={billAmount}
                  onChangeText={setBillAmount}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
              <Text style={styles.amountHint}>Proceed to cart for all offers</Text>
            </View>

            {/* Offer previews */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.offerScroll}>
              {BASE_OFFERS.slice(0, 2).map(offer => (
                <View key={offer.id} style={styles.offerPreview}>
                  <View style={styles.offerPreviewIcon}>
                    <IconPercent size={16} color={COLORS.purple400} />
                  </View>
                  <View>
                    <Text style={styles.offerPreviewLabel}>{offer.label}</Text>
                    <Text style={styles.offerPreviewDesc}>{offer.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.proceedBtn, amount <= 0 && styles.proceedBtnDisabled]}
              onPress={() => { if (amount > 0) { Keyboard.dismiss(); setStep('cart'); } }}
            >
              <Text style={styles.proceedBtnText}>Proceed to cart</Text>
            </Pressable>
          </Pressable>
        ) : (
          /* Step 2: Cart with offers */
          <View style={styles.cartWrapper}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cartBody}>
              {/* Savings banner */}
              {discount > 0 && (
                <View style={styles.savingsBanner}>
                  <Text style={styles.savingsBannerText}>
                    🎉 You're saving ₹{discount.toLocaleString('en-IN')} on this bill
                  </Text>
                </View>
              )}

              {/* Amount card */}
              <View style={styles.totalCard}>
                <Text style={styles.totalAmount}>₹{finalAmount.toLocaleString('en-IN')}</Text>
                {discount > 0 && (
                  <Text style={styles.totalOriginal}>₹{amount.toLocaleString('en-IN')}</Text>
                )}
                <Pressable onPress={() => setStep('enter')}>
                  <Text style={styles.editAmount}>Edit amount</Text>
                </Pressable>
              </View>

              {/* Assured cashback */}
              {cashback > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>ASSURED CASHBACK</Text>
                  <View style={styles.cashbackRow}>
                    <View style={styles.cashbackLeft}>
                      <View style={styles.offerIcon}>
                        <IconPercent size={16} color={COLORS.purple400} />
                      </View>
                      <View>
                        <Text style={styles.offerName}>10% cashback</Text>
                        <Text style={styles.offerDesc}>Valid on your next transaction</Text>
                      </View>
                    </View>
                    <Text style={styles.cashbackAmount}>₹{cashback.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              )}

              {/* Available offers */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>AVAILABLE OFFERS</Text>
                {BASE_OFFERS.map(offer => {
                  const isApplied = appliedOffers.includes(offer.id);
                  const savedAmount =
                    offer.type === 'percent' ? Math.round(amount * (offer.value / 100)) :
                    offer.type === 'flat'    ? offer.value : 0;
                  return (
                    <Pressable
                      key={offer.id}
                      style={[styles.offerRow, isApplied && styles.offerRowApplied]}
                      onPress={() => { if (offer.type !== 'cashback') toggleOffer(offer.id); }}
                    >
                      <View style={styles.offerLeft}>
                        {isApplied
                          ? <IconCheckCircle size={20} color={COLORS.success} />
                          : <IconTag size={18} color={COLORS.textMuted} />
                        }
                        <View>
                          <Text style={styles.offerName}>
                            {isApplied && savedAmount > 0
                              ? `You saved ₹${savedAmount.toLocaleString('en-IN')} 🎉`
                              : offer.label}
                          </Text>
                          <Text style={styles.offerDesc}>{offer.description}</Text>
                        </View>
                      </View>
                      {offer.type !== 'cashback' && (
                        <Text style={isApplied ? styles.offerRemove : styles.offerApply}>
                          {isApplied ? 'Remove' : 'Apply'}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Bank offers */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BANK OFFERS</Text>
                <View style={styles.bankGrid}>
                  {bankOffers.map(bank => {
                    const isApplied = appliedOffers.includes(bank.id);
                    return (
                      <Pressable
                        key={bank.id}
                        style={[styles.bankCard, isApplied && styles.bankCardApplied]}
                        onPress={() => toggleOffer(bank.id)}
                      >
                        <View style={styles.bankIcon}>
                          <IconRupee size={14} color={COLORS.purple400} />
                        </View>
                        <Text style={styles.bankLabel}>{bank.label}</Text>
                        <Text style={styles.bankName}>{bank.bank}</Text>
                        <Text style={isApplied ? styles.offerRemove : styles.offerApply}>
                          {isApplied ? 'Remove' : 'Apply'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Aura Wallet */}
              <View style={styles.walletRow}>
                <View style={styles.walletLeft}>
                  <IconWallet size={18} color={COLORS.purple400} />
                  <View>
                    <Text style={styles.walletTitle}>Aura Wallet</Text>
                    <Text style={styles.walletSub}>Balance: ₹0 · Add money</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Pay bar */}
            <View style={[styles.payBar, { paddingBottom: Math.max(insets.bottom, SPACING.base) }]}>
              <View style={styles.payBarLeft}>
                <IconCreditCard size={16} color={COLORS.textSub} />
                <Text style={styles.payBarLabel}>PAY USING</Text>
              </View>
              <Pressable style={styles.payBtn} onPress={handleClose}>
                <Text style={styles.payBtnAmount}>₹{finalAmount.toLocaleString('en-IN')}</Text>
                <Text style={styles.payBtnSub}>Pay Bill ›</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText:  { flex: 1 },
  headerTitle: { color: COLORS.text,    fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },
  headerSub:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  /* Step 1 */
  enterContainer: { flex: 1, padding: SPACING.base, gap: SPACING.lg, justifyContent: 'center' },
  amountCard:     {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.xxl, alignItems: 'center', gap: SPACING.sm,
  },
  amountCardLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.xs, letterSpacing: 1.5, textTransform: 'uppercase' },
  amountRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  amountInput:     {
    fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold, color: COLORS.text,
    width: 160, textAlign: 'center', padding: 0,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  amountHint:  { color: COLORS.purple400, fontSize: FONT_SIZE.body },

  offerScroll:   { flexGrow: 0 },
  offerPreview:  {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginRight: SPACING.sm, minWidth: 180,
  },
  offerPreviewIcon:  {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.purpleBg10, alignItems: 'center', justifyContent: 'center',
  },
  offerPreviewLabel: { color: COLORS.text,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  offerPreviewDesc:  { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  proceedBtn: {
    height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple600, alignItems: 'center', justifyContent: 'center',
  },
  proceedBtnDisabled: { opacity: 0.4 },
  proceedBtnText: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.semibold },

  /* Step 2 */
  cartWrapper: { flex: 1 },
  cartBody:    { padding: SPACING.base, gap: SPACING.md, paddingBottom: SPACING.xxl },

  savingsBanner: {
    backgroundColor: COLORS.purpleBg10, borderWidth: 1, borderColor: COLORS.purple700,
    borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center',
  },
  savingsBannerText: { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },

  totalCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: SPACING.xs,
  },
  totalAmount:   { color: COLORS.text,    fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  totalOriginal: { color: COLORS.textMuted, fontSize: FONT_SIZE.lg, textDecorationLine: 'line-through' },
  editAmount:    { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },

  section:      { gap: SPACING.sm },
  sectionLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1.5 },

  cashbackRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base,
  },
  cashbackLeft:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cashbackAmount: { color: COLORS.text, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },

  offerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base,
  },
  offerRowApplied: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg10 },
  offerLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  offerIcon:  {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.purpleBg10, alignItems: 'center', justifyContent: 'center',
  },
  offerName:   { color: COLORS.text,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  offerDesc:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },
  offerApply:  { color: COLORS.purple400, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  offerRemove: { color: '#f87171', fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },

  bankGrid: { flexDirection: 'row', gap: SPACING.sm },
  bankCard: {
    flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs,
  },
  bankCardApplied: { borderColor: COLORS.purple500, backgroundColor: COLORS.purpleBg10 },
  bankIcon: {
    width: 28, height: 28, borderRadius: RADIUS.full,
    backgroundColor: COLORS.purpleBg10, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  bankLabel: { color: COLORS.text,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  bankName:  { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.base,
  },
  walletLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  walletTitle: { color: COLORS.text,    fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  walletSub:   { color: COLORS.textSub, fontSize: FONT_SIZE.sm },

  payBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg, paddingHorizontal: SPACING.base, paddingTop: SPACING.md,
  },
  payBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  payBarLabel: { color: COLORS.textSub, fontSize: FONT_SIZE.xs, letterSpacing: 1 },
  payBtn: {
    backgroundColor: COLORS.live, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  payBtnAmount: { color: COLORS.white, fontSize: FONT_SIZE.bodyLg, fontWeight: FONT_WEIGHT.bold },
  payBtnSub:    { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZE.sm },
});
