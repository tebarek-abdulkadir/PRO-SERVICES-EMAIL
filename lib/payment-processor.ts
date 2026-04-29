import { RawPayment, ProcessedPayment, PaymentData, mapPaymentTypeToService, normalizePaymentStatus, parsePaymentAmount } from './payment-types';
import { put, list } from '@vercel/blob';

/**
 * Processes raw payment data and deduplicates
 */
export function processPayments(rawPayments: RawPayment[]): ProcessedPayment[] {
  const seen = new Set<string>();
  const processed: ProcessedPayment[] = [];
  
  for (const raw of rawPayments) {
    // Skip if missing critical data
    if (!raw.CONTRACT_ID || !raw.STATUS || !raw.DATE_OF_PAYMENT) {
      continue;
    }
    
    // Create unique key for deduplication
    const key = `${raw.CONTRACT_ID}-${raw.PAYMENT_TYPE}-${raw.DATE_OF_PAYMENT}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    
    // Process the payment
    const service = mapPaymentTypeToService(raw.PAYMENT_TYPE || '');
    const status = normalizePaymentStatus(raw.STATUS || '');
    const amountOfPayment = parsePaymentAmount(raw.AMOUNT_OF_PAYMENT);
    
    processed.push({
      paymentType: raw.PAYMENT_TYPE || '',
      creationDate: raw.CREATION_DATE || '',
      contractId: raw.CONTRACT_ID,
      clientId: raw.CLIENT_ID || '',
      status,
      dateOfPayment: raw.DATE_OF_PAYMENT,
      service,
      amountOfPayment,
    });
  }
  
  return processed;
}

/**
 * Saves payment data to Vercel Blob Storage
 */
export async function savePaymentData(payments: ProcessedPayment[]): Promise<void> {
  const now = new Date().toISOString();
  
  const paymentData: PaymentData = {
    uploadDate: now,
    totalPayments: payments.length,
    receivedPayments: payments.filter(p => p.status === 'received').length,
    payments,
  };
  
  const filename = 'payments-data.json';
  
  try {
    // Try to delete existing file first
    const { blobs } = await list({ prefix: filename });
    if (blobs.length > 0) {
      const { del } = await import('@vercel/blob');
      await del(blobs[0].url);
      console.log(`Deleted existing blob: ${filename}`);
    }
  } catch (error) {
    console.log(`No existing blob to delete or error deleting: ${filename}`, error);
  }
  
  // Now put the new data
  await put(filename, JSON.stringify(paymentData, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
  
  console.log(`Saved payment data: ${payments.length} payments (${paymentData.receivedPayments} received)`);
}

/**
 * Retrieves payment data from Vercel Blob Storage
 */
export async function getPaymentData(): Promise<PaymentData | null> {
  try {
    const { blobs } = await list({ prefix: 'payments-data.json' });
    
    if (blobs.length === 0) {
      console.log('No payment data found in blob storage');
      return null;
    }
    
    // Fetch the blob content
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      console.error(`Failed to fetch payment data: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json() as PaymentData;
    console.log(`Retrieved payment data: ${data.totalPayments} total, ${data.receivedPayments} received`);
    
    return data;
  } catch (error) {
    console.error('Error retrieving payment data:', error);
    return null;
  }
}

/**
 * Filters payments by date and status
 */
export function filterPaymentsByDate(
  payments: ProcessedPayment[],
  date: string,
  statusFilter: 'received' | 'all' = 'received'
): ProcessedPayment[] {
  return payments.filter(payment => {
    const matchesDate = payment.dateOfPayment === date;
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    return matchesDate && matchesStatus;
  });
}

/**
 * Gets conversions by service for a specific date
 */
export function getConversionsByService(
  payments: ProcessedPayment[],
  date: string
): {
  oec: { contractIds: Set<string>, count: number };
  owwa: { contractIds: Set<string>, count: number };
  travel_visa: { contractIds: Set<string>, count: number };
} {
  const datePayments = filterPaymentsByDate(payments, date, 'received');
  
  const oecContracts = new Set<string>();
  const owwaContracts = new Set<string>();
  const travelVisaContracts = new Set<string>();
  
  datePayments.forEach(payment => {
    if (payment.service === 'oec') {
      oecContracts.add(payment.contractId);
    } else if (payment.service === 'owwa') {
      owwaContracts.add(payment.contractId);
    } else if (['ttl', 'tte', 'ttj', 'visaSaudi', 'schengen', 'gcc'].includes(payment.service)) {
      travelVisaContracts.add(payment.contractId);
    }
  });
  
  return {
    oec: { contractIds: oecContracts, count: oecContracts.size },
    owwa: { contractIds: owwaContracts, count: owwaContracts.size },
    travel_visa: { contractIds: travelVisaContracts, count: travelVisaContracts.size },
  };
}

