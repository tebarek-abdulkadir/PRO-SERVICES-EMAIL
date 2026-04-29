/**
 * Types and utilities for payment-based conversions
 */

export interface RawPayment {
  PAYMENT_TYPE: string;
  CREATION_DATE: string; // "2026-01-14 14:22:31.000"
  CONTRACT_ID: string;
  CLIENT_ID: string;
  STATUS: string; // "RECEIVED", "PRE_PDP", etc.
  AMOUNT_OF_PAYMENT?: string | number; // Payment amount (can be in position 5 or 6 depending on CSV format)
  DATE_OF_PAYMENT: string; // "2026-01-14" (can be in position 6 or 7 depending on CSV format)
}

export interface ProcessedPayment {
  paymentType: string;
  creationDate: string;
  contractId: string;
  clientId: string;
  status: 'received' | 'pre_pdp' | 'other';
  dateOfPayment: string; // ISO date string "2026-01-14"
  service: 'oec' | 'owwa' | 'ttl' | 'ttlSingle' | 'ttlDouble' | 'ttlMultiple' | 'tte' | 'tteSingle' | 'tteDouble' | 'tteMultiple' | 'ttj' | 'visaSaudi' | 'schengen' | 'gcc' | 'filipina_pp' | 'ethiopian_pp' | 'other';
  amountOfPayment: number; // Parsed payment amount (0 if not provided)
}

export interface PaymentData {
  uploadDate: string;
  totalPayments: number;
  receivedPayments: number;
  payments: ProcessedPayment[];
}

/**
 * Maps payment types to P&L services
 */
export const PAYMENT_TYPE_MAP: Record<string, 'oec' | 'owwa' | 'ttl' | 'ttlSingle' | 'ttlDouble' | 'ttlMultiple' | 'tte' | 'tteSingle' | 'tteDouble' | 'tteMultiple' | 'ttj' | 'visaSaudi' | 'schengen' | 'gcc' | 'filipina_pp' | 'ethiopian_pp' | 'other'> = {
  // OEC payments
  "the maid's overseas employment certificate": 'oec',
  'overseas employment certificate': 'oec',
  'oec': 'oec',
  "the maid's contract verification": 'oec', // Contract verification = OEC
  'contract verification': 'oec',
  
  // OWWA payments
  'owwa registration': 'owwa',
  'owwa': 'owwa',
  
  // Travel Visa payments - by destination
  'travel to lebanon visa': 'ttl',
  'travel to lebanon': 'ttl',
  
  'travel to egypt visa': 'tte',
  'travel to egypt': 'tte',
  'travel to egypt visa - double entry': 'tteDouble',
  'travel to egypt visa – double entry': 'tteDouble',
  'travel to egypt double entry': 'tteDouble',
  
  'travel to jordan visa': 'ttj',
  'travel to jordan': 'ttj',
  
  'travel to morocco visa': 'schengen',
  'travel to morocco': 'schengen',
  'travel to turkey visa': 'schengen',
  'travel to turkey': 'schengen',
  
  // Passport Renewal payments
  'filipina passport renewal': 'filipina_pp',
  'filipino passport renewal': 'filipina_pp',
  'philippine passport renewal': 'filipina_pp',
  'philippines passport renewal': 'filipina_pp',
  
  'ethiopian passport renewal': 'ethiopian_pp',
  'ethiopia passport renewal': 'ethiopian_pp',
  'passport renewal': 'ethiopian_pp', // Default generic passport renewal to Ethiopian
  
  // GCC payments
  'good conduct certificate application': 'gcc',
  'good conduct certificate': 'gcc',
  'gcc': 'gcc',
};

/**
 * Maps payment type string to service category
 */
export function mapPaymentTypeToService(paymentType: string): 'oec' | 'owwa' | 'ttl' | 'ttlSingle' | 'ttlDouble' | 'ttlMultiple' | 'tte' | 'tteSingle' | 'tteDouble' | 'tteMultiple' | 'ttj' | 'visaSaudi' | 'schengen' | 'gcc' | 'filipina_pp' | 'ethiopian_pp' | 'other' {
  const normalized = paymentType.toLowerCase().trim();
  
  // Direct match
  if (PAYMENT_TYPE_MAP[normalized]) {
    return PAYMENT_TYPE_MAP[normalized];
  }
  
  // Fuzzy matching for common variations
  if (normalized.includes('oec') || normalized.includes('employment certificate') || normalized.includes('contract verification')) {
    return 'oec';
  }
  
  if (normalized.includes('owwa')) {
    return 'owwa';
  }
  
  // Travel visa fuzzy matching by destination
  if (normalized.includes('lebanon')) {
    return 'ttl';
  }
  
  if (normalized.includes('egypt')) {
    return 'tte';
  }
  
  if (normalized.includes('jordan')) {
    return 'ttj';
  }

  if (
    (normalized.includes('saudi') || normalized.includes('ksa')) &&
    (normalized.includes('visa') || normalized.includes('tourist') || normalized.includes('travel'))
  ) {
    return 'visaSaudi';
  }

  if (normalized.includes('schengen')) {
    const schengenDest = [
      'france',
      'germany',
      'spain',
      'switzerland',
      'croatia',
      'italy',
      'greece',
      'portugal',
      'bulgaria',
      'latvia',
    ];
    if (schengenDest.some((c) => normalized.includes(c))) {
      return 'schengen';
    }
    return 'other';
  }
  
  if (normalized.includes('gcc')) {
    return 'gcc';
  }
  
  // Passport renewal fuzzy matching
  if (normalized.includes('filipina') || normalized.includes('filipino') || normalized.includes('philippine') || normalized.includes('philippines')) {
    if (normalized.includes('passport')) {
      return 'filipina_pp';
    }
  }
  
  if (normalized.includes('ethiopian') || normalized.includes('ethiopia')) {
    if (normalized.includes('passport')) {
      return 'ethiopian_pp';
    }
  }
  
  if (normalized.includes('passport')) {
    return 'ethiopian_pp'; // Default generic passport to Ethiopian
  }
  
  return 'other';
}

/**
 * Normalizes payment status
 */
export function normalizePaymentStatus(status: string): 'received' | 'pre_pdp' | 'other' {
  const normalized = status.toLowerCase().trim();
  
  if (normalized === 'received') {
    return 'received';
  }
  
  if (normalized === 'pre_pdp') {
    return 'pre_pdp';
  }
  
  return 'other';
}

/**
 * Parses payment amount from string or number
 */
export function parsePaymentAmount(amount?: string | number): number {
  if (amount === undefined || amount === null || amount === '') {
    return 0;
  }
  
  if (typeof amount === 'number') {
    return amount;
  }
  
  // Remove any currency symbols, commas, spaces
  const cleaned = String(amount).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

