import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, CheckCircle2, Globe, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import type {
  BookingRecord,
  CurrencyCode,
  EventItem,
  FxExchangeOrder,
  ShareSplitLink,
  TransactionRecord,
} from './types/platform.ts';
import { CURRENCY_LIST, formatMoney } from './lib/currencies.ts';
import { apiUrl } from './lib/api.ts';
import { INDIAN_STATES_AND_UTS } from './lib/indianStates.ts';
import { Navbar, type ActiveView } from './components/Navbar.tsx';
import { EventImage } from './components/EventImage.tsx';
import { EventCard } from './components/EventCard.tsx';
import { ShareExchangeHub } from './components/ShareExchangeHub.tsx';
import { BookingPaymentModal } from './components/BookingPaymentModal.tsx';
import { MyPassesView } from './components/MyPassesView.tsx';
import { OrganizerAnalytics } from './components/OrganizerAnalytics.tsx';

const HERO_IMAGE = '/src/assets/images/hero_mumbai_summit_1794673548380.jpg';

const CATEGORIES = ['All', 'Design', 'Finance', 'Music & Arts', 'Culinary', 'Technology'] as const;

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('INR');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllStates, setShowAllStates] = useState<boolean>(false);

  const [shareHubEventId, setShareHubEventId] = useState<string | undefined>(undefined);
  const [activeFxOrder, setActiveFxOrder] = useState<FxExchangeOrder | null>(null);
  const [activeShareBanner, setActiveShareBanner] = useState<ShareSplitLink | null>(null);

  const [bookingEvent, setBookingEvent] = useState<EventItem | null>(null);
  const [bookingPromoCode, setBookingPromoCode] = useState<string>('');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [evRes, bkRes] = await Promise.all([fetch(apiUrl('/api/events')), fetch(apiUrl('/api/bookings'))]);
      const evData = await evRes.json();
      const bkData = await bkRes.json();
      if (evRes.ok && evData.events) setEvents(evData.events);
      if (bkRes.ok && bkData.bookings) setBookings(bkData.bookings);
    } catch {
      // ignore initial transient errors
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareCode = params.get('share');
    if (shareCode) {
      fetch(apiUrl(`/api/shares/${encodeURIComponent(shareCode)}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.shareLink) {
            setActiveShareBanner(data.shareLink);
            setDisplayCurrency(data.shareLink.targetCurrency);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleNavigate = (view: ActiveView, anchorId?: string) => {
    setActiveView(view);
    if (view === 'home' && anchorId) {
      setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrimaryTopAction = () => {
    if (activeView === 'analytics') {
      setShowCreateEventModal(true);
    } else if (events.length > 0) {
      setBookingPromoCode(activeShareBanner?.code ?? '');
      setBookingEvent(events[0]);
    }
  };

  const handleOpenBooking = (ev: EventItem, promo = '') => {
    setBookingPromoCode(promo || activeShareBanner?.code || '');
    setBookingEvent(ev);
  };

  const handleJumpToShareHub = (ev: EventItem) => {
    setShareHubEventId(ev.id);
    document.getElementById('exchange-share-hub')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBookingCompleted = (booking: BookingRecord, transaction: TransactionRecord) => {
    setBookings((prev) => [booking, ...prev]);
    loadData();
    setToastMessage(
      `Pass ${booking.passCode} issued (${formatMoney(transaction.chargedAmount, transaction.currency)})`
    );
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedCategory !== 'All' && ev.category !== selectedCategory) return false;
    if (selectedState !== 'All' && ev.state !== selectedState) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      ev.title.toLowerCase().includes(q) ||
      ev.city.toLowerCase().includes(q) ||
      ev.state.toLowerCase().includes(q) ||
      ev.category.toLowerCase().includes(q)
    );
  });

  const isFiltered = selectedCategory !== 'All' || selectedState !== 'All' || searchQuery.trim() !== '';
  const visibleEvents =
    isFiltered || showAllStates ? filteredEvents : filteredEvents.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100">
      <Navbar
        activeView={activeView}
        onNavigate={handleNavigate}
        onPrimaryAction={handlePrimaryTopAction}
        passCount={bookings.length}
      />

      {activeShareBanner && activeView === 'home' && (
        <div className="bg-amber-500 text-zinc-950 border-b border-amber-600">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
            <div>
              <span className="font-bold">{activeShareBanner.creatorName}</span> invited you to{' '}
              <span className="font-bold">{activeShareBanner.eventTitle}</span> · 10% group
              savings applied ({formatMoney(activeShareBanner.perPersonTarget, activeShareBanner.targetCurrency)}{' '}
              per pass)
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const ev = events.find((e) => e.id === activeShareBanner.eventId);
                  if (ev) handleOpenBooking(ev, activeShareBanner.code);
                }}
                className="px-3 py-1 bg-zinc-950 text-amber-400 font-semibold rounded-md hover:bg-zinc-900 cursor-pointer"
              >
                Claim Split Pass
              </button>
              <button
                type="button"
                onClick={() => setActiveShareBanner(null)}
                aria-label="Dismiss invite banner"
                className="text-zinc-900 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-40 bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => {
              setToastMessage(null);
              setActiveView('passes');
            }}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer"
          >
            View Pass
          </button>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeView === 'home' && (
        <main className="flex-1">
          {/* Hero Section */}
          <section className="bg-zinc-950 border-b border-zinc-800">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 lg:py-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <p className="text-xs font-medium text-amber-400 mb-3">
                    India Curated Summits &amp; Festivals · INR Settlement
                  </p>
                  <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-50 leading-[1.12] text-balance">
                    Book premier Indian events and pay seamlessly in Rupees
                  </h1>
                  <p className="mt-4 text-base text-zinc-400 leading-relaxed max-w-xl">
                    Register for design, fintech, music, and culinary gatherings across every
                    Indian state and union territory. Lock live INR exchange rates, split group
                    passes, and track ticket settlement in real time.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById('events-catalog')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Explore Indian Events</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavigate('analytics')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-50 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Organizer Analytics</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="h-full min-h-[280px] lg:min-h-[380px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                    <EventImage
                      src={HERO_IMAGE}
                      alt="Mumbai international convention atrium with delegates registering"
                      title="Meridian Pass India Venues"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* 4-Column Proof Strip */}
              <div className="mt-10 pt-8 border-t border-zinc-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                    28 States · 8 UTs
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {events.length} active events across India
                  </div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                    INR First (₹)
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">UPI Instant, RuPay, Visa &amp; FX</div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                    0.4% Spread
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Guaranteed 24-hour FX rate lock</div>
                </div>
                <div>
                  <div className="font-mono text-2xl font-bold text-zinc-50 tabular-nums">
                    Real-Time SSE
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Live organizer telemetry feed</div>
                </div>
              </div>
            </div>
          </section>

          {/* Events Catalog Section */}
          <section id="events-catalog" className="py-16 bg-black">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-1.5">
                    01. Indian Event Booking &amp; Registration
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">
                    Upcoming Indian summits, festivals &amp; ateliers
                  </h2>
                </div>

                {/* State Filter, Display Currency Switcher & Search */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <label htmlFor="catalog-state" className="text-xs text-zinc-400 whitespace-nowrap">
                      State / UT
                    </label>
                    <select
                      id="catalog-state"
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="text-xs font-medium text-zinc-100 bg-zinc-950 focus:outline-none cursor-pointer max-w-[165px]"
                    >
                      <option value="All">All India (36 Regions)</option>
                      {INDIAN_STATES_AND_UTS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
                    <label htmlFor="catalog-currency" className="text-xs text-zinc-400 whitespace-nowrap">
                      Currency
                    </label>
                    <select
                      id="catalog-currency"
                      value={displayCurrency}
                      onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
                      className="text-xs font-mono font-semibold text-amber-400 bg-zinc-950 focus:outline-none cursor-pointer"
                    >
                      {CURRENCY_LIST.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search state, city, or event"
                      aria-label="Search upcoming Indian events"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Category Filter Segmented Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-lg w-fit">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-zinc-800 text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="text-xs font-mono text-zinc-400 tabular-nums">
                  Showing {visibleEvents.length} of {filteredEvents.length} event
                  {filteredEvents.length === 1 ? '' : 's'}
                  {selectedState !== 'All' ? ` in ${selectedState}` : ' across India'}
                </div>
              </div>

              {eventsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bg-zinc-950 border border-zinc-800 rounded-xl h-96 animate-pulse" />
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center">
                  <p className="text-sm font-medium text-zinc-100">No events match your filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedState('All');
                      setSearchQuery('');
                    }}
                    className="mt-3 text-xs font-medium text-amber-400 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {visibleEvents.map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        displayCurrency={displayCurrency}
                        onBook={(item) => handleOpenBooking(item)}
                        onShareSplit={handleJumpToShareHub}
                      />
                    ))}
                  </div>

                  {!isFiltered && filteredEvents.length > 6 && (
                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllStates((prev) => !prev)}
                        className="px-5 py-2.5 text-sm font-medium text-zinc-100 bg-zinc-950 border border-zinc-700 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                      >
                        {showAllStates
                          ? 'Show Featured 6 Events'
                          : `Explore All ${filteredEvents.length} Events Across All Indian States & UTs`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Share & Money Exchange Hub */}
          <ShareExchangeHub
            events={events}
            displayCurrency={displayCurrency}
            onChangeDisplayCurrency={setDisplayCurrency}
            selectedShareEventId={shareHubEventId}
            onApplyFxReceipt={(order) => {
              setActiveFxOrder(order);
              setToastMessage(`FX rate locked (${order.id}) for ${order.toCurrency} checkout.`);
            }}
            onBookWithShare={(eventId, shareCode, currency) => {
              setDisplayCurrency(currency);
              const ev = events.find((e) => e.id === eventId);
              if (ev) handleOpenBooking(ev, shareCode);
            }}
          />

          {/* Payment Gateway & Organizer Analytics Bridge Section */}
          <section className="py-16 border-t border-zinc-800 bg-zinc-950">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <p className="text-xs font-medium text-amber-400">
                  Payment Infrastructure &amp; Organizer Intelligence
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50 text-balance">
                  Every INR &amp; FX booking settles directly into real-time organizer analytics
                </h2>
                <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                  Our integrated payment gateway supports instant UPI handles, RuPay/Visa/Mastercard
                  3DS validation, and international currencies—pushing live INR revenue velocity,
                  currency mix, and venue check-in telemetry to the Organizer Console.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleNavigate('analytics')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Open Organizer Analytics</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('passes')}
                    className="text-sm font-medium text-zinc-300 hover:text-zinc-50 underline underline-offset-4 cursor-pointer"
                  >
                    View Issued Passes ({bookings.length})
                  </button>
                </div>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      UPI Instant &amp; Multi-Rail Payment Processing
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Accepts UPI IDs, NEFT/IMPS, Visa, Mastercard, RuPay, Amex, Google Pay, and
                      Apple Pay with deterministic idempotency and instant refund support.
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-zinc-500">Promo Code</div>
                    <div className="font-mono font-semibold text-amber-400 mt-0.5">INDIA10</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Platform Fee</div>
                    <div className="font-mono font-semibold text-zinc-100 mt-0.5">2.5% Flat</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Base Currency</div>
                    <div className="font-mono font-semibold text-zinc-100 mt-0.5">INR (₹)</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeView === 'passes' && (
        <div className="flex-1 bg-black">
          <MyPassesView bookings={bookings} onBrowseEvents={() => handleNavigate('home', 'events-catalog')} />
        </div>
      )}

      {activeView === 'analytics' && (
        <div className="flex-1 bg-black">
          <OrganizerAnalytics
            events={events}
            onEventsUpdated={loadData}
            showCreateModal={showCreateEventModal}
            onCloseCreateModal={() => setShowCreateEventModal(false)}
            onOpenCreateModal={() => setShowCreateEventModal(true)}
          />
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-800 mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-zinc-100">Meridian Pass</span>
            <span aria-hidden="true">·</span>
            <span>Indian Event Booking, INR Currency Exchange &amp; Organizer Analytics</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('home', 'events-catalog')}
              className="hover:text-zinc-100 cursor-pointer"
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('home', 'exchange-share-hub')}
              className="hover:text-zinc-100 cursor-pointer"
            >
              Money Exchange
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('passes')}
              className="hover:text-zinc-100 cursor-pointer"
            >
              My Passes
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('analytics')}
              className="hover:text-zinc-100 cursor-pointer"
            >
              Organizer Console
            </button>
          </div>
        </div>
      </footer>

      {bookingEvent && (
        <BookingPaymentModal
          event={bookingEvent}
          initialCurrency={displayCurrency}
          initialPromoCode={bookingPromoCode}
          activeFxOrder={activeFxOrder}
          onClose={() => setBookingEvent(null)}
          onCompleted={handleBookingCompleted}
        />
      )}
    </div>
  );
}
