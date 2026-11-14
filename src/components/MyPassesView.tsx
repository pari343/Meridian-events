import React, { useState } from 'react';
import { Check, Copy, Printer, Search, Share2, Ticket } from 'lucide-react';
import type { BookingRecord } from '../types/platform.ts';
import { formatMoney } from '../lib/currencies.ts';
import { QrCodeMatrix } from './QrCodeMatrix.tsx';

interface MyPassesViewProps {
  bookings: BookingRecord[];
  onBrowseEvents: () => void;
}

export const MyPassesView: React.FC<MyPassesViewProps> = ({ bookings, onBrowseEvents }) => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = bookings.filter((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      b.passCode.toLowerCase().includes(q) ||
      b.attendeeName.toLowerCase().includes(q) ||
      b.attendeeEmail.toLowerCase().includes(q) ||
      b.eventTitle.toLowerCase().includes(q)
    );
  });

  const handleCopyPass = async (booking: BookingRecord) => {
    const shareText = `${booking.eventTitle} — Pass ${booking.passCode} (${booking.venue})`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(booking.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-amber-400 mb-1">Issued Credentials &amp; Receipts</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
            My Event Passes
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Verified digital passes with QR entry codes and INR / multi-currency settlement receipts.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pass code, name, or event"
            aria-label="Search event passes"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center">
          <Ticket className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-zinc-100">No passes found</h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-md mx-auto">
            {query
              ? 'No issued passes match your search filter.'
              : 'Book an Indian event pass from the catalog to receive an instant QR credential and payment receipt.'}
          </p>
          <button
            type="button"
            onClick={onBrowseEvents}
            className="mt-5 px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer"
          >
            Browse Events
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((booking) => (
            <article
              key={booking.id}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row items-start justify-between gap-6"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                  <span className="font-mono font-semibold text-amber-400">{booking.passCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{booking.tierName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Qty {booking.quantity}</span>
                </div>

                <h2 className="font-display text-lg font-semibold text-zinc-50 leading-snug">
                  {booking.eventTitle}
                </h2>
                <div className="text-xs text-zinc-400">
                  {booking.eventDateLabel} · {booking.venue}
                </div>

                <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 space-y-1">
                  <div>
                    Attendee:{' '}
                    <span className="font-medium text-zinc-100">{booking.attendeeName}</span>{' '}
                    <span className="text-zinc-500">({booking.attendeeEmail})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      Paid:{' '}
                      <span className="font-mono font-semibold text-zinc-100 tabular-nums">
                        {formatMoney(booking.paidAmount, booking.paidCurrency)}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={booking.checkedIn ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                      {booking.checkedIn ? 'Checked In' : 'Ready for Entry'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyPass(booking)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    {copiedId === booking.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === booking.id ? 'Copied' : 'Copy Details'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPass(booking)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1.5 shrink-0 self-center sm:self-start">
                <QrCodeMatrix value={booking.passCode} size={96} />
                <span className="text-[11px] font-mono text-zinc-400">{booking.transactionId}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};
