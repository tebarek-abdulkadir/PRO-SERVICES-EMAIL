'use client';

import { useEffect, useState } from 'react';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import type { EvalsDaySummary } from '@/lib/evals-summary';

function fmt(n: number, pct: number): string {
  return `${n} (${pct}%)`;
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

export default function EvalsDashboard() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [summary, setSummary] = useState<EvalsDaySummary | null>(null);
  const [evalDate, setEvalDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/evals/dates');
        const result = await res.json();
        if (cancelled) return;
        if (result.success && Array.isArray(result.dates)) {
          setAvailableDates(result.dates);
          if (result.dates.length > 0 && !selectedDate) {
            setSelectedDate(result.dates[result.dates.length - 1]);
          }
        }
      } catch (e) {
        console.error('[Evals] dates', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setIsLoading(false);
      setSummary(null);
      setEvalDate(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/evals?date=${encodeURIComponent(selectedDate)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          if (!json.data) {
            setError('No eval blob for this date.');
            setSummary(null);
            setEvalDate(null);
          } else {
            const s = json.data.summary as EvalsDaySummary | undefined;
            if (!s) {
              setError(
                'This blob has no `conversations` array (or it is not an array). Re-ingest with conversations to compute metrics.'
              );
              setSummary(null);
            } else {
              setError(null);
              setSummary(s);
            }
            setEvalDate(typeof json.data.evalDate === 'string' ? json.data.evalDate : selectedDate);
          }
        } else {
          setError(json.error || 'Failed to load evals');
          setSummary(null);
          setEvalDate(null);
        }
      } catch {
        if (!cancelled) {
          setError('Network error');
          setSummary(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleDateSelect = (start: string | null) => {
    setSelectedDate(start);
  };

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Evals</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Tool and policy evaluation metrics from daily <code className="text-xs bg-slate-100 px-1 rounded">evals</code>{' '}
          blobs (ingested via <code className="text-xs bg-slate-100 px-1 rounded">POST /api/evals</code>).
        </p>
      </div>
      <DatePickerCalendar
        availableDates={availableDates}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />
    </div>
  );

  if (isLoading && selectedDate) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-center h-48 rounded-xl border border-slate-200 bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Loading evals…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a date</h3>
          <p className="text-sm text-slate-500 text-center max-w-md">
            Choose a day that has eval data. If the list is empty, run your n8n flow to POST to{' '}
            <span className="font-mono text-xs">/api/evals</span> first.
          </p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          {error || 'No summary for this day. Re-ingest with a `conversations` array so metrics can be computed.'}
        </div>
      </div>
    );
  }

  const t = summary.toolEvals;
  const p = summary.policyEvals;

  return (
    <div className="space-y-8">
      {header}

      <div className="text-xs text-slate-500">
        Blob day <span className="font-medium text-slate-700">{evalDate}</span> · Unique conversation IDs{' '}
        {summary.uniqueConversationIdCount} · Eval rows {summary.conversationRecordCount} · Computed{' '}
        {new Date(summary.computedAt).toLocaleString()}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Tool evals</h2>
          <p className="text-xs text-slate-500 mt-1">
            “Total chats analyzed” uses comma-split unique IDs. “Conversations with …” counts distinct eval rows (full{' '}
            <code className="text-[11px]">conversationId</code> string). Tool-level percentages use total tool invocations.
          </p>
        </div>
        <div className="px-5 py-2">
          <MetricLine label="Total chats analyzed (unique conversation IDs)" value={String(t.totalChatsAnalyzed)} />
          <MetricLine label="Total tool calls" value={String(t.totalToolCalls)} />
          <MetricLine
            label="Conversations with wrong tool call"
            value={fmt(t.conversationsWithWrongToolCall, t.conversationsWithWrongToolCallPct)}
          />
          <MetricLine label="Wrong tool calls (of all tool calls)" value={fmt(t.wrongToolCalls, t.wrongToolCallsPct)} />
          <MetricLine
            label="Conversations with negative tool response"
            value={fmt(t.conversationsWithNegativeToolResponse, t.conversationsWithNegativeToolResponsePct)}
          />
          <MetricLine
            label="Negative tool responses (of all tool calls)"
            value={fmt(t.negativeToolResponses, t.negativeToolResponsesPct)}
          />
          <MetricLine
            label="Conversations with missed tool call"
            value={fmt(t.conversationsWithMissedToolCall, t.conversationsWithMissedToolCallPct)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Policy evals</h2>
          <p className="text-xs text-slate-500 mt-1">
            Counts distinct eval rows (full <code className="text-[11px]">conversationId</code>) with at least one flagged
            policy in that category.
          </p>
        </div>
        <div className="px-5 py-2">
          <MetricLine
            label="Conversations with wrong policy"
            value={fmt(p.conversationsWithWrongPolicy, p.conversationsWithWrongPolicyPct)}
          />
          <MetricLine
            label="Conversations with missed policy"
            value={fmt(p.conversationsWithMissedPolicy, p.conversationsWithMissedPolicyPct)}
          />
          <MetricLine
            label="Conversations with unclear policy"
            value={fmt(p.conversationsWithUnclearPolicy, p.conversationsWithUnclearPolicyPct)}
          />
        </div>
      </section>
    </div>
  );
}
