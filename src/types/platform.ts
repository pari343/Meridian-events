export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'JPY' | 'AUD';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  rateFromInr: number;
  decimals: number;
}

export interface TicketTier {
  id: string;
  name: string;
  description: string;
  priceInr: number;
  capacity: number;
  sold: number;
}

export interface EventItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Design' | 'Finance' | 'Music & Arts' | 'Culinary' | 'Technology';
  city: string;
  state: string;
  country: string;
  venue: string;
  dateLabel: string;
  startDateIso: string;
  imageUrl: string;
  organizerName: string;
  featured?: boolean;
  tiers: TicketTier[];
}

export type PaymentMethodType = 'card' | 'bank_upi' | 'wallet';

export type TransactionStatus = 'settled' | 'pending' | 'refunded' | 'declined';

export interface BookingRecord {
  id: string;
  passCode: string;
  eventId: string;
  eventTitle: string;
  eventDateLabel: string;
  venue: string;
  tierId: string;
  tierName: string;
  quantity: number;
  attendeeName: string;
  attendeeEmail: string;
  organization?: string;
  notes?: string;
  paidCurrency: CurrencyCode;
  paidAmount: number;
  settlementInr: number;
  checkedIn: boolean;
  checkedInAt?: string;
  shareCodeUsed?: string;
  fxReceiptId?: string;
  transactionId: string;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  bookingId?: string;
  passCode?: string;
  eventId: string;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: PaymentMethodType;
  paymentBrand: string;
  last4?: string;
  currency: CurrencyCode;
  subtotalBaseInr: number;
  platformFeeInr: number;
  fxSpreadInr: number;
  discountInr: number;
  totalInr: number;
  chargedAmount: number;
  fxRateApplied: number;
  status: TransactionStatus;
  declineReason?: string;
  createdAt: string;
}

export interface FxExchangeOrder {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: number;
  toAmount: number;
  midMarketRate: number;
  appliedRate: number;
  spreadPercent: number;
  feeAmountFrom: number;
  lockedUntil: string;
  purpose: 'checkout_lock' | 'peer_exchange' | 'group_split';
  status: 'locked' | 'settled';
  createdAt: string;
}

export interface ShareSplitLink {
  code: string;
  eventId: string;
  eventTitle: string;
  creatorName: string;
  mode: 'referral' | 'group_split';
  splitCount: number;
  targetCurrency: CurrencyCode;
  perPersonBaseInr: number;
  perPersonTarget: number;
  discountPercent: number;
  clicks: number;
  redemptions: number;
  createdAt: string;
}

export interface TimeSeriesPoint {
  label: string;
  revenueInr: number;
  tickets: number;
  fxVolumeInr: number;
}

export interface AnalyticsSnapshot {
  range: '24h' | '7d' | '30d';
  grossRevenueInr: number;
  netSettlementInr: number;
  totalTicketsSold: number;
  totalCapacity: number;
  sellThroughRate: number;
  conversionRate: number;
  fxVolumeInr: number;
  activeShareLinks: number;
  shareRedemptions: number;
  checkedInCount: number;
  timeSeries: TimeSeriesPoint[];
  currencyBreakdown: Array<{
    currency: CurrencyCode;
    volumeInr: number;
    transactions: number;
    sharePercent: number;
  }>;
  methodBreakdown: Array<{
    method: PaymentMethodType;
    label: string;
    volumeInr: number;
    count: number;
    sharePercent: number;
  }>;
  eventPerformance: Array<{
    eventId: string;
    title: string;
    category: string;
    sold: number;
    capacity: number;
    revenueInr: number;
  }>;
  recentTransactions: TransactionRecord[];
  recentBookings: BookingRecord[];
  recentFxOrders: FxExchangeOrder[];
}
