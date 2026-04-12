/**
 * Preserve contract/client/maid entity fields from the raw POST body across merge steps
 * (same idea as joinedSkills lookup in chat-joined-skills.ts).
 */

export type RawIngestEntityFields = {
  contractId?: string;
  clientId?: string;
  maidId?: string;
  clientName?: string;
  maidName?: string;
  contractType?: string;
};

function mergeEntityPreferNonEmpty(
  a: RawIngestEntityFields | undefined,
  b: RawIngestEntityFields
): RawIngestEntityFields {
  return {
    contractId: b.contractId || a?.contractId,
    clientId: b.clientId || a?.clientId,
    maidId: b.maidId || a?.maidId,
    clientName: b.clientName || a?.clientName,
    maidName: b.maidName || a?.maidName,
    contractType: b.contractType || a?.contractType,
  };
}

/** Normalize N8N / API quirks (numbers, empty strings). */
export function pickEntityFieldsFromRawRow(row: {
  contractId?: unknown;
  clientId?: unknown;
  maidId?: unknown;
  clientName?: unknown;
  maidName?: unknown;
  contractType?: unknown;
}): RawIngestEntityFields {
  const s = (v: unknown): string | undefined => {
    if (v == null || v === '') return undefined;
    const t = String(v).trim();
    return t || undefined;
  };
  return {
    contractId: s(row.contractId),
    clientId: s(row.clientId),
    maidId: s(row.maidId),
    clientName: s(row.clientName),
    maidName: s(row.maidName),
    contractType: s(row.contractType),
  };
}

export function buildEntityFieldsLookupMap(
  raw: ReadonlyArray<{ conversationId: string } & RawIngestEntityFields>
): Map<string, RawIngestEntityFields> {
  const m = new Map<string, RawIngestEntityFields>();
  for (const row of raw) {
    const slice: RawIngestEntityFields = {
      contractId: row.contractId,
      clientId: row.clientId,
      maidId: row.maidId,
      clientName: row.clientName,
      maidName: row.maidName,
      contractType: row.contractType,
    };
    for (const id of String(row.conversationId)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)) {
      m.set(id, mergeEntityPreferNonEmpty(m.get(id), slice));
    }
  }
  return m;
}

export function resolveEntityFieldsForMergedIds(
  mergedConversationIdCsv: string,
  lookup: Map<string, RawIngestEntityFields>
): RawIngestEntityFields {
  let acc: RawIngestEntityFields = {};
  for (const id of mergedConversationIdCsv
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)) {
    const slice = lookup.get(id);
    if (slice) acc = mergeEntityPreferNonEmpty(acc, slice);
  }
  return acc;
}
