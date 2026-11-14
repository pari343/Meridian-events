import React from 'react';
import { ArrowUpRight, Share2 } from 'lucide-react';
import type { CurrencyCode, EventItem } from '../types/platform.ts';
import { convertCurrency, formatMoney } from '../lib/currencies.ts';
import { EventImage } from './EventImage.tsx';

interface EventCardProps {
  event: EventItem;
  displayCurrency: CurrencyCode;
  onBook: (event: EventItem) => void;
  onShareSplit: (event: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  displayCurrency,
  onBook,
  onShareSplit,
}) => {
  const lowestTier = event.tiers.reduce(
    (min, t) => (t.priceInr < min.priceInr ? t : min),
    event.tiers[0]
  );
  const totalRemaining = event.tiers.reduce(
    (acc, t) => acc + Math.max(0, t.capacity - t.sold),
    0
  );
  const convertedPrice = convertCurrency(lowestTier.priceInr, 'INR', displayCurrency);

  return (
    <article className="group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col transition-colors hover:border-zinc-700">
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        <EventImage
          src={event.imageUrl}
          alt={`${event.title} in ${event.city}`}
          title={event.title}
          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400 mb-2">
            <span className="font-medium text-amber-400">{event.category}</span>
            <span aria-hidden="true">·</span>
            <span>
              {event.city}, {event.state}
            </span>
            <span aria-hidden="true">·</span>
            <span>{event.dateLabel}</span>
          </div>

          <h3 className="font-display text-lg font-semibold text-zinc-50 leading-snug mb-2">
            {event.title}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{event.subtitle}</p>
        </div>

        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-zinc-500">From</div>
            <div className="font-mono text-base font-semibold text-zinc-50 tabular-nums">
              {formatMoney(convertedPrice, displayCurrency)}
            </div>
            <div className="text-xs text-zinc-500 tabular-nums mt-0.5">
              {totalRemaining} seats open
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onShareSplit(event)}
              aria-label={`Share or split passes for ${event.title}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => onBook(event)}
              disabled={totalRemaining === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{totalRemaining === 0 ? 'Sold Out' : 'Register'}</span>
              {totalRemaining > 0 && <ArrowUpRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
