import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type ActiveView = 'home' | 'passes' | 'analytics';

interface NavbarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView, anchorId?: string) => void;
  onPrimaryAction: () => void;
  passCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigate,
  onPrimaryAction,
  passCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (isActive: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      isActive
        ? 'text-zinc-50 border-amber-400'
        : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:border-zinc-700'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-lg font-bold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 text-left cursor-pointer"
        >
          Meridian Pass
        </button>

        {/* Zone 2: 4 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          <button
            type="button"
            onClick={() => onNavigate('home', 'events-catalog')}
            className={`${navLinkClass(activeView === 'home')} cursor-pointer`}
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => onNavigate('home', 'exchange-share-hub')}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-zinc-700 cursor-pointer"
          >
            Exchange &amp; Share
          </button>
          <button
            type="button"
            onClick={() => onNavigate('passes')}
            className={`${navLinkClass(activeView === 'passes')} cursor-pointer`}
          >
            My Passes ({passCount})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className={`${navLinkClass(activeView === 'analytics')} cursor-pointer`}
          >
            Organizer Analytics
          </button>
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {activeView === 'analytics' ? 'Host New Event' : 'Book a Pass'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-zinc-300 hover:bg-zinc-900"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('home', 'events-catalog');
            }}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-zinc-200 rounded-lg hover:bg-zinc-900"
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('home', 'exchange-share-hub');
            }}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-zinc-200 rounded-lg hover:bg-zinc-900"
          >
            Exchange &amp; Share
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('passes');
            }}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-zinc-200 rounded-lg hover:bg-zinc-900"
          >
            My Passes ({passCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('analytics');
            }}
            className="block w-full text-left px-3 py-2.5 text-sm font-medium text-zinc-200 rounded-lg hover:bg-zinc-900"
          >
            Organizer Analytics
          </button>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onPrimaryAction();
              }}
              className="w-full px-4 py-2.5 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
            >
              {activeView === 'analytics' ? 'Host New Event' : 'Book a Pass'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
