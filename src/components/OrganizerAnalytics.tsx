import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type { AnalyticsSnapshot, EventItem } from '../types/platform.ts';
import { formatMoney } from '../lib/currencies.ts';
import { INDIAN_STATES_AND_UTS } from '../lib/indianStates.ts';

interface OrganizerAnalyticsProps {
  events: EventItem[];
  onEventsUpdated: () => void;
  showCreateModal: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const OrganizerAnalytics: React.FC<OrganizerAnalyticsProps> = ({
  events,
  onEventsUpdated,
  showCreateModal,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [lastLiveEvent, setLastLiveEvent] = useState<string>('');
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'refunded' | 'declined'>('all');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newCategory, setNewCategory] = useState<EventItem['category']>('Technology');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('Kerala');
  const [newVenue, setNewVenue] = useState('');
  const [newDateLabel, setNewDateLabel] = useState('');
  const [newPrice, setNewPrice] = useState('4999');
  const [newCapacity, setNewCapacity] = useState('200');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchAnalytics = useCallback(async (selectedRange: '24h' | '7d' | '30d') => {
    try {
      const res = await fetch(`/api/analytics?range=${selectedRange}`);
      const data = await res.json();
      if (res.ok && data.analytics) {
        setAnalytics(data.analytics);
      }
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  useEffect(() => {
    const es = new EventSource('/api/analytics/stream');

    es.addEventListener('connected', (evt) => {
      setSseConnected(true);
      try {
        const parsed = JSON.parse((evt as MessageEvent).data);
        if (parsed.analytics && range === '7d') {
          setAnalytics(parsed.analytics);
          setLoading(false);
        }
      } catch {
        // ignore parse issue
      }
    });

    es.addEventListener('update', (evt) => {
      try {
        const parsed = JSON.parse((evt as MessageEvent).data);
        setLastLiveEvent(`${parsed.type.replace('_', ' ')} at ${new Date(parsed.timestamp).toLocaleTimeString('en-IN')}`);
        if (range === '7d' && parsed.analytics) {
          setAnalytics(parsed.analytics);
        } else {
          fetchAnalytics(range);
        }
        onEventsUpdated();
      } catch {
        // ignore parse issue
      }
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
    };
  }, [range, fetchAnalytics, onEventsUpdated]);

  const handleRefund = async (txnId: string) => {
    setActionBusyId(txnId);
    try {
      const res = await fetch(`/api/transactions/${txnId}/refund`, { method: 'POST' });
      if (res.ok) {
        await fetchAnalytics(range);
        onEventsUpdated();
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    setActionBusyId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/checkin`, { method: 'POST' });
      if (res.ok) {
        await fetchAnalytics(range);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDownloadCsv = () => {
    if (!analytics) return;
    const headers = [
      'Transaction ID',
      'Date',
      'Event',
      'Attendee',
      'Email',
      'Method',
      'Currency',
      'Charged Amount',
      'INR Settlement',
      'Status',
    ];
    const rows = analytics.recentTransactions.map((t) => [
      t.id,
      t.createdAt,
      `"${t.eventTitle.replace(/"/g, '""')}"`,
      `"${t.customerName.replace(/"/g, '""')}"`,
      t.customerEmail,
      t.paymentBrand,
      t.currency,
      t.chargedAmount,
      t.totalInr,
      t.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meridian-india-transactions-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newTitle.trim() || !newCity.trim() || !newVenue.trim() || !newDateLabel.trim()) {
      setCreateError('Complete title, city, venue, and date fields.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          subtitle: newSubtitle.trim(),
          category: newCategory,
          city: newCity.trim(),
          state: newState,
          country: 'India',
          venue: newVenue.trim(),
          dateLabel: newDateLabel.trim(),
          standardPriceInr: Number(newPrice) || 4999,
          capacity: Number(newCapacity) || 180,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Could not publish event.');
      } else {
        setNewTitle('');
        setNewSubtitle('');
        setNewCity('');
        setNewState('Kerala');
        setNewVenue('');
        setNewDateLabel('');
        onEventsUpdated();
        await fetchAnalytics(range);
        onCloseCreateModal();
      }
    } catch {
      setCreateError('Network error while publishing event.');
    } finally {
      setCreating(false);
    }
  };

  const filteredTransactions = (analytics?.recentTransactions ?? []).filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    const q = ledgerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.eventTitle.toLowerCase().includes(q) ||
      (t.passCode ?? '').toLowerCase().includes(q)
    );
  });

  const maxChartRev = Math.max(
    1000,
    ...(analytics?.timeSeries.map((pt) => pt.revenueInr) ?? [1000])
  );

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Contextual Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mb-1">
            <span>Organizer Console (INR)</span>
            <span aria-hidden="true">/</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              {sseConnected ? 'Real-Time Stream Active' : 'Connecting Stream...'}
            </span>
            {lastLiveEvent && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-zinc-400">Last update: {lastLiveEvent}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
            Real-Time Organizer Analytics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg" role="group" aria-label="Analytics timeframe">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  range === r
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!analytics}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Host New Event</span>
          </button>
        </div>
      </div>

      {loading || !analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-400">Gross Volume ({range})</div>
              <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1.5">
                {formatMoney(analytics.grossRevenueInr, 'INR')}
              </div>
              <div className="text-xs text-zinc-500 mt-1 tabular-nums">
                Net settlement {formatMoney(analytics.netSettlementInr, 'INR')}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-400">Passes Issued</div>
              <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums mt-1.5">
                {analytics.totalTicketsSold.toLocaleString('en-IN')}
                <span className="text-sm font-normal text-zinc-500">
                  {' '}
                  / {analytics.totalCapacity.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-xs text-emerald-400 font-medium mt-1 tabular-nums">
                {analytics.sellThroughRate}% capacity sold · {analytics.checkedInCount} checked in
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-400">FX Exchange Volume ({range})</div>
              <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums mt-1.5">
                {formatMoney(analytics.fxVolumeInr, 'INR')}
              </div>
              <div className="text-xs text-zinc-500 mt-1 tabular-nums">
                {analytics.currencyBreakdown.length} active settlement currencies
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-medium text-zinc-400">Share &amp; Split Conversion</div>
              <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums mt-1.5">
                {analytics.conversionRate}%
              </div>
              <div className="text-xs text-zinc-500 mt-1 tabular-nums">
                {analytics.activeShareLinks} active links · {analytics.shareRedemptions} redemptions
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
            {/* Revenue Velocity Chart */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-50">
                    INR Settlement &amp; Ticket Velocity ({range})
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time INR-equivalent settlement across UPI, Card, and Wallet gateways
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAnalytics(range)}
                  aria-label="Refresh analytics"
                  className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="h-56 flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-zinc-800">
                {analytics.timeSeries.map((pt, idx) => {
                  const pct = Math.max(4, Math.round((pt.revenueInr / maxChartRev) * 100));
                  const isHovered = hoveredBucketIndex === idx;
                  return (
                    <div
                      key={`${pt.label}-${idx}`}
                      onMouseEnter={() => setHoveredBucketIndex(idx)}
                      onMouseLeave={() => setHoveredBucketIndex(null)}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                    >
                      {isHovered && (
                        <div className="absolute -top-2 -translate-y-full z-10 bg-zinc-900 border border-zinc-700 text-zinc-100 text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none">
                          <div className="font-medium text-zinc-300">{pt.label}</div>
                          <div className="font-mono tabular-nums text-amber-400">
                            {formatMoney(pt.revenueInr, 'INR')} · {pt.tickets} txns
                          </div>
                        </div>
                      )}
                      <div className="w-full flex items-end justify-center h-full">
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full max-w-[38px] rounded-t-md transition-colors ${
                            pt.revenueInr > 0
                              ? isHovered
                                ? 'bg-amber-400'
                                : 'bg-amber-500'
                              : 'bg-zinc-800'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2.5 text-[11px] font-mono text-zinc-500 tabular-nums">
                {analytics.timeSeries.map((pt, idx) => (
                  <span key={`lbl-${idx}`} className="flex-1 text-center truncate">
                    {pt.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Currency & Payment Gateway Mix */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-50 mb-3">
                  Currency Settlement Mix
                </h2>
                <div className="space-y-3">
                  {analytics.currencyBreakdown.slice(0, 5).map((item) => (
                    <div key={item.currency} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-zinc-200">
                          {item.currency}{' '}
                          <span className="font-sans font-normal text-zinc-500">
                            ({item.transactions} txns)
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-zinc-200">
                          {formatMoney(item.volumeInr, 'INR')} ({item.sharePercent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, item.sharePercent)}%` }}
                          className="h-full bg-amber-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-xs font-semibold text-zinc-300 mb-3">
                  Gateway Rail Distribution
                </h3>
                <div className="space-y-2 text-xs">
                  {analytics.methodBreakdown.map((m) => (
                    <div key={m.method} className="flex items-center justify-between">
                      <span className="text-zinc-400">{m.label}</span>
                      <span className="font-mono tabular-nums font-medium text-zinc-100">
                        {m.count} ({m.sharePercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Event Inventory & Sell-Through */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-zinc-50">
                Indian Event Inventory &amp; Utilization ({events.length} active)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-black/60">
                    <th className="py-3 px-6">Event</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Sold / Capacity</th>
                    <th className="py-3 px-4 text-right">Sell-Through</th>
                    <th className="py-3 px-6 text-right">Estimated Revenue (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-sm">
                  {analytics.eventPerformance.map((ep) => {
                    const pct = ep.capacity > 0 ? Math.round((ep.sold / ep.capacity) * 100) : 0;
                    return (
                      <tr key={ep.eventId} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="py-3.5 px-6 font-medium text-zinc-100">{ep.title}</td>
                        <td className="py-3.5 px-4 text-xs text-zinc-400">{ep.category}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-zinc-300">
                          {ep.sold} / {ep.capacity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-zinc-300">
                          {pct}%
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono text-xs font-semibold tabular-nums text-amber-400">
                          {formatMoney(ep.revenueInr, 'INR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Payment & Attendee Ledger */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-zinc-50">
                  Live Gateway Transactions &amp; Check-In Ledger
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Manage attendee check-ins and issue instant gateway refunds
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                  {(['all', 'settled', 'refunded', 'declined'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 font-medium rounded-md capitalize cursor-pointer ${
                        statusFilter === st
                          ? 'bg-zinc-800 text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Filter ID, attendee, event"
                    aria-label="Filter transactions"
                    className="w-full bg-black border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-medium text-zinc-400 bg-black/60">
                    <th className="py-3 px-6">Transaction</th>
                    <th className="py-3 px-4">Attendee</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Gateway Rail</th>
                    <th className="py-3 px-4 text-right">Charged</th>
                    <th className="py-3 px-4 text-right">INR Eqv.</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-xs">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-zinc-500">
                        No transactions match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => {
                      const booking = analytics.recentBookings.find((b) => b.transactionId === txn.id);
                      return (
                        <tr key={txn.id} className="hover:bg-zinc-900/60 transition-colors">
                          <td className="py-3 px-6">
                            <div className="font-mono font-semibold text-zinc-100">{txn.id}</div>
                            <div className="text-[11px] text-zinc-500">
                              {new Date(txn.createdAt).toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-zinc-100">{txn.customerName}</div>
                            <div className="text-zinc-500">{txn.customerEmail}</div>
                          </td>
                          <td className="py-3 px-4 max-w-[200px] truncate text-zinc-300">
                            {txn.eventTitle}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {txn.paymentBrand}
                            {txn.last4 ? ` •••• ${txn.last4}` : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-200">
                            {formatMoney(txn.chargedAmount, txn.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-amber-400">
                            {formatMoney(txn.totalInr, 'INR')}
                          </td>
                          <td className="py-3 px-4">
                            {txn.status === 'settled' && (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Settled</span>
                              </span>
                            )}
                            {txn.status === 'refunded' && (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-400">
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Refunded</span>
                              </span>
                            )}
                            {txn.status === 'declined' && (
                              <span className="inline-flex items-center gap-1 font-medium text-rose-400">
                                <Activity className="w-3.5 h-3.5" />
                                <span>Declined</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap space-x-2">
                            {booking && txn.status === 'settled' && (
                              <button
                                type="button"
                                disabled={actionBusyId === booking.id}
                                onClick={() => handleCheckIn(booking.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                  booking.checkedIn
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                                    : 'bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200'
                                }`}
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>{booking.checkedIn ? 'Checked In' : 'Check In'}</span>
                              </button>
                            )}
                            {txn.status === 'settled' && (
                              <button
                                type="button"
                                disabled={actionBusyId === txn.id}
                                onClick={() => handleRefund(txn.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium bg-black border border-zinc-700 hover:bg-rose-950/60 hover:border-rose-800 hover:text-rose-300 text-zinc-300 transition-colors cursor-pointer"
                              >
                                <span>Refund</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Host New Event Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
        >
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black">
              <h2 id="create-event-title" className="font-display text-lg font-semibold text-zinc-50">
                Publish New Indian Event
              </h2>
              <button
                type="button"
                onClick={onCloseCreateModal}
                aria-label="Close publish event dialog"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div>
                <label htmlFor="ev-title" className="block text-xs font-medium text-zinc-300 mb-1">
                  Event title
                </label>
                <input
                  id="ev-title"
                  type="text"
                  required
                  placeholder="Kochi Biennale Contemporary Systems Week"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ev-sub" className="block text-xs font-medium text-zinc-300 mb-1">
                  Short summary
                </label>
                <input
                  id="ev-sub"
                  type="text"
                  placeholder="Two days of architectural dialogues and waterfront exhibitions."
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-cat" className="block text-xs font-medium text-zinc-300 mb-1">
                    Category
                  </label>
                  <select
                    id="ev-cat"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EventItem['category'])}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 cursor-pointer"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Design">Design</option>
                    <option value="Finance">Finance</option>
                    <option value="Music & Arts">Music &amp; Arts</option>
                    <option value="Culinary">Culinary</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ev-date" className="block text-xs font-medium text-zinc-300 mb-1">
                    Dates
                  </label>
                  <input
                    id="ev-date"
                    type="text"
                    required
                    placeholder="Apr 14–16, 2027"
                    value={newDateLabel}
                    onChange={(e) => setNewDateLabel(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-city" className="block text-xs font-medium text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    id="ev-city"
                    type="text"
                    required
                    placeholder="Kochi"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label htmlFor="ev-state" className="block text-xs font-medium text-zinc-300 mb-1">
                    State / Union Territory
                  </label>
                  <select
                    id="ev-state"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 cursor-pointer"
                  >
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ev-venue" className="block text-xs font-medium text-zinc-300 mb-1">
                  Venue name
                </label>
                <input
                  id="ev-venue"
                  type="text"
                  required
                  placeholder="Aspinwall House, Fort Kochi"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-price" className="block text-xs font-medium text-zinc-300 mb-1">
                    Standard price (INR ₹)
                  </label>
                  <input
                    id="ev-price"
                    type="number"
                    min="499"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div>
                  <label htmlFor="ev-cap" className="block text-xs font-medium text-zinc-300 mb-1">
                    Total capacity
                  </label>
                  <input
                    id="ev-cap"
                    type="number"
                    min="20"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-zinc-100"
                  />
                </div>
              </div>

              {createError && (
                <p role="alert" className="text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCloseCreateModal}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg cursor-pointer"
                >
                  {creating ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
