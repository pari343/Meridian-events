import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Check, Copy, Lock, Share2, Ticket } from 'lucide-react';
import type {
  CurrencyCode,
  EventItem,
  FxExchangeOrder,
  ShareSplitLink,
} from '../types/platform.ts';
import { CURRENCY_LIST, CURRENCIES, formatMoney, getMidMarketRate } from '../lib/currencies.ts';
import { QrCodeMatrix } from './QrCodeMatrix.tsx';
import { apiUrl } from '../lib/api.ts';

interface ShareExchangeHubProps {
  events: EventItem[];
  displayCurrency: CurrencyCode;
  onChangeDisplayCurrency: (currency: CurrencyCode) => void;
  selectedShareEventId?: string;
  onApplyFxReceipt: (order: FxExchangeOrder) => void;
  onBookWithShare: (eventId: string, shareCode: string, currency: CurrencyCode) => void;
}

export const ShareExchangeHub: React.FC<ShareExchangeHubProps> = ({
  events,
  displayCurrency,
  onChangeDisplayCurrency,
  selectedShareEventId,
  onApplyFxReceipt,
  onBookWithShare,
}) => {
  // Currency Exchange state (default USD -> INR for international visitors settling Indian events)
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>('USD');
  const [toCurrency, setToCurrency] = useState<CurrencyCode>('INR');
  const [amountInput, setAmountInput] = useState<string>('500');
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [lockedOrder, setLockedOrder] = useState<FxExchangeOrder | null>(null);

  // Share & Group Split state
  const [shareEventId, setShareEventId] = useState<string>(events[0]?.id ?? '');
  const [creatorName, setCreatorName] = useState<string>('');
  const [shareMode, setShareMode] = useState<'group_split' | 'referral'>('group_split');
  const [splitCount, setSplitCount] = useState<number>(4);
  const [splitCurrency, setSplitCurrency] = useState<CurrencyCode>(displayCurrency);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<ShareSplitLink | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (selectedShareEventId && events.some((e) => e.id === selectedShareEventId)) {
      setShareEventId(selectedShareEventId);
    } else if (!shareEventId && events[0]) {
      setShareEventId(events[0].id);
    }
  }, [selectedShareEventId, events, shareEventId]);

  useEffect(() => {
    setSplitCurrency(displayCurrency);
  }, [displayCurrency]);

  const numericAmount = Math.max(0, Number.parseFloat(amountInput) || 0);
  const midRate = getMidMarketRate(fromCurrency, toCurrency);
  const spreadPercent = fromCurrency === toCurrency ? 0 : 0.4;
  const appliedRate = midRate * (1 - spreadPercent / 100);
  const feeFrom = numericAmount * (spreadPercent / 100);
  const convertedOutput = numericAmount * appliedRate;

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setLockedOrder(null);
    setFxError(null);
  };

  const handleLockExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFxError(null);
    if (fromCurrency === toCurrency) {
      setFxError('Select two different currencies to lock a conversion rate.');
      return;
    }
    if (numericAmount <= 0) {
      setFxError('Enter a positive conversion amount.');
      return;
    }
    setFxLoading(true);
    try {
      const res = await fetch(apiUrl('/api/fx/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          fromAmount: numericAmount,
          purpose: 'checkout_lock',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFxError(data.error || 'Unable to lock exchange rate.');
      } else {
        setLockedOrder(data.order);
        onApplyFxReceipt(data.order);
      }
    } catch {
      setFxError('Network error while contacting exchange desk.');
    } finally {
      setFxLoading(false);
    }
  };

  const activeShareEvent = events.find((e) => e.id === shareEventId) ?? events[0];
  const basePassInr = activeShareEvent?.tiers[0]?.priceInr ?? 5000;
  const discountedTotalInr =
    basePassInr * (shareMode === 'group_split' ? splitCount : 1) * 0.9;
  const perPersonInr =
    shareMode === 'group_split' ? discountedTotalInr / Math.max(1, splitCount) : discountedTotalInr;
  const perPersonConverted = perPersonInr * CURRENCIES[splitCurrency].rateFromInr;

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShareEvent) return;
    setShareError(null);
    setShareLoading(true);
    try {
      const res = await fetch(apiUrl('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeShareEvent.id,
          creatorName: creatorName.trim() || 'Guest Host',
          mode: shareMode,
          splitCount: shareMode === 'group_split' ? splitCount : 1,
          targetCurrency: splitCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || 'Could not generate share link.');
      } else {
        setCreatedShare(data.shareLink);
      }
    } catch {
      setShareError('Network error while creating share link.');
    } finally {
      setShareLoading(false);
    }
  };

  const shareUrl = createdShare
    ? `${window.location.origin}/?share=${encodeURIComponent(createdShare.code)}`
    : '';

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleNativeShare = async () => {
    if (!createdShare || !shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${createdShare.eventTitle} — Meridian Pass`,
          text: `Join me at ${createdShare.eventTitle} with 10% group savings (${formatMoney(createdShare.perPersonTarget, createdShare.targetCurrency)} per pass).`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyShareUrl();
  };

  return (
    <section
      id="exchange-share-hub"
      className="py-16 border-t border-zinc-800 bg-black"
      aria-labelledby="exchange-share-heading"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-medium text-amber-400 mb-2">
            INR &amp; Cross-Border Settlement Desk
          </p>
          <h2
            id="exchange-share-heading"
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 text-balance"
          >
            Exchange currency to INR and share group split passes
          </h2>
          <p className="mt-2.5 text-base text-zinc-400 leading-relaxed">
            Convert USD, AED, GBP, EUR, or SGD into Indian Rupees at a guaranteed 24-hour rate, or
            generate a multi-currency split link so friends and teams save 10% together.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Panel: Money Exchange & Rate Lock */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display text-lg font-semibold text-zinc-50">
                    01. Money Exchange &amp; Rate Lock
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Mid-market INR spot conversion with 0.4% transparent spread.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeDisplayCurrency(toCurrency)}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Price site in {toCurrency}
                </button>
              </div>

              <form onSubmit={handleLockExchange} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                  <div>
                    <label
                      htmlFor="fx-from-amount"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      You send
                    </label>
                    <div className="flex bg-black border border-zinc-700 rounded-lg overflow-hidden focus-within:border-amber-500">
                      <input
                        id="fx-from-amount"
                        type="number"
                        min="1"
                        step="any"
                        value={amountInput}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          setLockedOrder(null);
                        }}
                        className="w-full px-3 py-2.5 text-sm font-mono tabular-nums text-zinc-100 bg-transparent focus:outline-none"
                      />
                      <select
                        aria-label="Source currency"
                        value={fromCurrency}
                        onChange={(e) => {
                          setFromCurrency(e.target.value as CurrencyCode);
                          setLockedOrder(null);
                        }}
                        className="bg-zinc-900 border-l border-zinc-700 px-2.5 py-2.5 text-xs font-semibold text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {CURRENCY_LIST.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwapCurrencies}
                    aria-label="Swap currencies"
                    className="h-[42px] w-[42px] mx-auto inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  <div>
                    <label
                      htmlFor="fx-to-amount"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Settlement received
                    </label>
                    <div className="flex bg-black border border-zinc-700 rounded-lg overflow-hidden">
                      <input
                        id="fx-to-amount"
                        type="text"
                        readOnly
                        value={convertedOutput.toFixed(CURRENCIES[toCurrency].decimals)}
                        className="w-full px-3 py-2.5 text-sm font-mono tabular-nums font-semibold text-zinc-100 bg-zinc-900/50 focus:outline-none"
                      />
                      <select
                        aria-label="Target currency"
                        value={toCurrency}
                        onChange={(e) => {
                          setToCurrency(e.target.value as CurrencyCode);
                          setLockedOrder(null);
                        }}
                        className="bg-zinc-900 border-l border-zinc-700 px-2.5 py-2.5 text-xs font-semibold text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        {CURRENCY_LIST.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rate Breakdown Table */}
                <div className="bg-black border border-zinc-800 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Mid-market spot rate</span>
                    <span className="font-mono tabular-nums text-zinc-200">
                      1 {fromCurrency} = {midRate.toFixed(4)} {toCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Platform FX spread ({spreadPercent.toFixed(1)}%)</span>
                    <span className="font-mono tabular-nums text-zinc-200">
                      {formatMoney(feeFrom, fromCurrency)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between font-medium text-zinc-100">
                    <span>Guaranteed settlement rate</span>
                    <span className="font-mono tabular-nums text-amber-400">
                      1 {fromCurrency} = {appliedRate.toFixed(4)} {toCurrency}
                    </span>
                  </div>
                </div>

                {fxError && (
                  <p role="alert" className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                    {fxError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={fxLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-950 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{fxLoading ? 'Locking FX Rate...' : 'Lock Rate & Issue Exchange Code'}</span>
                </button>
              </form>
            </div>

            {lockedOrder && (
              <div className="mt-5 pt-5 border-t border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-emerald-400">
                    Rate Locked · Valid 24h
                  </div>
                  <div className="font-mono text-sm font-semibold text-zinc-100 mt-0.5">
                    {lockedOrder.id} ({formatMoney(lockedOrder.fromAmount, lockedOrder.fromCurrency)} →{' '}
                    {formatMoney(lockedOrder.toAmount, lockedOrder.toCurrency)})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeDisplayCurrency(lockedOrder.toCurrency)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Use in Checkout
                </button>
              </div>
            )}
          </div>

          {/* Right Panel: Share Pass & Multi-Currency Group Split */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display text-lg font-semibold text-zinc-50">
                    02. Share &amp; Group Cost Split
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Split Indian event passes across INR or global currencies with 10% group savings.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateShareLink} className="space-y-4">
                <div>
                  <label
                    htmlFor="share-event-select"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Event to share
                  </label>
                  <select
                    id="share-event-select"
                    value={shareEventId}
                    onChange={(e) => {
                      setShareEventId(e.target.value);
                      setCreatedShare(null);
                    }}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="share-host-name"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Your name
                    </label>
                    <input
                      id="share-host-name"
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Share mode
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShareMode('group_split')}
                        className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          shareMode === 'group_split'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Group Split
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareMode('referral')}
                        className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          shareMode === 'referral'
                            ? 'bg-zinc-800 text-zinc-50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Invite Link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="share-split-count"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      {shareMode === 'group_split' ? 'Contributors' : 'Pass tier estimate'}
                    </label>
                    <select
                      id="share-split-count"
                      value={splitCount}
                      disabled={shareMode === 'referral'}
                      onChange={(e) => setSplitCount(Number(e.target.value))}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-zinc-100 disabled:bg-zinc-900 disabled:text-zinc-500 focus:border-amber-500 focus:outline-none"
                    >
                      {[2, 3, 4, 6, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          {n} attendees
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="share-currency"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Contributor currency
                    </label>
                    <select
                      id="share-currency"
                      value={splitCurrency}
                      onChange={(e) => setSplitCurrency(e.target.value as CurrencyCode)}
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-black border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="text-zinc-400">Per-person share (10% group credit applied)</div>
                    <div className="font-mono text-base font-semibold text-zinc-50 tabular-nums mt-0.5">
                      {formatMoney(perPersonConverted, splitCurrency)}
                    </div>
                  </div>
                  <div className="text-right text-zinc-400 font-mono tabular-nums">
                    Base {formatMoney(perPersonInr, 'INR')}
                  </div>
                </div>

                {shareError && (
                  <p role="alert" className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                    {shareError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={shareLoading || !activeShareEvent}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{shareLoading ? 'Generating Split Link...' : 'Create Shareable Link'}</span>
                </button>
              </form>
            </div>

            {createdShare && (
              <div className="mt-5 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <QrCodeMatrix value={shareUrl} size={64} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200">
                      Invite Code <span className="font-mono font-semibold text-amber-400">{createdShare.code}</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-400 truncate max-w-[240px] mt-0.5">
                      {shareUrl}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleCopyShareUrl}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-md text-zinc-200 cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? 'Copied' : 'Copy Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-md text-zinc-200 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onBookWithShare(createdShare.eventId, createdShare.code, createdShare.targetCurrency)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Book with Split</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
