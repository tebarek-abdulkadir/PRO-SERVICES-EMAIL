/**
 * Cost Tracker
 * Tracks and logs API expenses for every LLM call.
 * Supports both local file storage (dev) and Vercel Blob storage (production).
 */

import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { PUBLIC_JSON_PUT_OPTIONS, resolveBlobReadUrl } from '@/lib/vercel-blob-json';

const COST_LOG_FILE = path.join(process.cwd(), 'data', 'cost-log.json');
const COST_LOG_BLOB_PATH = 'cost-log.json';

// Check if we're in Vercel environment (use Blob) or local (use file system)
function isVercelEnvironment(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Pricing per 1M tokens
export const PRICING = {
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    batchInput: 0.075,
    batchOutput: 0.30,
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    batchInput: 1.25,
    batchOutput: 5.00,
  },
  'deepseek/deepseek-chat': {
    input: 0.14,
    output: 0.28,
    batchInput: 0.14,
    batchOutput: 0.28,
  },
};

export interface CostEntry {
  id: string;
  timestamp: string;
  model: string;
  type: 'realtime' | 'batch';
  tokens: { input: number; output: number };
  cost: number;
  conversationId?: string;
  success: boolean;
  error?: string;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  byModel: Record<string, {
    cost: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    successCount: number;
    failureCount: number;
  }>;
  byType: {
    realtime: { cost: number; calls: number; successCount: number; failureCount: number };
    batch: { cost: number; calls: number; successCount: number; failureCount: number };
  };
  entries: CostEntry[];
  failedRequests: Array<{
    id: string;
    timestamp: string;
    model: string;
    type: string;
    conversationId?: string;
    error: string;
  }>;
}

function createEmptySummary(): CostSummary {
  return {
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    byModel: {},
    byType: {
      realtime: { cost: 0, calls: 0, successCount: 0, failureCount: 0 },
      batch: { cost: 0, calls: 0, successCount: 0, failureCount: 0 },
    },
    entries: [],
    failedRequests: [],
  };
}

// ============================================
// Blob Storage Functions (Vercel Production)
// ============================================

async function readBlobData(): Promise<CostSummary> {
  try {
    const url = await resolveBlobReadUrl(COST_LOG_BLOB_PATH);
    if (!url) return createEmptySummary();

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return createEmptySummary();
    
    const data = await response.json();
    // Ensure all fields exist
    if (!data.successCount) data.successCount = 0;
    if (!data.failureCount) data.failureCount = 0;
    if (!data.failedRequests) data.failedRequests = [];
    return data;
  } catch (error) {
    console.error('[Cost Tracker] Error reading blob:', error);
    return createEmptySummary();
  }
}

async function writeBlobData(data: CostSummary): Promise<void> {
  try {
    await put(COST_LOG_BLOB_PATH, JSON.stringify(data, null, 2), PUBLIC_JSON_PUT_OPTIONS);
  } catch (error) {
    console.error('[Cost Tracker] Error writing blob:', error);
    throw error;
  }
}

// ============================================
// Local File Storage Functions (Development)
// ============================================

