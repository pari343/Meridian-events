import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  Lock,
  Printer,
  Share2,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type {
  BookingRecord,
  CurrencyCode,
  EventItem,
  FxExchangeOrder,
  PaymentMethodType,
  TransactionRecord,
} from '../types/platform.ts';
import { CURRENCY_LIST, convertCurrency, formatMoney } from '../lib/currencies.ts';
import { QrCodeMatrix } from './QrCodeMatrix.tsx';
import { apiUrl } from '../lib/api.ts';

interface BookingPaymentModalProps {
  event: EventItem;
  initialCurrency: CurrencyCode;
  initialPromoCode?: string;
  activeFxOrder?: FxExchangeOrder | null;
  onClose: () => void;
  onCompleted: (booking: BookingRecord, transaction: TransactionRecord) => void;
}

interface PaymentIntentSummary {
  id: string;
  currency: CurrencyCode;
  subtotalInr: number;
  platformFeeInr: number;
  fxSpreadInr: number;
  discountInr: number;
  totalInr: number;
  chargedAmount: number;
  fxRateApplied: number;
  shareCodeUsed?: string;
  fxReceiptId?: string;
}

function formatCardDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function detectBrandLabel(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'Card';
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'RuPay';
  return 'Card';
}

export const BookingPaymentModal: React.FC<BookingPaymentModalProps> = ({
  event,
  initialCurrency,
  initialPromoCode = '',
  activeFxOrder,
  onClose,
  onCompleted,
}) => {
  const [step, setStep] = useState<'register' | 'payment' | 'confirmed'>('register');

  // Step 1: Registration state
  const [tierId, setTierId] = useState<string>(event.tiers[0]?.id ?? '');
  const [quantity, setQuantity] = useState<number>(1);
  const [attendeeName, setAttendeeName] = useState<string>('');
  const [attendeeEmail, setAttendeeEmail] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>(initialPromoCode);
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>(initialCurrency);

  // Payment Intent & Step 2 Gateway state
  const [intent, setIntent] = useState<PaymentIntentSummary | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bank_upi');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvc, setCardCvc] = useState<string>('');
  const [upiOrBankRef, setUpiOrBankRef] = useState<string>('');
  const [walletProvider, setWalletProvider] = useState<'google_pay' | 'apple_pay'>('google_pay');
  const [processing, setProcessing] = useState(false);
  const [threeDsStage, setThreeDsStage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 3 Confirmation
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [confirmedTxn, setConfirmedTxn] = useState<TransactionRecord | null>(null);
  const [sharedCopied, setSharedCopied] = useState(false);

  const selectedTier = event.tiers.find((t) => t.id === tierId) ?? event.tiers[0];
  const remainingSeats = selectedTier ? Math.max(0, selectedTier.capacity - selectedTier.sold) : 0;

  const refreshIntent = useCallback(
    async (currencyToUse: CurrencyCode) => {
      if (!selectedTier) return;
      setIntentLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(apiUrl('/api/payments/intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            tierId: selectedTier.id,
            quantity,
            currency: currencyToUse,
            promoCode: promoCode.trim() || undefined,
            fxReceiptId: activeFxOrder?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Could not prepare checkout session.');
        } else {
          setIntent(data.intent);
        }
      } catch {
        setErrorMsg('Connection error while preparing payment intent.');
      } finally {
        setIntentLoading(false);
      }
    },
    [event.id, selectedTier, quantity, promoCode, activeFxOrder?.id]
  );

  useEffect(() => {
    refreshIntent(payCurrency);
  }, [payCurrency, tierId, quantity, refreshIntent]);

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!attendeeName.trim()) {
      setErrorMsg('Enter the primary attendee full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail.trim())) {
      setErrorMsg('Enter a valid attendee email address for digital pass delivery.');
      return;
    }
    await refreshIntent(payCurrency);
    setStep('payment');
  };

  const handleApplyTestCard = (type: 'valid' | 'decline') => {
    setPaymentMethod('card');
    setErrorMsg(null);
    if (type === 'valid') {
      setCardNumber('4242 4242 4242 4242');
      setCardExpiry('08/29');
      setCardCvc('424');
    } else {
      setCardNumber('4000 0000 0000 0002');
      setCardExpiry('08/29');
      setCardCvc('999');
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent) return;
    setErrorMsg(null);
    setProcessing(true);
    setThreeDsStage(true);

    await new Promise((r) => setTimeout(r, 450));
    setThreeDsStage(false);

    try {
      const res = await fetch(apiUrl('/api/payments/process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.id,
          attendeeName: attendeeName.trim(),
          attendeeEmail: attendeeEmail.trim(),
          organization: organization.trim(),
          notes: notes.trim(),
          paymentMethod,
          cardNumber,
          cardExpiry,
          cardCvc,
          upiOrBankRef,
          walletProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Payment authorization declined.');
      } else {
        setConfirmedBooking(data.booking);
        setConfirmedTxn(data.transaction);
        setStep('confirmed');
        onCompleted(data.booking, data.transaction);
      }
    } catch {
      setErrorMsg('Network timeout contacting payment gateway.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSharePass = async () => {
    if (!confirmedBooking) return;
    const url = `${window.location.origin}/?event=${encodeURIComponent(confirmedBooking.eventId)}`;
    try {
      await navigator.clipboard.writeText(
        `Registered for ${confirmedBooking.eventTitle} (${confirmedBooking.passCode}) — ${url}`
      );
      setSharedCopied(true);
      setTimeout(() => setSharedCopied(false), 2000);
    } catch {
      setSharedCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-3xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4 bg-black">
          <div className="min-w-0">
            <div className="text-xs text-zinc-400">
              {event.city} · {event.dateLabel}
            </div>
            <h2
              id="booking-modal-title"
              className="font-display text-base sm:text-lg font-semibold text-zinc-50 truncate"
            >
              {event.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close registration modal"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 py-3 border-b border-zinc-800/80 flex items-center gap-6 text-xs font-medium bg-zinc-950">
          <span className={step === 'register' ? 'text-amber-400' : 'text-zinc-500'}>
            01. Registration &amp; Tier
          </span>
          <span className="text-zinc-700">/</span>
          <span className={step === 'payment' ? 'text-amber-400' : 'text-zinc-500'}>
            02. Demo Payment Simulation
          </span>
          <span className="text-zinc-700">/</span>
          <span className={step === 'confirmed' ? 'text-emerald-400' : 'text-zinc-500'}>
            03. Pass Issued
          </span>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {step === 'register' && (
            <form onSubmit={handleProceedToPayment} className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-6">
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-medium text-zinc-300 mb-2">
                    Select pass tier
                  </span>
                  <div className="space-y-2">
                    {event.tiers.map((tier) => {
                      const left = Math.max(0, tier.capacity - tier.sold);
                      const isSelected = tier.id === tierId;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={left === 0}
                          onClick={() => setTierId(tier.id)}
                          className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-zinc-800 bg-black hover:border-zinc-700'
                          } disabled:opacity-50`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-zinc-50">{tier.name}</span>
                            <span className="font-mono text-sm font-semibold text-amber-400 tabular-nums">
                              {formatMoney(convertCurrency(tier.priceInr, 'INR', payCurrency), payCurrency)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{tier.description}</p>
                          <div className="text-xs text-zinc-500 mt-1.5 tabular-nums">
                            {left} of {tier.capacity} passes available
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-medium text-zinc-300 mb-1">
                      Attendee full name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      placeholder="Aarav Mehta"
                      value={attendeeName}
                      onChange={(e) => setAttendeeName(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium text-zinc-300 mb-1">
                      Email for digital pass
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="aarav@company.in"
                      value={attendeeEmail}
                      onChange={(e) => setAttendeeEmail(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-org" className="block text-xs font-medium text-zinc-300 mb-1">
                      Organization (optional)
                    </label>
                    <input
                      id="reg-org"
                      type="text"
                      placeholder="Studio / Company"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-qty" className="block text-xs font-medium text-zinc-300 mb-1">
                      Quantity
                    </label>
                    <select
                      id="reg-qty"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {Array.from({ length: Math.min(6, Math.max(1, remainingSeats)) }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'Pass' : 'Passes'}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-notes" className="block text-xs font-medium text-zinc-300 mb-1">
                    Dietary or accessibility notes (optional)
                  </label>
                  <input
                    id="reg-notes"
                    type="text"
                    placeholder="Jain, vegan, wheelchair access, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Order Summary Side */}
              <div className="bg-black border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="reg-currency" className="block text-xs font-medium text-zinc-300 mb-1">
                      Settlement currency
                    </label>
                    <select
                      id="reg-currency"
                      value={payCurrency}
                      onChange={(e) => setPayCurrency(e.target.value as CurrencyCode)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="reg-promo" className="block text-xs font-medium text-zinc-300 mb-1">
                      Share split or promo code
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="reg-promo"
                        type="text"
                        placeholder="INDIA10 or split code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono uppercase text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => refreshIntent(payCurrency)}
                        className="px-3 py-2 text-xs font-medium bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {activeFxOrder && (
                    <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 rounded-lg px-3 py-2">
                      Locked FX Receipt <span className="font-mono font-semibold">{activeFxOrder.id}</span>{' '}
                      attached.
                    </div>
                  )}

                  {intent && (
                    <div className="pt-3 border-t border-zinc-800 space-y-2 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>
                          {selectedTier?.name} × {quantity}
                        </span>
                        <span className="font-mono tabular-nums text-zinc-200">
                          {formatMoney(intent.subtotalInr, 'INR')}
                        </span>
                      </div>
                      {intent.discountInr > 0 && (
                        <div className="flex justify-between text-emerald-400 font-medium">
                          <span>Invite / Promo credit ({intent.shareCodeUsed})</span>
                          <span className="font-mono tabular-nums">
                            -{formatMoney(intent.discountInr, 'INR')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-zinc-400">
                        <span>Gateway processing (2.5%)</span>
                        <span className="font-mono tabular-nums text-zinc-200">
                          {formatMoney(intent.platformFeeInr, 'INR')}
                        </span>
                      </div>
                      {intent.fxSpreadInr > 0 && (
                        <div className="flex justify-between text-zinc-400">
                          <span>FX conversion spread (0.4%)</span>
                          <span className="font-mono tabular-nums text-zinc-200">
                            {formatMoney(intent.fxSpreadInr, 'INR')}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline font-semibold text-zinc-50">
                        <span>Total due ({intent.currency})</span>
                        <span className="font-mono text-base tabular-nums text-amber-400">
                          {formatMoney(intent.chargedAmount, intent.currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <p role="alert" className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={intentLoading || remainingSeats < quantity}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors cursor-pointer"
                >
                  Continue to Payment Gateway
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && intent && (
            <form onSubmit={handleProcessPayment} className="grid grid-cols-1 md:grid-cols-[1.25fr_1fr] gap-6">
              <div className="space-y-5">
                <p role="note" className="rounded-lg border border-amber-700 bg-amber-950/50 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                  Demo only: no real money is charged. Do not enter real card numbers, CVCs, UPI PINs, or banking credentials. Use the sample test details shown in this demo.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Demo payment simulation · Intent {intent.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('register')}
                    className="text-xs font-medium text-amber-400 hover:underline cursor-pointer"
                  >
                    Edit attendee
                  </button>
                </div>

                {/* Payment Method Segmented Selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_upi')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      paymentMethod === 'bank_upi'
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>UPI / Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      paymentMethod === 'wallet'
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Wallet</span>
                  </button>
                </div>

                {paymentMethod === 'bank_upi' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="gw-bank-ref" className="font-medium text-zinc-300">
                        UPI ID (BHIM / PhonePe / GPay) or Bank Ref
                      </label>
                      <button
                        type="button"
                        onClick={() => setUpiOrBankRef('aarav.mehta@okicici')}
                        className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded font-medium cursor-pointer"
                      >
                        Fill Sample UPI
                      </button>
                    </div>
                    <input
                      id="gw-bank-ref"
                      type="text"
                      required
                      placeholder="name@okicici or IMPS reference"
                      value={upiOrBankRef}
                      onChange={(e) => setUpiOrBankRef(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-xs text-zinc-400">
                      Instant NPCI UPI &amp; NEFT/IMPS rail verified with zero additional surcharge.
                    </p>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Test gateway cards:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyTestCard('valid')}
                          className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded font-medium cursor-pointer"
                        >
                          Fill Valid Visa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTestCard('decline')}
                          className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded font-medium cursor-pointer"
                        >
                          Test Decline (0002)
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="gw-card-num" className="text-xs font-medium text-zinc-300">
                          Card number (Visa / Mastercard / RuPay)
                        </label>
                        <span className="text-xs font-mono font-semibold text-amber-400">
                          {detectBrandLabel(cardNumber)}
                        </span>
                      </div>
                      <input
                        id="gw-card-num"
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardDisplay(e.target.value))}
                        className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="gw-expiry" className="block text-xs font-medium text-zinc-300 mb-1">
                          Expiry (MM/YY)
                        </label>
                        <input
                          id="gw-expiry"
                          type="text"
                          required
                          maxLength={5}
                          placeholder="08/29"
                          value={cardExpiry}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                          }}
                          className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="gw-cvc" className="block text-xs font-medium text-zinc-300 mb-1">
                          Security code (CVC)
                        </label>
                        <input
                          id="gw-cvc"
                          type="password"
                          inputMode="numeric"
                          required
                          maxLength={4}
                          placeholder="424"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'wallet' && (
                  <div className="space-y-3">
                    <span className="block text-xs font-medium text-zinc-300">
                      Select digital wallet provider
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setWalletProvider('google_pay')}
                        className={`p-3 rounded-lg border text-sm font-medium text-left cursor-pointer ${
                          walletProvider === 'google_pay'
                            ? 'border-amber-500 bg-amber-500/10 text-zinc-50'
                            : 'border-zinc-800 bg-black text-zinc-300'
                        }`}
                      >
                        Google Pay Token
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletProvider('apple_pay')}
                        className={`p-3 rounded-lg border text-sm font-medium text-left cursor-pointer ${
                          walletProvider === 'apple_pay'
                            ? 'border-amber-500 bg-amber-500/10 text-zinc-50'
                            : 'border-zinc-800 bg-black text-zinc-300'
                        }`}
                      >
                        Apple Pay Express
                      </button>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3.5 py-2.5"
                  >
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Settlement Summary */}
              <div className="bg-black border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="font-medium text-zinc-100 text-sm">Settlement summary</div>
                  <div className="text-zinc-400">
                    Attendee: <span className="font-medium text-zinc-100">{attendeeName}</span>
                  </div>
                  <div className="text-zinc-400">
                    Email: <span className="font-mono text-zinc-300">{attendeeEmail}</span>
                  </div>

                  <div className="pt-2 border-t border-zinc-800">
                    <label htmlFor="gw-currency-switch" className="block text-xs font-medium text-zinc-300 mb-1">
                      Charge currency
                    </label>
                    <select
                      id="gw-currency-switch"
                      value={payCurrency}
                      onChange={(e) => setPayCurrency(e.target.value as CurrencyCode)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-100 cursor-pointer"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                    <div className="flex justify-between text-zinc-400">
                      <span>FX Rate Applied</span>
                      <span className="font-mono tabular-nums text-zinc-200">
                        1 INR = {intent.fxRateApplied.toFixed(4)} {intent.currency}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-zinc-50 text-sm pt-1">
                      <span>Authorize &amp; Pay</span>
                      <span className="font-mono tabular-nums text-amber-400">
                        {formatMoney(intent.chargedAmount, intent.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {threeDsStage
                      ? 'Verifying 3DS / UPI...'
                      : processing
                      ? 'Settling Transaction...'
                      : `Pay ${formatMoney(intent.chargedAmount, intent.currency)}`}
                  </span>
                </button>
              </div>
            </form>
          )}

          {step === 'confirmed' && confirmedBooking && confirmedTxn && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-950/40 border border-emerald-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200">
                      Registration confirmed and payment settled
                    </h3>
                    <p className="text-xs text-emerald-300/80 mt-0.5">
                      Transaction <span className="font-mono font-semibold">{confirmedTxn.id}</span>{' '}
                      via {confirmedTxn.paymentBrand}
                      {confirmedTxn.last4 ? ` •••• ${confirmedTxn.last4}` : ''} · Organizer analytics
                      updated in real time.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-300 tabular-nums shrink-0">
                  {formatMoney(confirmedBooking.paidAmount, confirmedBooking.paidCurrency)}
                </span>
              </div>

              <div className="border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-black">
                <div className="space-y-2">
                  <div className="text-xs text-zinc-400">
                    Digital Event Pass · {confirmedBooking.tierName} × {confirmedBooking.quantity}
                  </div>
                  <div className="font-display text-xl font-bold text-zinc-50">
                    {confirmedBooking.attendeeName}
                  </div>
                  <div className="text-sm text-zinc-300">{confirmedBooking.eventTitle}</div>
                  <div className="text-xs text-zinc-400">
                    {confirmedBooking.eventDateLabel} · {confirmedBooking.venue}
                  </div>
                  <div className="pt-2 font-mono text-sm font-semibold text-amber-400">
                    Pass Code: {confirmedBooking.passCode}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 shrink-0">
                  <QrCodeMatrix value={confirmedBooking.passCode} size={112} />
                  <span className="text-[11px] font-mono text-zinc-400">Scan at venue entry</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Pass</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSharePass}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{sharedCopied ? 'Copied Invite' : 'Share Event'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
