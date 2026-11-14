import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { CURRENCIES, convertCurrency, getMidMarketRate } from './src/lib/currencies.ts';
import type {
  AnalyticsSnapshot,
  BookingRecord,
  CurrencyCode,
  EventItem,
  FxExchangeOrder,
  PaymentMethodType,
  ShareSplitLink,
  TransactionRecord,
} from './src/types/platform.ts';

interface PlatformStore {
  events: EventItem[];
  bookings: BookingRecord[];
  transactions: TransactionRecord[];
  fxOrders: FxExchangeOrder[];
  shareLinks: ShareSplitLink[];
  paymentIntents: Record<
    string,
    {
      id: string;
      eventId: string;
      tierId: string;
      quantity: number;
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
      status: 'open' | 'completed';
      createdAt: string;
    }
  >;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function createInitialStore(): PlatformStore {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  const daysAgo = (d: number) => new Date(now - d * 24 * 3600 * 1000).toISOString();

  const flagshipEvents: EventItem[] = [
    {
      id: 'evt_bengaluru_tech',
      title: 'Bengaluru Architecture & Product Systems Forum',
      subtitle: 'Three days of engineering keynotes, industrial design showcases, and studio tours across Indiranagar and Koramangala.',
      category: 'Design',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      venue: 'Prestige Centre for Performing Arts',
      dateLabel: 'Dec 11–13, 2026',
      startDateIso: '2026-12-11T09:30:00+05:30',
      imageUrl: '/src/assets/images/event_bengaluru_tech_1794673548777.jpg',
      organizerName: 'Deccan Design Collective',
      featured: true,
      tiers: [
        {
          id: 'tier_blr_std',
          name: 'Full Symposium Pass',
          description: 'All keynote sessions, design expo halls, and printed monograph.',
          priceInr: 6500,
          capacity: 320,
          sold: 248,
        },
        {
          id: 'tier_blr_vip',
          name: 'Patron & Studio Access',
          description: 'Reserved front-tier seating, private studio visits, and speaker dinner.',
          priceInr: 14500,
          capacity: 80,
          sold: 61,
        },
        {
          id: 'tier_blr_team',
          name: 'Studio Team (4 Passes)',
          description: 'Four transferable symposium passes with GST corporate invoice.',
          priceInr: 22900,
          capacity: 40,
          sold: 27,
        },
      ],
    },
    {
      id: 'evt_mumbai_fintech',
      title: 'Mumbai Global Capital & UPI Settlement Summit',
      subtitle: 'Cross-border INR liquidity, real-time UPI rails, treasury architecture, and institutional fintech.',
      category: 'Finance',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      venue: 'Jio World Convention Centre, BKC',
      dateLabel: 'Jan 21–22, 2027',
      startDateIso: '2027-01-21T09:00:00+05:30',
      imageUrl: '/src/assets/images/event_mumbai_fintech_1794673549152.jpg',
      organizerName: 'Bombay Clearing & Capital Guild',
      featured: true,
      tiers: [
        {
          id: 'tier_bom_std',
          name: 'Delegate Pass',
          description: 'Two-day summit halls, roundtable access, and executive luncheon.',
          priceInr: 9900,
          capacity: 380,
          sold: 294,
        },
        {
          id: 'tier_bom_vip',
          name: 'Executive Briefings Pass',
          description: 'Closed-door regulatory panels and Sea Link terrace reception.',
          priceInr: 24000,
          capacity: 100,
          sold: 78,
        },
        {
          id: 'tier_bom_team',
          name: 'Desk Allocation (4 Passes)',
          description: 'Priority badge counter and multi-currency GST corporate receipt.',
          priceInr: 35000,
          capacity: 45,
          sold: 29,
        },
      ],
    },
    {
      id: 'evt_jaipur_music',
      title: 'Jaipur Sandstone Courtyard Raag & Electronic Festival',
      subtitle: 'Hindustani classical ensembles paired with modular synthesis under historic Aravalli skies.',
      category: 'Music & Arts',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      venue: 'Nahargarh Heritage Stepwell Courtyard',
      dateLabel: 'Feb 12–14, 2027',
      startDateIso: '2027-02-12T17:30:00+05:30',
      imageUrl: '/src/assets/images/event_jaipur_music_1794673549597.jpg',
      organizerName: 'Rajputana Resonance Arts',
      tiers: [
        {
          id: 'tier_jai_std',
          name: 'Weekend Amphitheater Pass',
          description: 'Tiered sandstone courtyard seating across all three twilight programs.',
          priceInr: 4999,
          capacity: 450,
          sold: 368,
        },
        {
          id: 'tier_jai_vip',
          name: 'Jharokha Patron Pass',
          description: 'Upper sandstone terrace lounge, acoustic rehearsal entry, and artist vinyl.',
          priceInr: 11500,
          capacity: 90,
          sold: 74,
        },
      ],
    },
    {
      id: 'evt_udaipur_culinary',
      title: 'Udaipur Mewar Harvest & Brassware Culinary Atelier',
      subtitle: 'Open-fire regional Rajasthani tasting tables, spice craft, and lakeside artisanal hospitality.',
      category: 'Culinary',
      city: 'Udaipur',
      state: 'Rajasthan',
      country: 'India',
      venue: 'Haveli Pichola Courtyard',
      dateLabel: 'Mar 6–7, 2027',
      startDateIso: '2027-03-06T11:00:00+05:30',
      imageUrl: '/src/assets/images/event_udaipur_culinary_1794673551037.jpg',
      organizerName: 'Mewar Table Studio',
      tiers: [
        {
          id: 'tier_udr_std',
          name: 'Lakeside Tasting Seat',
          description: 'Full-day culinary masterclass, regional pairings, and recipe dossier.',
          priceInr: 7500,
          capacity: 72,
          sold: 56,
        },
        {
          id: 'tier_udr_vip',
          name: 'Chef & Brassware Weekend',
          description: 'Includes dawn spice market walk and hand-hammered brass thali set.',
          priceInr: 16500,
          capacity: 28,
          sold: 22,
        },
      ],
    },
  ];

  const categoryImage: Record<EventItem['category'], string> = {
    Design: '/src/assets/images/event_bengaluru_tech_1794673548777.jpg',
    Technology: '/src/assets/images/hero_mumbai_summit_1794673548380.jpg',
    Finance: '/src/assets/images/event_mumbai_fintech_1794673549152.jpg',
    'Music & Arts': '/src/assets/images/event_jaipur_music_1794673549597.jpg',
    Culinary: '/src/assets/images/event_udaipur_culinary_1794673551037.jpg',
  };

  const stateRegionalSeeds: Array<{
    id: string;
    title: string;
    subtitle: string;
    category: EventItem['category'];
    city: string;
    state: string;
    venue: string;
    dateLabel: string;
    priceInr: number;
    capacity: number;
    sold: number;
  }> = [
    {
      id: 'evt_ap_vizag',
      title: 'Visakhapatnam Maritime Tech & Port Logistics Forum',
      subtitle: 'Coastal industrial automation, blue-economy startups, and deep-water corridor briefings.',
      category: 'Technology',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      venue: 'AU Convention Centre, Beach Road',
      dateLabel: 'Dec 18–19, 2026',
      priceInr: 3999,
      capacity: 220,
      sold: 142,
    },
    {
      id: 'evt_ar_itanagar',
      title: 'Ziro & Itanagar Acoustic Folk & Craft Residency',
      subtitle: 'Eastern Himalayan bamboo craft exhibitions paired with live acoustic twilight sessions.',
      category: 'Music & Arts',
      city: 'Itanagar',
      state: 'Arunachal Pradesh',
      venue: 'Siddhartha Hall Cultural Amphitheatre',
      dateLabel: 'Jan 9–11, 2027',
      priceInr: 2499,
      capacity: 180,
      sold: 118,
    },
    {
      id: 'evt_as_guwahati',
      title: 'Guwahati Brahmaputra Tea & Spatial Design Conclave',
      subtitle: 'Single-estate Assam tea auctions, riverfront architecture, and Northeast founder panels.',
      category: 'Culinary',
      city: 'Guwahati',
      state: 'Assam',
      venue: 'Srimanta Sankardev Kalakshetra',
      dateLabel: 'Jan 15–16, 2027',
      priceInr: 3499,
      capacity: 240,
      sold: 164,
    },
    {
      id: 'evt_br_patna',
      title: 'Patna Heritage Architecture & Digital Public Infra Summit',
      subtitle: 'Civic technology deployments, historical preservation, and eastern India enterprise growth.',
      category: 'Technology',
      city: 'Patna',
      state: 'Bihar',
      venue: 'Samrat Ashoka Convention Kendra',
      dateLabel: 'Jan 24–25, 2027',
      priceInr: 2799,
      capacity: 260,
      sold: 175,
    },
    {
      id: 'evt_cg_raipur',
      title: 'Raipur Industrial Energy & Clean Metallurgy Forum',
      subtitle: 'Decarbonized manufacturing, grid-scale storage, and regional capital allocation.',
      category: 'Finance',
      city: 'Raipur',
      state: 'Chhattisgarh',
      venue: 'Nava Raipur Convention Hall',
      dateLabel: 'Feb 2–3, 2027',
      priceInr: 4200,
      capacity: 200,
      sold: 129,
    },
    {
      id: 'evt_ga_panaji',
      title: 'Goa Riverfront Independent Design & Sound Gathering',
      subtitle: 'Three evenings of coastal studio showcases, vinyl listening rooms, and culinary pop-ups.',
      category: 'Music & Arts',
      city: 'Panaji',
      state: 'Goa',
      venue: 'Mandovi Old Heritage Pavilion',
      dateLabel: 'Dec 27–29, 2026',
      priceInr: 5499,
      capacity: 300,
      sold: 246,
    },
    {
      id: 'evt_gj_ahmedabad',
      title: 'Ahmedabad GIFT City Treasury & Textile Design Week',
      subtitle: 'IFSC cross-border finance sessions paired with Sabarmati modernist textile exhibitions.',
      category: 'Finance',
      city: 'Ahmedabad',
      state: 'Gujarat',
      venue: 'Mahatma Mandir Exhibition Complex',
      dateLabel: 'Jan 28–30, 2027',
      priceInr: 7900,
      capacity: 340,
      sold: 258,
    },
    {
      id: 'evt_hr_gurugram',
      title: 'Gurugram Enterprise AI & SaaS Operators Summit',
      subtitle: 'B2B revenue architecture, cloud infrastructure engineering, and NCR founder roundtables.',
      category: 'Technology',
      city: 'Gurugram',
      state: 'Haryana',
      venue: 'Leela Ambience Grand Hall',
      dateLabel: 'Feb 5–6, 2027',
      priceInr: 8500,
      capacity: 360,
      sold: 289,
    },
    {
      id: 'evt_hp_shimla',
      title: 'Shimla Pine Ridge Chamber Music & Woodcraft Symposium',
      subtitle: 'Intimate Himalayan string quartets, timber conservation, and mountain hospitality.',
      category: 'Music & Arts',
      city: 'Shimla',
      state: 'Himachal Pradesh',
      venue: 'Gaiety Heritage Cultural Complex',
      dateLabel: 'Mar 12–14, 2027',
      priceInr: 3900,
      capacity: 150,
      sold: 112,
    },
    {
      id: 'evt_jh_ranchi',
      title: 'Ranchi Mineral Tech & Tribal Craft Enterprise Meet',
      subtitle: 'Sustainable mining instrumentation paired with Dokra metalcraft design fellowships.',
      category: 'Design',
      city: 'Ranchi',
      state: 'Jharkhand',
      venue: 'Audrey House Cultural Pavilion',
      dateLabel: 'Feb 8–9, 2027',
      priceInr: 2599,
      capacity: 180,
      sold: 114,
    },
    {
      id: 'evt_kl_kochi',
      title: 'Kochi Waterfront Contemporary Design & Spice Table',
      subtitle: 'Fort Kochi heritage warehouse installations, maritime architecture, and Malabar tasting.',
      category: 'Design',
      city: 'Kochi',
      state: 'Kerala',
      venue: 'Aspinwall House, Fort Kochi',
      dateLabel: 'Dec 19–21, 2026',
      priceInr: 5800,
      capacity: 240,
      sold: 196,
    },
    {
      id: 'evt_mp_indore',
      title: 'Indore Clean Urban Mobility & Street Gastronomy Conclave',
      subtitle: 'Civic transit innovation mornings followed by curated Malwa culinary courtyard dinners.',
      category: 'Culinary',
      city: 'Indore',
      state: 'Madhya Pradesh',
      venue: 'Brilliant Convention Centre',
      dateLabel: 'Feb 18–19, 2027',
      priceInr: 3600,
      capacity: 250,
      sold: 171,
    },
    {
      id: 'evt_mn_imphal',
      title: 'Imphal Loktak Handloom & Acoustic Arts Gathering',
      subtitle: 'Manipuri handloom archives, classical percussion ensembles, and craft exports.',
      category: 'Music & Arts',
      city: 'Imphal',
      state: 'Manipur',
      venue: 'City Convention Centre, Palace Compound',
      dateLabel: 'Mar 2–3, 2027',
      priceInr: 2299,
      capacity: 160,
      sold: 103,
    },
    {
      id: 'evt_ml_shillong',
      title: 'Shillong Autumn Pines Jazz & Modular Sound Festival',
      subtitle: 'Khasi hills open-air amphitheater hosting indie bands, choirs, and sound designers.',
      category: 'Music & Arts',
      city: 'Shillong',
      state: 'Meghalaya',
      venue: 'Ward’s Lake Pine Amphitheatre',
      dateLabel: 'Nov 28–30, 2026',
      priceInr: 3200,
      capacity: 280,
      sold: 234,
    },
    {
      id: 'evt_mz_aizawl',
      title: 'Aizawl Bamboo Architecture & Choral Harmony Summit',
      subtitle: 'Hill-slope structural engineering workshops and evening Mizoram choral showcases.',
      category: 'Design',
      city: 'Aizawl',
      state: 'Mizoram',
      venue: 'Vanapa Hall Cultural Centre',
      dateLabel: 'Mar 15–16, 2027',
      priceInr: 2199,
      capacity: 140,
      sold: 88,
    },
    {
      id: 'evt_nl_kohima',
      title: 'Kohima Naga Heritage Culinary & Acoustic Week',
      subtitle: 'Slow-smoked regional culinary masterclasses and highland folk storytelling.',
      category: 'Culinary',
      city: 'Kohima',
      state: 'Nagaland',
      venue: 'Kisama Heritage Amphitheatre',
      dateLabel: 'Dec 5–7, 2026',
      priceInr: 2899,
      capacity: 200,
      sold: 156,
    },
    {
      id: 'evt_od_bhubaneswar',
      title: 'Bhubaneswar Temple Stonecraft & Digital Systems Forum',
      subtitle: 'Odisha handloom digital commerce, semiconductor talent, and Konark architectural studies.',
      category: 'Technology',
      city: 'Bhubaneswar',
      state: 'Odisha',
      venue: 'Kalinga Convention Complex',
      dateLabel: 'Jan 30–31, 2027',
      priceInr: 3400,
      capacity: 230,
      sold: 158,
    },
    {
      id: 'evt_pb_amritsar',
      title: 'Amritsar Heritage Gastronomy & Agri-Tech Conclave',
      subtitle: 'Punjab farm-to-hearth tasting tables alongside cold-chain and agri-fintech panels.',
      category: 'Culinary',
      city: 'Amritsar',
      state: 'Punjab',
      venue: 'Gobindgarh Courtyard Pavilion',
      dateLabel: 'Feb 22–23, 2027',
      priceInr: 4100,
      capacity: 210,
      sold: 149,
    },
    {
      id: 'evt_sk_gangtok',
      title: 'Gangtok Organic Provenance & Himalayan Sound Retreat',
      subtitle: 'Cardamom & tea tasting sessions overlooking Kanchenjunga with ambient live acoustics.',
      category: 'Culinary',
      city: 'Gangtok',
      state: 'Sikkim',
      venue: 'Chintan Bhawan Terrace',
      dateLabel: 'Mar 20–21, 2027',
      priceInr: 4499,
      capacity: 120,
      sold: 92,
    },
    {
      id: 'evt_tn_chennai',
      title: 'Chennai Deep-Tech Hardware & Carnatic Synthesis Forum',
      subtitle: 'SaaS, EV powertrain engineering, and twilight Sabhas exploring acoustic electronics.',
      category: 'Technology',
      city: 'Chennai',
      state: 'Tamil Nadu',
      venue: 'Chennai Trade & Convention Centre',
      dateLabel: 'Jan 16–18, 2027',
      priceInr: 6200,
      capacity: 350,
      sold: 274,
    },
    {
      id: 'evt_ts_hyderabad',
      title: 'Hyderabad Bio-Systems, Cloud & Deccan Capital Summit',
      subtitle: 'Life-sciences computation, HITEC City venture desks, and Nizam culinary evenings.',
      category: 'Finance',
      city: 'Hyderabad',
      state: 'Telangana',
      venue: 'HICC Novotel Complex',
      dateLabel: 'Feb 19–20, 2027',
      priceInr: 7800,
      capacity: 340,
      sold: 263,
    },
    {
      id: 'evt_tr_agartala',
      title: 'Agartala Royal Ujjayanta Craft & Music Symposium',
      subtitle: 'Cane-and-bamboo furniture design exhibitions and classical sarod evenings.',
      category: 'Design',
      city: 'Agartala',
      state: 'Tripura',
      venue: 'Pragna Bhawan Convention Hall',
      dateLabel: 'Feb 26–27, 2027',
      priceInr: 1999,
      capacity: 150,
      sold: 96,
    },
    {
      id: 'evt_up_lucknow',
      title: 'Lucknow Awadhi Culinary Archive & Chikankari Design Fair',
      subtitle: 'Slow-cooked Dastarkhwan heritage dinners paired with contemporary textile craft.',
      category: 'Culinary',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      venue: 'Chhatar Manzil Heritage Courtyard',
      dateLabel: 'Feb 6–8, 2027',
      priceInr: 4800,
      capacity: 220,
      sold: 174,
    },
    {
      id: 'evt_uk_dehradun',
      title: 'Dehradun Himalayan Climate Tech & Architecture Retreat',
      subtitle: 'Net-zero mountain urbanism, watershed engineering, and timber-stone studio critiques.',
      category: 'Design',
      city: 'Dehradun',
      state: 'Uttarakhand',
      venue: 'Forest Research Institute Lawn Pavilion',
      dateLabel: 'Mar 10–11, 2027',
      priceInr: 4500,
      capacity: 190,
      sold: 138,
    },
    {
      id: 'evt_wb_kolkata',
      title: 'Kolkata Literary Print, Jazz & Heritage Capital Forum',
      subtitle: 'Park Street jazz ensembles, independent publishing fairs, and eastern treasury panels.',
      category: 'Music & Arts',
      city: 'Kolkata',
      state: 'West Bengal',
      venue: 'Biswa Bangla Convention Centre',
      dateLabel: 'Jan 23–25, 2027',
      priceInr: 4900,
      capacity: 320,
      sold: 248,
    },
    {
      id: 'evt_dl_newdelhi',
      title: 'New Delhi Sovereign Policy, Fintech & Design Conclave',
      subtitle: 'National DPI architecture, venture capital dialogues, and Lodhi art district salons.',
      category: 'Finance',
      city: 'New Delhi',
      state: 'Delhi (NCT)',
      venue: 'Bharat Mandapam, Pragati Maidan',
      dateLabel: 'Jan 12–13, 2027',
      priceInr: 9500,
      capacity: 420,
      sold: 352,
    },
    {
      id: 'evt_ch_chandigarh',
      title: 'Chandigarh Modernist Concrete & Urban Design Biennial',
      subtitle: 'Le Corbusier architectural walks, industrial furniture workshops, and studio panels.',
      category: 'Design',
      city: 'Chandigarh',
      state: 'Chandigarh',
      venue: 'Capitol Complex Open Pavilion',
      dateLabel: 'Feb 14–15, 2027',
      priceInr: 4600,
      capacity: 200,
      sold: 154,
    },
    {
      id: 'evt_jk_srinagar',
      title: 'Srinagar Dal Lake Walnut Craft & Sufiana Gathering',
      subtitle: 'Lakeside Kashmiri paper-mâché ateliers, saffron harvest tastings, and twilight santoor.',
      category: 'Music & Arts',
      city: 'Srinagar',
      state: 'Jammu & Kashmir',
      venue: 'SKICC Lakeside Pavilion',
      dateLabel: 'Apr 2–4, 2027',
      priceInr: 4300,
      capacity: 180,
      sold: 141,
    },
    {
      id: 'evt_la_leh',
      title: 'Leh High-Altitude Solar Architecture & Astronomy Camp',
      subtitle: 'Passive solar mud-brick design workshops and dark-sky observatory nights.',
      category: 'Technology',
      city: 'Leh',
      state: 'Ladakh',
      venue: 'Sindhu Sanskriti Kendra',
      dateLabel: 'May 14–16, 2027',
      priceInr: 5200,
      capacity: 110,
      sold: 84,
    },
    {
      id: 'evt_py_puducherry',
      title: 'Puducherry Franco-Tamil Architecture & Ceramic Studio',
      subtitle: 'White Town lime-plaster restoration labs, stoneware kilns, and coastal dining.',
      category: 'Culinary',
      city: 'Puducherry',
      state: 'Puducherry',
      venue: 'Maison Colombani Courtyard',
      dateLabel: 'Jan 29–30, 2027',
      priceInr: 4700,
      capacity: 130,
      sold: 102,
    },
    {
      id: 'evt_an_portblair',
      title: 'Sri Vijaya Puram Coral Conservation & Ocean Tech Summit',
      subtitle: 'Marine telemetry sensors, island microgrids, and sustainable eco-architecture.',
      category: 'Technology',
      city: 'Sri Vijaya Puram',
      state: 'Andaman & Nicobar Islands',
      venue: 'Marine Hill Oceanarium Hall',
      dateLabel: 'Mar 24–25, 2027',
      priceInr: 4900,
      capacity: 120,
      sold: 79,
    },
    {
      id: 'evt_dn_daman',
      title: 'Daman Coastal Fort Heritage & Maritime FinTech Forum',
      subtitle: 'Western coast logistics corridors, SME treasury solutions, and Portuguese fort evenings.',
      category: 'Finance',
      city: 'Daman',
      state: 'Dadra & Nagar Haveli and Daman & Diu',
      venue: 'Moti Daman Heritage Hall',
      dateLabel: 'Feb 27–28, 2027',
      priceInr: 3100,
      capacity: 150,
      sold: 98,
    },
    {
      id: 'evt_ld_kavaratti',
      title: 'Kavaratti Blue Lagoon Acoustic & Marine Craft Residency',
      subtitle: 'Zero-waste island culinary showcase and sunset acoustic performances.',
      category: 'Music & Arts',
      city: 'Kavaratti',
      state: 'Lakshadweep',
      venue: 'Lagoon Coral Pavilion',
      dateLabel: 'Mar 28–29, 2027',
      priceInr: 5600,
      capacity: 90,
      sold: 64,
    },
  ];

  const regionalEvents: EventItem[] = stateRegionalSeeds.map((seed) => ({
    id: seed.id,
    title: seed.title,
    subtitle: seed.subtitle,
    category: seed.category,
    city: seed.city,
    state: seed.state,
    country: 'India',
    venue: seed.venue,
    dateLabel: seed.dateLabel,
    startDateIso: '2027-01-15T10:00:00+05:30',
    imageUrl: categoryImage[seed.category],
    organizerName: `Meridian ${seed.state} Chapter`,
    tiers: [
      {
        id: `${seed.id}_std`,
        name: 'General Pass',
        description: `Full program access at ${seed.venue}, ${seed.city}.`,
        priceInr: seed.priceInr,
        capacity: Math.round(seed.capacity * 0.78),
        sold: Math.round(seed.sold * 0.78),
      },
      {
        id: `${seed.id}_vip`,
        name: 'Patron & VIP Access',
        description: 'Reserved front seating, hospitality lounge, and speaker reception.',
        priceInr: Math.round(seed.priceInr * 1.9),
        capacity: Math.max(12, Math.round(seed.capacity * 0.22)),
        sold: Math.round(seed.sold * 0.22),
      },
    ],
  }));

  const events: EventItem[] = [...flagshipEvents, ...regionalEvents];

  const seededTransactions: TransactionRecord[] = [
    {
      id: 'TXN-984210',
      bookingId: 'bk_seed_1',
      passCode: 'MRD-BLR-4182',
      eventId: 'evt_bengaluru_tech',
      eventTitle: 'Bengaluru Architecture & Product Systems Forum',
      customerName: 'Ananya Deshmukh',
      customerEmail: 'ananya@studioindiranagar.in',
      paymentMethod: 'bank_upi',
      paymentBrand: 'UPI Instant',
      currency: 'INR',
      subtotalBaseInr: 14500,
      platformFeeInr: 363,
      fxSpreadInr: 0,
      discountInr: 0,
      totalInr: 14863,
      chargedAmount: 14863,
      fxRateApplied: 1,
      status: 'settled',
      createdAt: hoursAgo(1),
    },
    {
      id: 'TXN-984209',
      bookingId: 'bk_seed_2',
      passCode: 'MRD-MUM-7721',
      eventId: 'evt_mumbai_fintech',
      eventTitle: 'Mumbai Global Capital & UPI Settlement Summit',
      customerName: 'Rohan Malhotra',
      customerEmail: 'rohan.m@bkc-ventures.in',
      paymentMethod: 'card',
      paymentBrand: 'Visa',
      last4: '4242',
      currency: 'INR',
      subtotalBaseInr: 24000,
      platformFeeInr: 600,
      fxSpreadInr: 0,
      discountInr: 2400,
      totalInr: 22200,
      chargedAmount: 22200,
      fxRateApplied: 1,
      status: 'settled',
      createdAt: hoursAgo(3),
    },
    {
      id: 'TXN-984208',
      bookingId: 'bk_seed_3',
      passCode: 'MRD-MUM-5504',
      eventId: 'evt_mumbai_fintech',
      eventTitle: 'Mumbai Global Capital & UPI Settlement Summit',
      customerName: 'Vikramaditya Rao',
      customerEmail: 'v.rao@difc-bridge.ae',
      paymentMethod: 'card',
      paymentBrand: 'Mastercard',
      last4: '8819',
      currency: 'AED',
      subtotalBaseInr: 35000,
      platformFeeInr: 875,
      fxSpreadInr: 140,
      discountInr: 0,
      totalInr: 36015,
      chargedAmount: 1567.37,
      fxRateApplied: 0.04352,
      status: 'settled',
      createdAt: hoursAgo(6),
    },
    {
      id: 'TXN-984207',
      bookingId: 'bk_seed_4',
      passCode: 'MRD-JAI-2091',
      eventId: 'evt_jaipur_music',
      eventTitle: 'Jaipur Sandstone Courtyard Raag & Electronic Festival',
      customerName: 'Meera Krishnan',
      customerEmail: 'meera@kothariarts.in',
      paymentMethod: 'wallet',
      paymentBrand: 'Google Pay',
      currency: 'INR',
      subtotalBaseInr: 9998,
      platformFeeInr: 250,
      fxSpreadInr: 0,
      discountInr: 0,
      totalInr: 10248,
      chargedAmount: 10248,
      fxRateApplied: 1,
      status: 'settled',
      createdAt: hoursAgo(11),
    },
    {
      id: 'TXN-984206',
      bookingId: 'bk_seed_5',
      passCode: 'MRD-UDA-3109',
      eventId: 'evt_udaipur_culinary',
      eventTitle: 'Udaipur Mewar Harvest & Brassware Culinary Atelier',
      customerName: 'Kabir Oberoi',
      customerEmail: 'kabir@atelierdelhi.in',
      paymentMethod: 'bank_upi',
      paymentBrand: 'UPI Instant',
      currency: 'INR',
      subtotalBaseInr: 16500,
      platformFeeInr: 413,
      fxSpreadInr: 0,
      discountInr: 0,
      totalInr: 16913,
      chargedAmount: 16913,
      fxRateApplied: 1,
      status: 'settled',
      createdAt: hoursAgo(18),
    },
    {
      id: 'TXN-984205',
      bookingId: 'bk_seed_6',
      passCode: 'MRD-BLR-1192',
      eventId: 'evt_bengaluru_tech',
      eventTitle: 'Bengaluru Architecture & Product Systems Forum',
      customerName: 'Siddharth Menon',
      customerEmail: 'sid@sg-corridor.sg',
      paymentMethod: 'card',
      paymentBrand: 'Visa',
      last4: '5190',
      currency: 'SGD',
      subtotalBaseInr: 22900,
      platformFeeInr: 573,
      fxSpreadInr: 92,
      discountInr: 0,
      totalInr: 23565,
      chargedAmount: 373.74,
      fxRateApplied: 0.01586,
      status: 'settled',
      createdAt: daysAgo(2),
    },
    {
      id: 'TXN-984204',
      bookingId: 'bk_seed_7',
      passCode: 'MRD-JAI-8812',
      eventId: 'evt_jaipur_music',
      eventTitle: 'Jaipur Sandstone Courtyard Raag & Electronic Festival',
      customerName: 'Devika Singhania',
      customerEmail: 'devika@jaipurheritage.org',
      paymentMethod: 'wallet',
      paymentBrand: 'Apple Pay',
      currency: 'USD',
      subtotalBaseInr: 11500,
      platformFeeInr: 288,
      fxSpreadInr: 46,
      discountInr: 1150,
      totalInr: 10684,
      chargedAmount: 126.61,
      fxRateApplied: 0.01185,
      status: 'settled',
      createdAt: daysAgo(4),
    },
    {
      id: 'TXN-984203',
      bookingId: 'bk_seed_8',
      passCode: 'MRD-MUM-6034',
      eventId: 'evt_mumbai_fintech',
      eventTitle: 'Mumbai Global Capital & UPI Settlement Summit',
      customerName: 'Priya Nair',
      customerEmail: 'priya.nair@londonindia.co.uk',
      paymentMethod: 'card',
      paymentBrand: 'Mastercard',
      last4: '3321',
      currency: 'GBP',
      subtotalBaseInr: 9900,
      platformFeeInr: 248,
      fxSpreadInr: 40,
      discountInr: 0,
      totalInr: 10188,
      chargedAmount: 94.95,
      fxRateApplied: 0.00932,
      status: 'settled',
      createdAt: daysAgo(6),
    },
    {
      id: 'TXN-984202',
      bookingId: 'bk_seed_9',
      passCode: 'MRD-UDA-4020',
      eventId: 'evt_udaipur_culinary',
      eventTitle: 'Udaipur Mewar Harvest & Brassware Culinary Atelier',
      customerName: 'Arjun Kapoor',
      customerEmail: 'arjun.k@chandigarh.in',
      paymentMethod: 'card',
      paymentBrand: 'Visa',
      last4: '9042',
      currency: 'INR',
      subtotalBaseInr: 7500,
      platformFeeInr: 188,
      fxSpreadInr: 0,
      discountInr: 0,
      totalInr: 7688,
      chargedAmount: 7688,
      fxRateApplied: 1,
      status: 'refunded',
      createdAt: daysAgo(9),
    },
  ];

  const bookings: BookingRecord[] = seededTransactions
    .filter((t) => t.status === 'settled')
    .map((t, index) => {
      const ev = events.find((e) => e.id === t.eventId) ?? events[0];
      return {
        id: t.bookingId ?? `bk_seed_${index}`,
        passCode: t.passCode ?? `MRD-PASS-${1000 + index}`,
        eventId: t.eventId,
        eventTitle: t.eventTitle,
        eventDateLabel: ev.dateLabel,
        venue: `${ev.venue}, ${ev.city}`,
        tierId: ev.tiers[0].id,
        tierName: index % 2 === 0 ? ev.tiers[1]?.name ?? ev.tiers[0].name : ev.tiers[0].name,
        quantity: t.subtotalBaseInr > 22000 ? 4 : 1,
        attendeeName: t.customerName,
        attendeeEmail: t.customerEmail,
        organization: 'India Delegate Desk',
        paidCurrency: t.currency,
        paidAmount: t.chargedAmount,
        settlementInr: t.totalInr,
        checkedIn: index < 3,
        checkedInAt: index < 3 ? hoursAgo(index + 1) : undefined,
        transactionId: t.id,
        createdAt: t.createdAt,
      };
    });

  const fxOrders: FxExchangeOrder[] = [
    {
      id: 'EXG-4410',
      fromCurrency: 'USD',
      toCurrency: 'INR',
      fromAmount: 1000,
      toAmount: 84050,
      midMarketRate: 84.388,
      appliedRate: 84.05,
      spreadPercent: 0.4,
      feeAmountFrom: 4,
      lockedUntil: new Date(now + 24 * 3600 * 1000).toISOString(),
      purpose: 'checkout_lock',
      status: 'settled',
      createdAt: hoursAgo(2),
    },
    {
      id: 'EXG-4409',
      fromCurrency: 'AED',
      toCurrency: 'INR',
      fromAmount: 2500,
      toAmount: 57215,
      midMarketRate: 22.978,
      appliedRate: 22.886,
      spreadPercent: 0.4,
      feeAmountFrom: 10,
      lockedUntil: new Date(now + 24 * 3600 * 1000).toISOString(),
      purpose: 'group_split',
      status: 'settled',
      createdAt: hoursAgo(8),
    },
    {
      id: 'EXG-4408',
      fromCurrency: 'GBP',
      toCurrency: 'INR',
      fromAmount: 650,
      toAmount: 69463,
      midMarketRate: 107.296,
      appliedRate: 106.867,
      spreadPercent: 0.4,
      feeAmountFrom: 2.6,
      lockedUntil: new Date(now + 24 * 3600 * 1000).toISOString(),
      purpose: 'peer_exchange',
      status: 'settled',
      createdAt: daysAgo(1),
    },
  ];

  const shareLinks: ShareSplitLink[] = [
    {
      code: 'BLR-GROUP4',
      eventId: 'evt_bengaluru_tech',
      eventTitle: 'Bengaluru Architecture & Product Systems Forum',
      creatorName: 'Ananya Deshmukh',
      mode: 'group_split',
      splitCount: 4,
      targetCurrency: 'INR',
      perPersonBaseInr: 5850,
      perPersonTarget: 5850,
      discountPercent: 10,
      clicks: 44,
      redemptions: 9,
      createdAt: daysAgo(3),
    },
    {
      code: 'BKC-DESK10',
      eventId: 'evt_mumbai_fintech',
      eventTitle: 'Mumbai Global Capital & UPI Settlement Summit',
      creatorName: 'Rohan Malhotra',
      mode: 'referral',
      splitCount: 1,
      targetCurrency: 'INR',
      perPersonBaseInr: 8910,
      perPersonTarget: 8910,
      discountPercent: 10,
      clicks: 62,
      redemptions: 14,
      createdAt: daysAgo(5),
    },
  ];

  return {
    events,
    bookings,
    transactions: seededTransactions,
    fxOrders,
    shareLinks,
    paymentIntents: {},
  };
}

function loadStore(): PlatformStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PlatformStore;
    if (
      !parsed.events ||
      !parsed.transactions ||
      !parsed.events[0]?.tiers?.[0]?.priceInr ||
      !parsed.events[0]?.state ||
      parsed.events.length < 36
    ) {
      throw new Error('Migrate store schema to all-India states coverage');
    }
    return parsed;
  } catch {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

let store: PlatformStore = loadStore();

function saveStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function luhnCheck(cardDigits: string): boolean {
  const digits = cardDigits.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number.parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectCardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'RuPay';
  return 'Card';
}

function computeAnalytics(range: '24h' | '7d' | '30d' = '7d'): AnalyticsSnapshot {
  const now = Date.now();
  const rangeMs =
    range === '24h' ? 24 * 3600 * 1000 : range === '7d' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  const cutoff = now - rangeMs;

  const settledInRange = store.transactions.filter(
    (t) => t.status === 'settled' && new Date(t.createdAt).getTime() >= cutoff
  );
  const allSettled = store.transactions.filter((t) => t.status === 'settled');

  const grossRevenueInr = settledInRange.reduce((acc, t) => acc + t.totalInr, 0);
  const netSettlementInr = settledInRange.reduce(
    (acc, t) => acc + (t.totalInr - t.platformFeeInr),
    0
  );

  const totalCapacity = store.events.reduce(
    (acc, ev) => acc + ev.tiers.reduce((s, tier) => s + tier.capacity, 0),
    0
  );
  const totalTicketsSold = store.events.reduce(
    (acc, ev) => acc + ev.tiers.reduce((s, tier) => s + tier.sold, 0),
    0
  );
  const sellThroughRate = totalCapacity > 0 ? (totalTicketsSold / totalCapacity) * 100 : 0;

  const fxTxInr = settledInRange
    .filter((t) => t.currency !== 'INR')
    .reduce((acc, t) => acc + t.totalInr, 0);
  const fxOrdersInr = store.fxOrders
    .filter((f) => new Date(f.createdAt).getTime() >= cutoff)
    .reduce((acc, f) => acc + convertCurrency(f.fromAmount, f.fromCurrency, 'INR'), 0);
  const fxVolumeInr = fxTxInr + fxOrdersInr;

  const totalClicks = store.shareLinks.reduce((acc, s) => acc + s.clicks, 0);
  const shareRedemptions = store.shareLinks.reduce((acc, s) => acc + s.redemptions, 0);
  const conversionRate =
    totalClicks > 0
      ? Math.min(98.5, Number(((settledInRange.length / Math.max(1, totalClicks * 0.22)) * 100).toFixed(1)))
      : 71.2;

  const bucketCount = range === '24h' ? 8 : range === '7d' ? 7 : 10;
  const bucketDuration = rangeMs / bucketCount;
  const timeSeries = Array.from({ length: bucketCount }, (_, i) => {
    const start = cutoff + i * bucketDuration;
    const end = start + bucketDuration;
    const bucketTx = settledInRange.filter((t) => {
      const ts = new Date(t.createdAt).getTime();
      return ts >= start && ts < (i === bucketCount - 1 ? now + 1000 : end);
    });
    const bucketFx = store.fxOrders.filter((f) => {
      const ts = new Date(f.createdAt).getTime();
      return ts >= start && ts < (i === bucketCount - 1 ? now + 1000 : end);
    });

    const d = new Date(end);
    const label =
      range === '24h'
        ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

    const rev = bucketTx.reduce((s, t) => s + t.totalInr, 0);
    const fxV =
      bucketTx.filter((t) => t.currency !== 'INR').reduce((s, t) => s + t.totalInr, 0) +
      bucketFx.reduce((s, f) => s + convertCurrency(f.fromAmount, f.fromCurrency, 'INR'), 0);

    return {
      label,
      revenueInr: Math.round(rev),
      tickets: bucketTx.length,
      fxVolumeInr: Math.round(fxV),
    };
  });

  const sourceTx = settledInRange.length > 0 ? settledInRange : allSettled;
  const totalVolForMix = Math.max(
    1,
    sourceTx.reduce((s, t) => s + t.totalInr, 0)
  );
  const currencyMap = new Map<CurrencyCode, { volumeInr: number; transactions: number }>();
  for (const t of sourceTx) {
    const prev = currencyMap.get(t.currency) ?? { volumeInr: 0, transactions: 0 };
    currencyMap.set(t.currency, {
      volumeInr: prev.volumeInr + t.totalInr,
      transactions: prev.transactions + 1,
    });
  }
  const currencyBreakdown = Array.from(currencyMap.entries())
    .map(([currency, val]) => ({
      currency,
      volumeInr: Math.round(val.volumeInr),
      transactions: val.transactions,
      sharePercent: Number(((val.volumeInr / totalVolForMix) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.volumeInr - a.volumeInr);

  const methodLabels: Record<PaymentMethodType, string> = {
    card: 'Card Gateway (Visa / RuPay / MC)',
    bank_upi: 'UPI Instant / NetBanking',
    wallet: 'Digital Wallets (GPay / Apple Pay)',
  };
  const methodMap = new Map<PaymentMethodType, { volumeInr: number; count: number }>();
  for (const t of sourceTx) {
    const prev = methodMap.get(t.paymentMethod) ?? { volumeInr: 0, count: 0 };
    methodMap.set(t.paymentMethod, {
      volumeInr: prev.volumeInr + t.totalInr,
      count: prev.count + 1,
    });
  }
  const methodBreakdown = (['bank_upi', 'card', 'wallet'] as PaymentMethodType[]).map((method) => {
    const val = methodMap.get(method) ?? { volumeInr: 0, count: 0 };
    return {
      method,
      label: methodLabels[method],
      volumeInr: Math.round(val.volumeInr),
      count: val.count,
      sharePercent: Number(((val.volumeInr / totalVolForMix) * 100).toFixed(1)),
    };
  });

  const eventPerformance = store.events.map((ev) => {
    const sold = ev.tiers.reduce((s, t) => s + t.sold, 0);
    const capacity = ev.tiers.reduce((s, t) => s + t.capacity, 0);
    const txRev = allSettled
      .filter((t) => t.eventId === ev.id)
      .reduce((s, t) => s + t.totalInr, 0);
    const baseSoldEst = ev.tiers.reduce((s, t) => s + t.sold * t.priceInr, 0);
    return {
      eventId: ev.id,
      title: ev.title,
      category: ev.category,
      sold,
      capacity,
      revenueInr: Math.round(Math.max(txRev, baseSoldEst)),
    };
  });

  return {
    range,
    grossRevenueInr: Math.round(grossRevenueInr),
    netSettlementInr: Math.round(netSettlementInr),
    totalTicketsSold,
    totalCapacity,
    sellThroughRate: Number(sellThroughRate.toFixed(1)),
    conversionRate: Number(conversionRate.toFixed(1)),
    fxVolumeInr: Math.round(fxVolumeInr),
    activeShareLinks: store.shareLinks.length,
    shareRedemptions,
    checkedInCount: store.bookings.filter((b) => b.checkedIn).length,
    timeSeries,
    currencyBreakdown,
    methodBreakdown,
    eventPerformance,
    recentTransactions: [...store.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    recentBookings: [...store.bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    recentFxOrders: [...store.fxOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}

const sseClients = new Set<Response>();

function broadcastRealtimeUpdate(eventType: string, payload: Record<string, unknown> = {}) {
  const analytics = computeAnalytics('7d');
  const message = JSON.stringify({
    type: eventType,
    timestamp: new Date().toISOString(),
    analytics,
    ...payload,
  });
  for (const client of sseClients) {
    client.write(`event: update\ndata: ${message}\n\n`);
  }
}

async function startServer() {
  const app = express();
  app.use((req: Request, res: Response, next) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
    const requestOrigin = req.headers.origin;
    if (requestOrigin && (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, currency: 'INR', timestamp: new Date().toISOString() });
  });

  app.get('/api/events', (_req: Request, res: Response) => {
    res.json({ events: store.events });
  });

  app.post('/api/events', (req: Request, res: Response) => {
    const {
      title,
      subtitle,
      category,
      city,
      state,
      country,
      venue,
      dateLabel,
      organizerName,
      standardPriceInr,
      capacity,
    } = req.body ?? {};
    if (!title || !city || !venue || !dateLabel) {
      res.status(400).json({ error: 'Title, city, venue, and event date are required.' });
      return;
    }
    const basePrice = Math.max(499, Math.round(Number(standardPriceInr) || 4999));
    const totalCap = Math.max(20, Math.round(Number(capacity) || 180));
    const imagePool = [
      '/src/assets/images/event_bengaluru_tech_1794673548777.jpg',
      '/src/assets/images/event_mumbai_fintech_1794673549152.jpg',
      '/src/assets/images/event_jaipur_music_1794673549597.jpg',
      '/src/assets/images/event_udaipur_culinary_1794673551037.jpg',
    ];
    const chosenImg = imagePool[store.events.length % imagePool.length];
    const newEvent: EventItem = {
      id: `evt_${crypto.randomBytes(4).toString('hex')}`,
      title: String(title).trim(),
      subtitle: String(subtitle || 'Curated Indian gathering with instant INR & multi-currency ticketing.').trim(),
      category: category || 'Technology',
      city: String(city).trim(),
      state: String(state || 'Maharashtra').trim(),
      country: String(country || 'India').trim(),
      venue: String(venue).trim(),
      dateLabel: String(dateLabel).trim(),
      startDateIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      imageUrl: chosenImg,
      organizerName: String(organizerName || 'Meridian India Studio').trim(),
      tiers: [
        {
          id: `tier_${crypto.randomBytes(3).toString('hex')}`,
          name: 'General Admission',
          description: 'Full access to all main sessions and digital QR pass.',
          priceInr: basePrice,
          capacity: Math.round(totalCap * 0.75),
          sold: 0,
        },
        {
          id: `tier_${crypto.randomBytes(3).toString('hex')}`,
          name: 'Patron & VIP Lounge',
          description: 'Reserved front-row seating, hospitality lounge, and speaker reception.',
          priceInr: Math.round(basePrice * 2),
          capacity: Math.max(10, Math.round(totalCap * 0.25)),
          sold: 0,
        },
      ],
    };
    store.events.unshift(newEvent);
    saveStore();
    broadcastRealtimeUpdate('event_created', { event: newEvent });
    res.status(201).json({ event: newEvent });
  });

  app.get('/api/fx/rates', (_req: Request, res: Response) => {
    res.json({
      base: 'INR',
      spreadPercent: 0.4,
      rates: CURRENCIES,
      recentOrders: store.fxOrders.slice(0, 8),
    });
  });

  app.post('/api/fx/exchange', (req: Request, res: Response) => {
    const { fromCurrency, toCurrency, fromAmount, purpose } = req.body ?? {};
    const from = fromCurrency as CurrencyCode;
    const to = toCurrency as CurrencyCode;
    const amount = Number(fromAmount);

    if (!CURRENCIES[from] || !CURRENCIES[to] || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valid source currency, target currency, and positive amount are required.' });
      return;
    }
    if (from === to) {
      res.status(400).json({ error: 'Choose two different currencies to execute an exchange.' });
      return;
    }

    const spreadPercent = 0.4;
    const midMarketRate = getMidMarketRate(from, to);
    const appliedRate = midMarketRate * (1 - spreadPercent / 100);
    const feeAmountFrom = Number((amount * (spreadPercent / 100)).toFixed(CURRENCIES[from].decimals));
    const toAmount = Number((amount * appliedRate).toFixed(CURRENCIES[to].decimals));

    const order: FxExchangeOrder = {
      id: `EXG-${crypto.randomInt(1000, 9999)}`,
      fromCurrency: from,
      toCurrency: to,
      fromAmount: Number(amount.toFixed(CURRENCIES[from].decimals)),
      toAmount,
      midMarketRate: Number(midMarketRate.toFixed(6)),
      appliedRate: Number(appliedRate.toFixed(6)),
      spreadPercent,
      feeAmountFrom,
      lockedUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      purpose: purpose === 'group_split' || purpose === 'peer_exchange' ? purpose : 'checkout_lock',
      status: 'locked',
      createdAt: new Date().toISOString(),
    };

    store.fxOrders.unshift(order);
    saveStore();
    broadcastRealtimeUpdate('fx_exchange', { fxOrder: order });
    res.status(201).json({ order });
  });

  app.post('/api/shares', (req: Request, res: Response) => {
    const { eventId, creatorName, mode, splitCount, targetCurrency } = req.body ?? {};
    const ev = store.events.find((e) => e.id === eventId);
    if (!ev) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }
    const target = (CURRENCIES[targetCurrency as CurrencyCode] ? targetCurrency : 'INR') as CurrencyCode;
    const count = Math.min(12, Math.max(1, Number(splitCount) || 2));
    const discountPercent = 10;
    const baseTierPrice = ev.tiers[0]?.priceInr ?? 5000;
    const discountedTotalInr = baseTierPrice * count * (1 - discountPercent / 100);
    const perPersonBaseInr = Math.round(discountedTotalInr / count);
    const perPersonTarget = Number(
      convertCurrency(perPersonBaseInr, 'INR', target).toFixed(CURRENCIES[target].decimals)
    );

    const slug = ev.city.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const code = `${slug}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const shareLink: ShareSplitLink = {
      code,
      eventId: ev.id,
      eventTitle: ev.title,
      creatorName: String(creatorName || 'Guest Host').trim(),
      mode: mode === 'referral' ? 'referral' : 'group_split',
      splitCount: count,
      targetCurrency: target,
      perPersonBaseInr,
      perPersonTarget,
      discountPercent,
      clicks: 1,
      redemptions: 0,
      createdAt: new Date().toISOString(),
    };

    store.shareLinks.unshift(shareLink);
    saveStore();
    broadcastRealtimeUpdate('share_created', { shareLink });
    res.status(201).json({ shareLink });
  });

  app.get('/api/shares/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase();
    const found = store.shareLinks.find((s) => s.code.toUpperCase() === code);
    if (!found) {
      res.status(404).json({ error: 'Share code not found or expired.' });
      return;
    }
    found.clicks += 1;
    saveStore();
    res.json({ shareLink: found });
  });

  app.post('/api/payments/intent', (req: Request, res: Response) => {
    const { eventId, tierId, quantity, currency, promoCode, fxReceiptId } = req.body ?? {};
    const ev = store.events.find((e) => e.id === eventId);
    if (!ev) {
      res.status(404).json({ error: 'Selected event was not found.' });
      return;
    }
    const tier = ev.tiers.find((t) => t.id === tierId);
    if (!tier) {
      res.status(404).json({ error: 'Selected ticket tier was not found.' });
      return;
    }
    const qty = Math.max(1, Math.min(10, Number(quantity) || 1));
    const remaining = tier.capacity - tier.sold;
    if (remaining < qty) {
      res.status(409).json({ error: `Only ${remaining} pass(es) remaining in ${tier.name}.` });
      return;
    }

    const payCurrency = (CURRENCIES[currency as CurrencyCode] ? currency : 'INR') as CurrencyCode;
    const subtotalInr = Math.round(tier.priceInr * qty);
    let discountInr = 0;
    let shareCodeUsed: string | undefined;

    if (promoCode) {
      const normalized = String(promoCode).trim().toUpperCase();
      const matchedShare = store.shareLinks.find((s) => s.code.toUpperCase() === normalized);
      if (matchedShare) {
        discountInr = Math.round(subtotalInr * (matchedShare.discountPercent / 100));
        shareCodeUsed = matchedShare.code;
      } else if (normalized === 'INDIA10' || normalized === 'MERIDIAN10' || normalized === 'EARLYBIRD') {
        discountInr = Math.round(subtotalInr * 0.1);
        shareCodeUsed = normalized;
      }
    }

    const discountedSubtotal = Math.max(0, subtotalInr - discountInr);
    const platformFeeInr = Math.round(discountedSubtotal * 0.025);
    const fxSpreadInr = payCurrency === 'INR' ? 0 : Math.round(discountedSubtotal * 0.004);
    const totalInr = Math.round(discountedSubtotal + platformFeeInr + fxSpreadInr);

    const fxRateApplied = CURRENCIES[payCurrency].rateFromInr;
    let validFxReceiptId: string | undefined;
    if (fxReceiptId) {
      const fxOrder = store.fxOrders.find(
        (f) => f.id.toUpperCase() === String(fxReceiptId).trim().toUpperCase() && f.toCurrency === payCurrency
      );
      if (fxOrder) {
        validFxReceiptId = fxOrder.id;
      }
    }

    const chargedAmount = Number(
      (totalInr * fxRateApplied).toFixed(CURRENCIES[payCurrency].decimals)
    );

    const intentId = `PI_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const intent = {
      id: intentId,
      eventId: ev.id,
      tierId: tier.id,
      quantity: qty,
      currency: payCurrency,
      subtotalInr,
      platformFeeInr,
      fxSpreadInr,
      discountInr,
      totalInr,
      chargedAmount,
      fxRateApplied: Number(fxRateApplied.toFixed(6)),
      shareCodeUsed,
      fxReceiptId: validFxReceiptId,
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    };

    store.paymentIntents[intentId] = intent;
    saveStore();
    res.json({ intent });
  });

  app.post('/api/payments/process', (req: Request, res: Response) => {
    const {
      intentId,
      attendeeName,
      attendeeEmail,
      organization,
      notes,
      paymentMethod,
      cardNumber,
      cardExpiry,
      cardCvc,
      upiOrBankRef,
      walletProvider,
    } = req.body ?? {};

    const intent = store.paymentIntents[String(intentId || '')];
    if (!intent) {
      res.status(404).json({ error: 'Payment session expired. Please recalculate checkout.' });
      return;
    }
    if (intent.status === 'completed') {
      res.status(409).json({ error: 'This payment intent has already been processed.' });
      return;
    }
    if (!attendeeName || !attendeeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(attendeeEmail))) {
      res.status(400).json({ error: 'Valid attendee full name and email address are required.' });
      return;
    }

    const ev = store.events.find((e) => e.id === intent.eventId);
    const tier = ev?.tiers.find((t) => t.id === intent.tierId);
    if (!ev || !tier) {
      res.status(404).json({ error: 'Event or ticket tier no longer exists.' });
      return;
    }
    if (tier.capacity - tier.sold < intent.quantity) {
      res.status(409).json({ error: 'Insufficient seats remaining for this tier.' });
      return;
    }

    const method = (paymentMethod as PaymentMethodType) || 'bank_upi';
    let paymentBrand = 'UPI Instant';
    let last4: string | undefined;

    if (method === 'card') {
      const digits = String(cardNumber || '').replace(/\D/g, '');
      if (!luhnCheck(digits)) {
        res.status(400).json({ error: 'Card number failed validation. Check digits and try again.' });
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(String(cardExpiry || '').trim())) {
        res.status(400).json({ error: 'Enter a valid expiry date in MM/YY format.' });
        return;
      }
      const cvcDigits = String(cardCvc || '').replace(/\D/g, '');
      if (cvcDigits.length < 3 || cvcDigits.length > 4) {
        res.status(400).json({ error: 'Enter a valid 3 or 4 digit security code (CVC).' });
        return;
      }

      paymentBrand = detectCardBrand(digits);
      last4 = digits.slice(-4);

      if (last4 === '0002') {
        const declinedTxn: TransactionRecord = {
          id: `TXN-${crypto.randomInt(100000, 999999)}`,
          eventId: ev.id,
          eventTitle: ev.title,
          customerName: String(attendeeName).trim(),
          customerEmail: String(attendeeEmail).trim(),
          paymentMethod: 'card',
          paymentBrand,
          last4,
          currency: intent.currency,
          subtotalBaseInr: intent.subtotalInr,
          platformFeeInr: intent.platformFeeInr,
          fxSpreadInr: intent.fxSpreadInr,
          discountInr: intent.discountInr,
          totalInr: intent.totalInr,
          chargedAmount: intent.chargedAmount,
          fxRateApplied: intent.fxRateApplied,
          status: 'declined',
          declineReason: 'Issuing bank declined transaction (test card 0002: insufficient funds).',
          createdAt: new Date().toISOString(),
        };
        store.transactions.unshift(declinedTxn);
        saveStore();
        broadcastRealtimeUpdate('payment_declined', { transaction: declinedTxn });
        res.status(402).json({
          error: declinedTxn.declineReason,
          transaction: declinedTxn,
        });
        return;
      }
    } else if (method === 'bank_upi') {
      if (!upiOrBankRef || String(upiOrBankRef).trim().length < 4) {
        res.status(400).json({ error: 'Enter a valid UPI ID (e.g. name@okicici) or bank reference.' });
        return;
      }
      paymentBrand = String(upiOrBankRef).includes('@') ? 'UPI Instant' : 'NEFT / IMPS Instant';
    } else if (method === 'wallet') {
      paymentBrand = walletProvider === 'apple_pay' ? 'Apple Pay' : 'Google Pay';
    }

    tier.sold += intent.quantity;
    intent.status = 'completed';

    if (intent.shareCodeUsed) {
      const shareObj = store.shareLinks.find(
        (s) => s.code.toUpperCase() === intent.shareCodeUsed?.toUpperCase()
      );
      if (shareObj) {
        shareObj.redemptions += 1;
      }
    }
    if (intent.fxReceiptId) {
      const fxObj = store.fxOrders.find((f) => f.id === intent.fxReceiptId);
      if (fxObj) fxObj.status = 'settled';
    }

    const txnId = `TXN-${crypto.randomInt(100000, 999999)}`;
    const cityPrefix = ev.city.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const passCode = `MRD-${cityPrefix}-${crypto.randomInt(1000, 9999)}`;
    const bookingId = `bk_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const transaction: TransactionRecord = {
      id: txnId,
      bookingId,
      passCode,
      eventId: ev.id,
      eventTitle: ev.title,
      customerName: String(attendeeName).trim(),
      customerEmail: String(attendeeEmail).trim(),
      paymentMethod: method,
      paymentBrand,
      last4,
      currency: intent.currency,
      subtotalBaseInr: intent.subtotalInr,
      platformFeeInr: intent.platformFeeInr,
      fxSpreadInr: intent.fxSpreadInr,
      discountInr: intent.discountInr,
      totalInr: intent.totalInr,
      chargedAmount: intent.chargedAmount,
      fxRateApplied: intent.fxRateApplied,
      status: 'settled',
      createdAt: nowIso,
    };

    const booking: BookingRecord = {
      id: bookingId,
      passCode,
      eventId: ev.id,
      eventTitle: ev.title,
      eventDateLabel: ev.dateLabel,
      venue: `${ev.venue}, ${ev.city}`,
      tierId: tier.id,
      tierName: tier.name,
      quantity: intent.quantity,
      attendeeName: String(attendeeName).trim(),
      attendeeEmail: String(attendeeEmail).trim(),
      organization: organization ? String(organization).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      paidCurrency: intent.currency,
      paidAmount: intent.chargedAmount,
      settlementInr: intent.totalInr,
      checkedIn: false,
      shareCodeUsed: intent.shareCodeUsed,
      fxReceiptId: intent.fxReceiptId,
      transactionId: txnId,
      createdAt: nowIso,
    };

    store.transactions.unshift(transaction);
    store.bookings.unshift(booking);
    saveStore();

    broadcastRealtimeUpdate('transaction_settled', { transaction, booking });
    res.status(201).json({ transaction, booking });
  });

  app.get('/api/bookings', (req: Request, res: Response) => {
    const email = req.query.email ? String(req.query.email).trim().toLowerCase() : '';
    const bookings = email
      ? store.bookings.filter((b) => b.attendeeEmail.toLowerCase() === email)
      : store.bookings;
    res.json({ bookings });
  });

  app.post('/api/bookings/:id/checkin', (req: Request, res: Response) => {
    const booking = store.bookings.find((b) => b.id === req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking pass not found.' });
      return;
    }
    booking.checkedIn = !booking.checkedIn;
    booking.checkedInAt = booking.checkedIn ? new Date().toISOString() : undefined;
    saveStore();
    broadcastRealtimeUpdate('attendee_checkin', { booking });
    res.json({ booking });
  });

  app.post('/api/transactions/:id/refund', (req: Request, res: Response) => {
    const txn = store.transactions.find((t) => t.id === req.params.id);
    if (!txn) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    if (txn.status !== 'settled') {
      res.status(400).json({ error: 'Only settled transactions can be refunded.' });
      return;
    }
    txn.status = 'refunded';
    if (txn.bookingId) {
      const bk = store.bookings.find((b) => b.id === txn.bookingId);
      if (bk) {
        const ev = store.events.find((e) => e.id === bk.eventId);
        const tier = ev?.tiers.find((t) => t.id === bk.tierId);
        if (tier) {
          tier.sold = Math.max(0, tier.sold - bk.quantity);
        }
      }
    }
    saveStore();
    broadcastRealtimeUpdate('transaction_refunded', { transaction: txn });
    res.json({ transaction: txn });
  });

  app.get('/api/analytics', (req: Request, res: Response) => {
    const r = req.query.range;
    const range: '24h' | '7d' | '30d' = r === '24h' || r === '30d' ? r : '7d';
    res.json({ analytics: computeAnalytics(range) });
  });

  app.get('/api/analytics/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);
    const initialPayload = JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      analytics: computeAnalytics('7d'),
    });
    res.write(`event: connected\ndata: ${initialPayload}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Pass India server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