function ensureLocalLogFile(): CostSummary {
  const dir = path.dirname(COST_LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(COST_LOG_FILE)) {
    const initial = createEmptySummary();
    fs.writeFileSync(COST_LOG_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  
  const data = JSON.parse(fs.readFileSync(COST_LOG_FILE, 'utf-8'));
  if (!data.successCount) data.successCount = 0;
  if (!data.failureCount) data.failureCount = 0;
  if (!data.failedRequests) data.failedRequests = [];
  
  return data;
}

function writeLocalData(data: CostSummary): void {
  const dir = path.dirname(COST_LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(COST_LOG_FILE, JSON.stringify(data, null, 2));
}

// ============================================
// Unified Async Functions
// ============================================

export async function getCostSummaryAsync(): Promise<CostSummary> {
  if (isVercelEnvironment()) {
    return await readBlobData();
  }
  return ensureLocalLogFile();
}

export async function saveCostSummaryAsync(data: CostSummary): Promise<void> {
  if (isVercelEnvironment()) {
    await writeBlobData(data);
  } else {
    writeLocalData(data);
  }
}

// ============================================
// Public API
// ============================================

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  isBatch: boolean = false
): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o-mini'];
  const inputRate = isBatch ? pricing.batchInput : pricing.input;
  const outputRate = isBatch ? pricing.batchOutput : pricing.output;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

export async function logCostAsync(entry: Omit<CostEntry, 'id' | 'timestamp' | 'success'>): Promise<CostEntry> {
  const summary = await getCostSummaryAsync();
  
  const fullEntry: CostEntry = {
    ...entry,
    id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    success: true,
  };
  
  summary.totalCost += entry.cost;
  summary.totalInputTokens += entry.tokens.input;
  summary.totalOutputTokens += entry.tokens.output;
  summary.totalCalls += 1;
  summary.successCount += 1;
  
  if (!summary.byModel[entry.model]) {
    summary.byModel[entry.model] = { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0, successCount: 0, failureCount: 0 };
  }
  summary.byModel[entry.model].cost += entry.cost;
  summary.byModel[entry.model].calls += 1;
  summary.byModel[entry.model].inputTokens += entry.tokens.input;
  summary.byModel[entry.model].outputTokens += entry.tokens.output;
  summary.byModel[entry.model].successCount += 1;
  
  summary.byType[entry.type].cost += entry.cost;
  summary.byType[entry.type].calls += 1;
  summary.byType[entry.type].successCount += 1;
  
  summary.entries.push(fullEntry);
  if (summary.entries.length > 1000) {
    summary.entries = summary.entries.slice(-1000);
  }
  
  await saveCostSummaryAsync(summary);
  
  return fullEntry;
}

export async function logFailureAsync(params: {
  model: string;
  type: 'realtime' | 'batch';
  conversationId?: string;
  error: string;
}): Promise<void> {
  const summary = await getCostSummaryAsync();
  
  const failedEntry = {
    id: `fail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    model: params.model,
    type: params.type,
    conversationId: params.conversationId,
    error: params.error,
  };
  
  summary.totalCalls += 1;
  summary.failureCount += 1;
  
  if (!summary.byModel[params.model]) {
    summary.byModel[params.model] = { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0, successCount: 0, failureCount: 0 };
  }
  summary.byModel[params.model].calls += 1;
  summary.byModel[params.model].failureCount += 1;
  
  summary.byType[params.type].calls += 1;
  summary.byType[params.type].failureCount += 1;
  
  summary.failedRequests.push(failedEntry);
  if (summary.failedRequests.length > 100) {
    summary.failedRequests = summary.failedRequests.slice(-100);
  }
  
  await saveCostSummaryAsync(summary);
}

export async function getTodayCostsAsync(): Promise<{ cost: number; calls: number }> {
  const summary = await getCostSummaryAsync();
  const today = new Date().toISOString().split('T')[0];
  
  let cost = 0;
  let calls = 0;
  
  for (const entry of summary.entries) {
    if (entry.timestamp.startsWith(today)) {
      cost += entry.cost;
      calls += 1;
    }
  }
  
  return { cost, calls };
}

export async function resetCostLogAsync(): Promise<void> {
  await saveCostSummaryAsync(createEmptySummary());
}

// ============================================
// Sync versions for backwards compatibility (local only)
// ============================================

export function logCost(entry: Omit<CostEntry, 'id' | 'timestamp' | 'success'>): CostEntry {
  const summary = ensureLocalLogFile();
  
  const fullEntry: CostEntry = {
    ...entry,
    id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    success: true,
  };
  
  summary.totalCost += entry.cost;
  summary.totalInputTokens += entry.tokens.input;
  summary.totalOutputTokens += entry.tokens.output;
  summary.totalCalls += 1;
  summary.successCount += 1;
  
  if (!summary.byModel[entry.model]) {
    summary.byModel[entry.model] = { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0, successCount: 0, failureCount: 0 };
  }
  summary.byModel[entry.model].cost += entry.cost;
  summary.byModel[entry.model].calls += 1;
  summary.byModel[entry.model].inputTokens += entry.tokens.input;
  summary.byModel[entry.model].outputTokens += entry.tokens.output;
  summary.byModel[entry.model].successCount += 1;
  
  summary.byType[entry.type].cost += entry.cost;
  summary.byType[entry.type].calls += 1;
  summary.byType[entry.type].successCount += 1;
  
  summary.entries.push(fullEntry);
  if (summary.entries.length > 1000) {
    summary.entries = summary.entries.slice(-1000);
  }
  
  writeLocalData(summary);
  
  return fullEntry;
}

export function logFailure(params: {
  model: string;
  type: 'realtime' | 'batch';
  conversationId?: string;
  error: string;
}): void {
  const summary = ensureLocalLogFile();
  
  const failedEntry = {
    id: `fail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    model: params.model,
    type: params.type,
    conversationId: params.conversationId,
    error: params.error,
  };
  
  summary.totalCalls += 1;
  summary.failureCount += 1;
  
  if (!summary.byModel[params.model]) {
    summary.byModel[params.model] = { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0, successCount: 0, failureCount: 0 };
  }
  summary.byModel[params.model].calls += 1;
  summary.byModel[params.model].failureCount += 1;
  
  summary.byType[params.type].calls += 1;
  summary.byType[params.type].failureCount += 1;
  
  summary.failedRequests.push(failedEntry);
  if (summary.failedRequests.length > 100) {
    summary.failedRequests = summary.failedRequests.slice(-100);
  }
  
  writeLocalData(summary);
}

export function getCostSummary(): CostSummary {
  return ensureLocalLogFile();
}

export function getTodayCosts(): { cost: number; calls: number } {
  const summary = ensureLocalLogFile();
  const today = new Date().toISOString().split('T')[0];
  
  let cost = 0;
  let calls = 0;
  
  for (const entry of summary.entries) {
    if (entry.timestamp.startsWith(today)) {
      cost += entry.cost;
      calls += 1;
    }
  }
  
  return { cost, calls };
}

export function resetCostLog(): void {
  writeLocalData(createEmptySummary());
}
