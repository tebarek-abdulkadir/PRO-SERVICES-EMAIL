import { put, list, del } from '@vercel/blob';
import type { 
  ChatAnalysisData, 
  ChatAnalysisResult, 
  ChatTrendData, 
  ChatDriver, 
  ChatInsight,
  DelayTimeData,
  AgentDelayRecord,
  AgentDelayStats,
  AgentResponseTimeRecord
} from './chat-types';
import { computeByChatsViewMetrics, createEmptyByChatsViewMetrics } from './chat-by-chats-metrics';
import { mergeJoinedSkillsFields, mergeJoinedSkillsFromRawForMergedIds } from './chat-joined-skills';

const CHAT_BLOB_PREFIX = 'chat-analysis';
const DELAY_BLOB_PREFIX = 'delay-time';

/**
 * Save daily chat analysis data to blob storage
 */
export async function saveDailyChatAnalysisData(data: ChatAnalysisData): Promise<void> {
  // Save with date-specific filename
  const dateBlobName = `${CHAT_BLOB_PREFIX}/daily/${data.analysisDate}.json`;
  
  // Delete existing blob if it exists, then save new one
  try {
    const { blobs } = await list({ prefix: dateBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch (error) {
    // Ignore errors if blob doesn't exist
  }
  
  await put(dateBlobName, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
  
  // Also save as latest for dashboard
  const latestBlobName = `${CHAT_BLOB_PREFIX}/latest.json`;
  
  try {
    const { blobs } = await list({ prefix: latestBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch (error) {
    // Ignore errors if blob doesn't exist
  }
  
  await put(latestBlobName, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
}

/**
 * Get the latest chat analysis data from blob storage
 */
export async function getLatestChatAnalysisData(): Promise<ChatAnalysisData | null> {
  try {
    // List blobs to find the latest.json file
    const { blobs } = await list({
      prefix: 'chat-analysis/latest.json',
    });
    
    if (blobs.length === 0) {
      console.log('[Chat Storage] No latest chat analysis data found');
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    
    if (!response.ok) {
      console.error('[Chat Storage] Failed to fetch latest data:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data as ChatAnalysisData;
  } catch (error) {
    console.error('[Chat Storage] Error fetching latest chat analysis data:', error);
    return null;
  }
}

/**
 * Get daily chat analysis data for a specific date
 */
export async function getDailyChatAnalysisData(date: string): Promise<ChatAnalysisData | null> {
  try {
    // List blobs to find the exact URL
    const { blobs } = await list({
      prefix: `chat-analysis/daily/${date}.json`,
    });
    
    if (blobs.length === 0) {
      console.log(`[Chat Storage] No data found for date: ${date}`);
      return null;
    }
    
    // Fetch from the blob URL
    const response = await fetch(blobs[0].url);
    
    if (!response.ok) {
      console.error(`[Chat Storage] Failed to fetch data for ${date}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    return data as ChatAnalysisData;
  } catch (error) {
    console.error(`[Chat Storage] Error fetching chat analysis data for ${date}:`, error);
    return null;
  }
}

/**
 * Get historical trend data for the dashboard (last 30 days)
 */
export async function getChatTrendData(endDate: string, days?: number): Promise<ChatTrendData[]> {
  const trendData: ChatTrendData[] = [];
  const end = new Date(endDate);
  
  // Calculate start date: 1st of current month (max)
  const firstOfMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const startDate = firstOfMonth;
  
  // Calculate actual days to fetch (inclusive of both start and end dates)
  const diffMs = end.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const daysFromFirstOfMonth = diffDays + 1; // +1 to include both start and end dates
  
  const actualDays = days 
    ? Math.min(days, daysFromFirstOfMonth)
    : daysFromFirstOfMonth;
  
  for (let i = actualDays - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayData = await getDailyChatAnalysisData(dateStr);
    if (dayData) {
      trendData.push({
        date: dateStr,
        frustrationPercentage: dayData.overallMetrics.frustrationPercentage,
        confusionPercentage: dayData.overallMetrics.confusionPercentage,
        frustratedCount: dayData.overallMetrics.frustratedCount,
        confusedCount: dayData.overallMetrics.confusedCount,
        totalPeople: dayData.overallMetrics.totalConversations,
      });
    }
  }
  
  return trendData;
}

/**
 * Process and aggregate individual conversation scores into daily dashboard data
 */
export async function aggregateDailyChatAnalysisResults(
  conversations: Array<{
    conversationId: string;
    frustrated: boolean; // Is customer frustrated?
    confused: boolean; // Is customer confused?
    mainIssues: string[];
    keyPhrases: string[];
    chatStartDateTime?: string;
    service?: string;
    skill?: string;
    clientId?: string;
    maidId?: string;
    contractId?: string;
    joinedSkills?: string;
  }>,
  analysisDate: string
): Promise<ChatAnalysisData> {
  if (conversations.length === 0) {
    return createEmptyChatAnalysisData(analysisDate);
  }

  const byChatsView = computeByChatsViewMetrics(
    conversations.map((c) => ({
      conversationId: c.conversationId,
      frustrated: c.frustrated,
      confused: c.confused,
      joinedSkills: c.joinedSkills,
    }))
  );

  console.log(`[Chat Storage] Starting aggregation of ${conversations.length} conversations`);

  // Step 0: First merge by conversation ID (if same conversation ID appears, merge regardless of entity)
  // This handles cases where the same conversation ID appears with different contract/client/maid IDs
  const conversationIdMap = new Map<string, typeof conversations[0] & { mergedConversationIds: Set<string> }>();
  
  for (const conv of conversations) {
    const convId = conv.conversationId;
    const convIds = convId.split(',').map(id => id.trim()).filter(Boolean);
    
    // Check if any of these conversation IDs already exist
    let mergeKey: string | null = null;
    for (const id of convIds) {
      // Check if this conversation ID already exists in any merged entity
      for (const [key, existing] of conversationIdMap.entries()) {
        const existingIds = Array.from(existing.mergedConversationIds || [existing.conversationId]);
        if (existingIds.includes(id)) {
          mergeKey = key;
          break;
        }
      }
      if (mergeKey) break;
    }
    
    if (mergeKey && conversationIdMap.has(mergeKey)) {
      // Merge with existing conversation
      const existing = conversationIdMap.get(mergeKey)!;
      
      // Merge conversation IDs
      const existingConvIds = existing.mergedConversationIds || new Set<string>();
      convIds.forEach(id => existingConvIds.add(id));
      existing.mergedConversationIds = existingConvIds;
      
      // Merge issues and phrases
      const mergedIssues = new Set([...(existing.mainIssues || []), ...(conv.mainIssues || [])]);
      const mergedPhrases = new Set([...(existing.keyPhrases || []), ...(conv.keyPhrases || [])]);
      existing.mainIssues = Array.from(mergedIssues);
      existing.keyPhrases = Array.from(mergedPhrases);
      
      // Preserve flags
      existing.frustrated = existing.frustrated || conv.frustrated;
      existing.confused = existing.confused || conv.confused;
      
      // Keep earliest timestamp
      const existingTime = existing.chatStartDateTime ? new Date(existing.chatStartDateTime).getTime() : Infinity;
      const newTime = conv.chatStartDateTime ? new Date(conv.chatStartDateTime).getTime() : Infinity;
      if (newTime < existingTime && conv.chatStartDateTime) {
        existing.chatStartDateTime = conv.chatStartDateTime;
      }
      
      // Merge entity IDs (keep all contract/client/maid IDs)
      if (conv.contractId && !existing.contractId) existing.contractId = conv.contractId;
      if (conv.clientId && !existing.clientId) existing.clientId = conv.clientId;
      if (conv.maidId && !existing.maidId) existing.maidId = conv.maidId;
      if (conv.service && !existing.service) existing.service = conv.service;
      if (conv.skill && !existing.skill) existing.skill = conv.skill;
      existing.joinedSkills = mergeJoinedSkillsFields(existing.joinedSkills, conv.joinedSkills);
      
    } else {
      // New conversation - use first conversation ID as key
      const newConvIds = new Set(convIds);
      conversationIdMap.set(convIds[0], {
        ...conv,
        mergedConversationIds: newConvIds,
      });
    }
  }
  
  const mergedByConversationId = Array.from(conversationIdMap.values());
  console.log(`[Chat Storage] Merged by conversation ID: ${conversations.length} → ${mergedByConversationId.length} conversations`);

  // Step 1: Merge conversations by entity (contract > client > maid > conversation)
  // This merges messages, conversation IDs, and other fields for the same entity
  const entityMap = new Map<string, typeof conversations[0] & { mergedConversationIds: Set<string> }>();
  
  for (const conv of mergedByConversationId) {
    const clientId = conv.clientId;
    const maidId = conv.maidId;
    const contractId = conv.contractId;
    const convIds = Array.from(conv.mergedConversationIds || [conv.conversationId]);
    
    // Determine entity key (priority: contract > client > maid > conversation)
    let entityKey = '';
    if (contractId) {
      entityKey = `contract_${contractId}`;
    } else if (clientId) {
      entityKey = `client_${clientId}`;
    } else if (maidId) {
      entityKey = `maid_${maidId}`;
    } else if (convIds.length > 0) {
      // Use the first conversation ID for entity key
      entityKey = `conv_${convIds[0]}`;
    } else {
      entityKey = `unknown_${Date.now()}_${Math.random()}`;
    }
    
    // If entity already exists, merge the conversations
    if (entityMap.has(entityKey)) {
      const existing = entityMap.get(entityKey)!;
      
      // Merge conversation IDs (already merged in Step 0, just combine sets)
      const existingConvIds = existing.mergedConversationIds || new Set<string>();
      convIds.forEach(id => existingConvIds.add(id));
      existing.mergedConversationIds = existingConvIds;
      
      // Merge mainIssues (combine unique issues)
      const existingIssues = new Set(existing.mainIssues || []);
      (conv.mainIssues || []).forEach(issue => existingIssues.add(issue));
      existing.mainIssues = Array.from(existingIssues);
      
      // Merge keyPhrases (combine unique phrases)
      const existingPhrases = new Set(existing.keyPhrases || []);
      (conv.keyPhrases || []).forEach(phrase => existingPhrases.add(phrase));
      existing.keyPhrases = Array.from(existingPhrases);
      
      // Keep earliest chat start time
      const existingTime = existing.chatStartDateTime ? new Date(existing.chatStartDateTime).getTime() : Infinity;
      const newTime = conv.chatStartDateTime ? new Date(conv.chatStartDateTime).getTime() : Infinity;
      if (newTime < existingTime && conv.chatStartDateTime) {
        existing.chatStartDateTime = conv.chatStartDateTime;
      }
      
      // Preserve frustrated/confused flags (if either has it, keep it)
      existing.frustrated = existing.frustrated || conv.frustrated;
      existing.confused = existing.confused || conv.confused;
      
      // Keep the service/skill if missing
      if (!existing.service && conv.service) existing.service = conv.service;
      if (!existing.skill && conv.skill) existing.skill = conv.skill;
      
      // Fill in any missing IDs
      if (!existing.clientId && conv.clientId) existing.clientId = conv.clientId;
      if (!existing.maidId && conv.maidId) existing.maidId = conv.maidId;
      if (!existing.contractId && conv.contractId) existing.contractId = conv.contractId;
      existing.joinedSkills = mergeJoinedSkillsFields(existing.joinedSkills, conv.joinedSkills);
      
    } else {
      // New entity - add to map (use already merged conversation IDs from Step 0)
      entityMap.set(entityKey, {
        ...conv,
        mergedConversationIds: new Set(convIds),
      });
    }
  }
  
  let mergedByEntity = Array.from(entityMap.values());
  console.log(`[Chat Storage] Merged by entity: ${conversations.length} → ${mergedByEntity.length} unique entities`);

  // Step 1.5: Merge conversations that share conversation IDs or phrases (for conversations without entity IDs)
  // This handles cases where the same conversation appears with different conversation IDs
  const phraseBasedMergeMap = new Map<string, typeof mergedByEntity[0]>();
  const conversationIdIndex = new Map<string, string>(); // conversationId -> mergeKey
  
  for (const entity of mergedByEntity) {
    // If entity has contract/client/maid ID, keep as-is (already properly merged)
    if (entity.contractId || entity.clientId || entity.maidId) {
      const entityKey = entity.contractId 
        ? `contract_${entity.contractId}`
        : entity.clientId 
        ? `client_${entity.clientId}`
        : `maid_${entity.maidId}`;
      phraseBasedMergeMap.set(entityKey, entity);
      // Index conversation IDs for this entity
      const convIds = Array.from(entity.mergedConversationIds || [entity.conversationId]);
      convIds.forEach(id => conversationIdIndex.set(id, entityKey));
      continue;
    }
    
    // For conversations without entity IDs, check if they share conversation IDs or phrases
    const convIds = Array.from(entity.mergedConversationIds || [entity.conversationId]);
    let mergeKey: string | null = null;
    
    // Check if any conversation ID already exists in another entity
    for (const convId of convIds) {
      if (conversationIdIndex.has(convId)) {
        mergeKey = conversationIdIndex.get(convId)!;
        break;
      }
    }
    
    // If no shared conversation ID, check for shared phrases
    if (!mergeKey && entity.keyPhrases && entity.keyPhrases.length > 0) {
      // Create a phrase-based key from sorted phrases (normalized)
      const phraseKey = entity.keyPhrases
        .map(p => p.trim().toLowerCase())
        .sort()
        .join('|')
        .substring(0, 200); // Limit length
      
      // Check if any existing entity (without entity IDs) has matching phrases
      for (const [key, existing] of phraseBasedMergeMap.entries()) {
        if (key.startsWith('phrase_') && existing.keyPhrases && existing.keyPhrases.length > 0) {
          const existingPhraseKey = existing.keyPhrases
            .map(p => p.trim().toLowerCase())
            .sort()
            .join('|')
            .substring(0, 200);
          
          // If phrases match (exact match)
          if (phraseKey === existingPhraseKey && phraseKey.length > 0) {
            mergeKey = key;
            break;
          }
        }
      }
      
      // If no matching phrases found, create new phrase-based key
      if (!mergeKey && phraseKey.length > 0) {
        mergeKey = `phrase_${phraseKey}`;
      }
    }
    
    // If no merge key found, use conversation ID as fallback
    if (!mergeKey) {
      mergeKey = `conv_${convIds[0]}`;
    }
    
    // Merge with existing or create new
    if (phraseBasedMergeMap.has(mergeKey)) {
      const existing = phraseBasedMergeMap.get(mergeKey)!;
      
      // Merge conversation IDs
      const existingConvIds = existing.mergedConversationIds || new Set<string>();
      convIds.forEach(id => existingConvIds.add(id));
      existing.mergedConversationIds = existingConvIds;
      
      // Merge phrases and issues
      const mergedPhrases = new Set([...(existing.keyPhrases || []), ...(entity.keyPhrases || [])]);
      const mergedIssues = new Set([...(existing.mainIssues || []), ...(entity.mainIssues || [])]);
      existing.keyPhrases = Array.from(mergedPhrases);
      existing.mainIssues = Array.from(mergedIssues);
      
      // Preserve flags
      existing.frustrated = existing.frustrated || entity.frustrated;
      existing.confused = existing.confused || entity.confused;
      existing.joinedSkills = mergeJoinedSkillsFields(existing.joinedSkills, entity.joinedSkills);
      
      // Update conversation ID index
      convIds.forEach(id => conversationIdIndex.set(id, mergeKey!));
    } else {
      // New entity
      phraseBasedMergeMap.set(mergeKey, entity);
      convIds.forEach(id => conversationIdIndex.set(id, mergeKey!));
    }
  }
  
  mergedByEntity = Array.from(phraseBasedMergeMap.values());
  console.log(`[Chat Storage] Merged by conversation IDs/phrases: ${mergedByEntity.length} unique entities`);

  // Step 2: Expand merged conversation IDs into individual conversation entries
  // This handles cases where conversationId = "CH123,CH456,CH789" after entity merging
  const expandedConversations: Array<typeof conversations[0] & { originalConversationId: string }> = [];
  mergedByEntity.forEach(entity => {
    const conversationIds = Array.from(entity.mergedConversationIds || [entity.conversationId]);
    
    conversationIds.forEach(convId => {
      expandedConversations.push({
        conversationId: convId,
        frustrated: entity.frustrated,
        confused: entity.confused,
        mainIssues: entity.mainIssues || [],
        keyPhrases: entity.keyPhrases || [],
        chatStartDateTime: entity.chatStartDateTime,
        service: entity.service,
        skill: entity.skill,
        joinedSkills: entity.joinedSkills,
        clientId: entity.clientId,
        maidId: entity.maidId,
        contractId: entity.contractId,
        originalConversationId: Array.from(entity.mergedConversationIds || []).join(','), // Keep original for reference
      });
    });
  });
  
  console.log(`[Chat Storage] Expanded ${mergedByEntity.length} entities into ${expandedConversations.length} conversation entries`);

  // Step 3: Deduplicate by individual conversationId (in case same conversation ID appears in different entities)
  const conversationMap = new Map<string, typeof expandedConversations[0]>();
  let duplicateCount = 0;
  let flagMismatchCount = 0;
  
  expandedConversations.forEach(conv => {
    const existing = conversationMap.get(conv.conversationId);
    if (!existing) {
      conversationMap.set(conv.conversationId, conv);
    } else {
      duplicateCount++;
      
      // Check for flag mismatches
      if (existing.frustrated !== conv.frustrated || existing.confused !== conv.confused) {
        flagMismatchCount++;
        console.log(`[Chat Storage] Found duplicate conversationId ${conv.conversationId} with different flags:`, {
          existing: { frustrated: existing.frustrated, confused: existing.confused, originalId: existing.originalConversationId },
          current: { frustrated: conv.frustrated, confused: conv.confused, originalId: conv.originalConversationId },
        });
      }
      
      // Merge duplicates: preserve frustrated/confused flags (if either has it, keep it)
      // Merge issues and phrases, keep the one with more data
      const existingDataScore = (existing.mainIssues?.length || 0) + (existing.keyPhrases?.length || 0);
      const currentDataScore = (conv.mainIssues?.length || 0) + (conv.keyPhrases?.length || 0);
      
      // Always preserve frustrated/confused flags - if either duplicate has it, keep it
      const mergedFrustrated = existing.frustrated || conv.frustrated;
      const mergedConfused = existing.confused || conv.confused;
      
      // Merge issues and phrases
      const mergedIssues = new Set([...(existing.mainIssues || []), ...(conv.mainIssues || [])]);
      const mergedPhrases = new Set([...(existing.keyPhrases || []), ...(conv.keyPhrases || [])]);
      
      // Keep the one with more data, but merge the flags and data
      const mergedJoined = mergeJoinedSkillsFields(existing.joinedSkills, conv.joinedSkills);
      if (currentDataScore > existingDataScore) {
        conversationMap.set(conv.conversationId, {
          ...conv,
          frustrated: mergedFrustrated,
          confused: mergedConfused,
          mainIssues: Array.from(mergedIssues),
          keyPhrases: Array.from(mergedPhrases),
          joinedSkills: mergedJoined,
        });
      } else {
        // Keep existing but update flags and merge data
        conversationMap.set(conv.conversationId, {
          ...existing,
          frustrated: mergedFrustrated,
          confused: mergedConfused,
          mainIssues: Array.from(mergedIssues),
          keyPhrases: Array.from(mergedPhrases),
          joinedSkills: mergedJoined,
        });
      }
    }
  });
  
  const deduplicatedConversations = Array.from(conversationMap.values()).map(({ originalConversationId, ...rest }) => rest);
  
  // Log deduplication results
  if (duplicateCount > 0) {
    console.log(`[Chat Storage] Final deduplication: ${expandedConversations.length} expanded → ${deduplicatedConversations.length} unique conversations (removed ${duplicateCount} duplicates, ${flagMismatchCount} with flag mismatches)`);
  }
  
  // Step 3.5: Merge conversations with same entity and content (for conversationResults)
  // This prevents duplicate entries in the UI when multiple conversation IDs belong to same entity
  const contentMergeMap = new Map<string, typeof deduplicatedConversations[0] & { allConversationIds: string[] }>();
  
  for (const conv of deduplicatedConversations) {
    // Create a content key based on entity + content
    const entityKey = conv.contractId 
      ? `contract_${conv.contractId}`
      : conv.clientId 
      ? `client_${conv.clientId}`
      : conv.maidId 
      ? `maid_${conv.maidId}`
      : `conv_${conv.conversationId}`;
    
    // Normalize timestamp to minute precision
    let timestampKey = '';
    if (conv.chatStartDateTime) {
      const date = new Date(conv.chatStartDateTime);
      timestampKey = date.toISOString().split('T')[0] + '_' + 
                    String(date.getUTCHours()).padStart(2, '0') + ':' + 
                    String(date.getUTCMinutes()).padStart(2, '0');
    }
    
    // Create content hash
    const issuesStr = (conv.mainIssues || []).map(i => i.trim().toLowerCase()).sort().join('|');
    const phrasesStr = (conv.keyPhrases || []).map(p => p.trim().toLowerCase()).sort().join('|');
    const contentHash = `${issuesStr}_${phrasesStr}`.substring(0, 100);
    
    const contentKey = `${entityKey}_${timestampKey}_${conv.service || ''}_${conv.skill || ''}_${contentHash}`.replace(/[^a-zA-Z0-9_]/g, '_');
    
    if (contentMergeMap.has(contentKey)) {
      // Merge - add conversation ID to the list
      const existing = contentMergeMap.get(contentKey)!;
      if (!existing.allConversationIds.includes(conv.conversationId)) {
        existing.allConversationIds.push(conv.conversationId);
      }
      // Preserve flags
      existing.frustrated = existing.frustrated || conv.frustrated;
      existing.confused = existing.confused || conv.confused;
      existing.joinedSkills = mergeJoinedSkillsFields(existing.joinedSkills, conv.joinedSkills);
    } else {
      // New entry
      contentMergeMap.set(contentKey, {
        ...conv,
        allConversationIds: [conv.conversationId],
      });
    }
  }
  
  // Use the merged conversations for creating conversationResults (but keep original for person grouping)
  const mergedForResults = Array.from(contentMergeMap.values()).map(({ allConversationIds, ...rest }) => ({
    ...rest,
    conversationId: allConversationIds.join(','), // Store all IDs as comma-separated
  }));
  
  console.log(`[Chat Storage] Content merge for results: ${deduplicatedConversations.length} → ${mergedForResults.length} unique conversation entries`);
  
  // Step 4: Group deduplicated conversations by person (contract > client > maid > conversation)
  // This is for calculating frustration/confusion percentages
  const personMap = new Map<string, {
    personId: string;
    personType: 'client' | 'maid' | 'unknown';
    frustrated: boolean;
    confused: boolean;
    conversationIds: string[];
  }>();
  
  deduplicatedConversations.forEach(conv => {
    // Determine the person key and type using same priority as entity merging
    let personKey: string;
    let personType: 'client' | 'maid' | 'unknown';
    
    if (conv.contractId) {
      personKey = `contract_${conv.contractId}`;
      personType = 'client'; // Contracts are associated with clients
    } else if (conv.clientId) {
      personKey = `client_${conv.clientId}`;
      personType = 'client';
    } else if (conv.maidId) {
      personKey = `maid_${conv.maidId}`;
      personType = 'maid';
    } else {
      // Fallback to conversationId
      personKey = `conv_${conv.conversationId}`;
      personType = 'unknown';
    }
    
    if (!personMap.has(personKey)) {
      personMap.set(personKey, {
        personId: personKey,
        personType,
        frustrated: conv.frustrated,
        confused: conv.confused,
        conversationIds: [conv.conversationId]
      });
    } else {
      const existing = personMap.get(personKey)!;
      // If any conversation for this person is frustrated/confused, mark person as such
      existing.frustrated = existing.frustrated || conv.frustrated;
      existing.confused = existing.confused || conv.confused;
      if (!existing.conversationIds.includes(conv.conversationId)) {
        existing.conversationIds.push(conv.conversationId);
      }
    }
  });

  const uniquePeople = Array.from(personMap.values());
  const totalPeople = uniquePeople.length;
  
  // Log person identification results
  const clientCount = uniquePeople.filter(p => p.personType === 'client').length;
  const maidCount = uniquePeople.filter(p => p.personType === 'maid').length;
  const unknownCount = uniquePeople.filter(p => p.personType === 'unknown').length;
  console.log(`[Chat Storage] Person identification: ${clientCount} clients, ${maidCount} maids, ${unknownCount} unknown (${totalPeople} total people)`);
  
  // Log people with multiple conversations
  const multipleConversations = uniquePeople.filter(p => p.conversationIds.length > 1);
  if (multipleConversations.length > 0) {
    console.log(`[Chat Storage] ${multipleConversations.length} people have multiple conversations`);
  }

  // Calculate frustration as count and percentage based on unique people
  const frustratedPeopleCount = uniquePeople.filter(person => person.frustrated).length;
  const frustrationPercentage = totalPeople > 0 
    ? Math.round((frustratedPeopleCount / totalPeople) * 100)
    : 0;
  
  // Calculate confusion as count and percentage based on unique people
  const confusedPeopleCount = uniquePeople.filter(person => person.confused).length;
  const confusionPercentage = totalPeople > 0 
    ? Math.round((confusedPeopleCount / totalPeople) * 100)
    : 0;

  // Convert merged conversations to ChatAnalysisResult format for storage
  // Use mergedForResults to avoid duplicate entries in UI for same entity/content
  const results: ChatAnalysisResult[] = mergedForResults.map((conv) => {
    const fromRawIngest = mergeJoinedSkillsFromRawForMergedIds(conv.conversationId, conversations);
    const joinedSkillsMerged = mergeJoinedSkillsFields(conv.joinedSkills, fromRawIngest).trim();
    return {
      conversationId: conv.conversationId, // Already contains comma-separated IDs if merged
      frustrated: conv.frustrated,
      confused: conv.confused,
      mainIssues: conv.mainIssues,
      keyPhrases: conv.keyPhrases,
      analysisDate: conv.chatStartDateTime || new Date().toISOString(),
      service: conv.service,
      skill: conv.skill,
      ...(joinedSkillsMerged ? { joinedSkills: joinedSkillsMerged } : {}),
    };
  });
  
  // Log first result to verify service/skill are preserved
  if (results.length > 0) {
    console.log('[Chat Storage] Sample result after mapping:', {
      conversationId: results[0].conversationId,
      service: results[0].service,
      skill: results[0].skill,
    });
  }

  // Get historical trend data for the last 30 days
  const trendData = await getChatTrendData(analysisDate, 30);

  // Calculate previous day scores for trend comparison
  const previousDay = new Date(analysisDate);
  previousDay.setDate(previousDay.getDate() - 1);
  const previousDayData = await getDailyChatAnalysisData(previousDay.toISOString().split('T')[0]);
  
  const previousFrustration = previousDayData?.overallMetrics.frustrationPercentage || frustrationPercentage;
  const previousConfusion = previousDayData?.overallMetrics.confusionPercentage || confusionPercentage;

  // Analyze drivers from all conversations
  const frustrationDrivers = analyzeFrustrationDrivers(results);
  const confusionDrivers = analyzeConfusionDrivers(results);

  return {
    lastUpdated: new Date().toISOString(),
    analysisDate,
    overallMetrics: {
      frustratedCount: frustratedPeopleCount,
      frustrationPercentage,
      confusedCount: confusedPeopleCount,
      confusionPercentage,
      totalConversations: totalPeople, // Now represents total unique people (clients + maids)
      analysedConversations: totalPeople, // Now represents analyzed unique people
    },
    trends: {
      frustration: {
        current: frustrationPercentage,
        previous: previousFrustration,
        direction: frustrationPercentage > previousFrustration ? 'increasing' : 
                  frustrationPercentage < previousFrustration ? 'decreasing' : 'stable',
      },
      confusion: {
        current: confusionPercentage,
        previous: previousConfusion,
        direction: confusionPercentage > previousConfusion ? 'increasing' : 
                  confusionPercentage < previousConfusion ? 'decreasing' : 'stable',
      },
    },
    trendData,
    insights: {
      frustration: {
        mainIssue: identifyMainFrustrationIssue(frustrationDrivers),
        topDrivers: frustrationDrivers.slice(0, 4),
      },
      confusion: {
        mainIssue: identifyMainConfusionIssue(confusionDrivers),
        topDrivers: confusionDrivers.slice(0, 4),
      },
    },
    conversationResults: results,
    byChatsView,
  };
}

/**
 * Create empty chat analysis data structure
 */
function createEmptyChatAnalysisData(analysisDate: string): ChatAnalysisData {
  return {
    lastUpdated: new Date().toISOString(),
    analysisDate,
    byChatsView: createEmptyByChatsViewMetrics(),
    overallMetrics: {
      frustratedCount: 0,
      frustrationPercentage: 0,
      confusedCount: 0,
      confusionPercentage: 0,
      totalConversations: 0,
      analysedConversations: 0,
    },
    trends: {
      frustration: {
        current: 0,
        previous: 0,
        direction: 'stable',
      },
      confusion: {
        current: 0,
        previous: 0,
        direction: 'stable',
      },
    },
    trendData: [],
    insights: {
      frustration: {
        mainIssue: {
          title: 'No Data Available',
          description: 'No conversation data has been analyzed yet.',
          impact: 0,
          trending: 'stable',
        },
        topDrivers: [],
      },
      confusion: {
        mainIssue: {
          title: 'No Data Available',
          description: 'No conversation data has been analyzed yet.',
          impact: 0,
          trending: 'stable',
        },
        topDrivers: [],
      },
    },
    conversationResults: [],
  };
}


/**
 * Analyze frustration drivers from conversation results
 */
function analyzeFrustrationDrivers(results: ChatAnalysisResult[]): ChatDriver[] {
  const issueMap = new Map<string, { count: number, frustratedCount: number }>();
  
  // Only analyze frustrated conversations
  const frustratedResults = results.filter(r => r.frustrated);
  
  if (frustratedResults.length === 0) return [];
  
  frustratedResults.forEach(result => {
    result.mainIssues.forEach(issue => {
      const current = issueMap.get(issue) || { count: 0, frustratedCount: 0 };
      issueMap.set(issue, {
        count: current.count + 1,
        frustratedCount: current.frustratedCount + 1,
      });
    });
  });
  
  return Array.from(issueMap.entries())
    .map(([issue, data]) => ({
      issue,
      impact: Math.round((data.count / frustratedResults.length) * 100),
      frequency: data.count,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Analyze confusion drivers from conversation results
 */
function analyzeConfusionDrivers(results: ChatAnalysisResult[]): ChatDriver[] {
  const issueMap = new Map<string, { count: number, confusedCount: number }>();
  
  // Only analyze confused conversations
  const confusedResults = results.filter(r => r.confused);
  
  if (confusedResults.length === 0) return [];
  
  confusedResults.forEach(result => {
    result.mainIssues.forEach(issue => {
      const current = issueMap.get(issue) || { count: 0, confusedCount: 0 };
      issueMap.set(issue, {
        count: current.count + 1,
        confusedCount: current.confusedCount + 1,
      });
    });
  });
  
  return Array.from(issueMap.entries())
    .map(([issue, data]) => ({
      issue,
      impact: Math.round((data.count / confusedResults.length) * 100),
      frequency: data.count,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Identify the main frustration issue
 */
function identifyMainFrustrationIssue(drivers: ChatDriver[]): ChatInsight {
  if (drivers.length === 0) {
    return {
      title: 'No Issues Identified',
      description: 'No frustration patterns have been detected in the analyzed conversations.',
      impact: 0,
      trending: 'stable',
    };
  }
  
  const topDriver = drivers[0];
  return {
    title: topDriver.issue,
    description: `This issue appears in ${topDriver.frequency} conversations and has a ${topDriver.impact}% impact on overall frustration levels.`,
    impact: topDriver.impact,
    trending: 'up', // This would be calculated from historical data in a real implementation
  };
}

/**
 * Identify the main confusion issue
 */
function identifyMainConfusionIssue(drivers: ChatDriver[]): ChatInsight {
  if (drivers.length === 0) {
    return {
      title: 'No Issues Identified',
      description: 'No confusion patterns have been detected in the analyzed conversations.',
      impact: 0,
      trending: 'stable',
    };
  }
  
  const topDriver = drivers[0];
  return {
    title: topDriver.issue,
    description: `This issue appears in ${topDriver.frequency} conversations and has a ${topDriver.impact}% impact on overall confusion levels.`,
    impact: topDriver.impact,
    trending: 'up', // This would be calculated from historical data in a real implementation
  };
}

/**
 * Clear all chat analysis data from blob storage
 */
export async function clearChatAnalysisData(): Promise<void> {
  try {
    const { blobs } = await list({ prefix: CHAT_BLOB_PREFIX });
    
    for (const blob of blobs) {
      await del(blob.url);
    }
  } catch (error) {
    console.error('Error clearing chat analysis data:', error);
    throw error;
  }
}

// ============================================================
// DELAY TIME FUNCTIONS
// ============================================================

/**
 * Parse delay time from DD:HH:MM:SS format to seconds
 */
function parseDelayToSeconds(delayStr: string): number {
  const parts = delayStr.split(':').map(Number);
  
  if (parts.length === 4) {
    const [days, hours, minutes, seconds] = parts;
    return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
  }
  
  return 0;
}

/**
 * Parse response time from HH:MM:SS format to seconds
 */
function parseResponseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  
  return 0;
}

/**
 * Format seconds to HH:MM:SS
 */
function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate median from array of numbers
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  return sorted[mid];
}

/**
 * Process and aggregate delay time records (legacy format)
 */
export function processDelayTimeRecords(
  records: AgentDelayRecord[],
  analysisDate: string
): DelayTimeData {
  if (records.length === 0) {
    return {
      lastUpdated: new Date().toISOString(),
      analysisDate,
      agentStats: [],
    };
  }

  // Group by agent
  const agentMap = new Map<string, { delays: number[], noReplyCount: number }>();
  const allDelays: number[] = [];

  records.forEach(record => {
    const delaySeconds = parseDelayToSeconds(record.avgDelayDdHhMmSs);
    allDelays.push(delaySeconds);

    if (!agentMap.has(record.agentFullName)) {
      agentMap.set(record.agentFullName, { delays: [], noReplyCount: 0 });
    }

    const agentData = agentMap.get(record.agentFullName)!;
    agentData.delays.push(delaySeconds);
    
    if (record.endedWithConsumerNoReply.toLowerCase() === 'yes') {
      agentData.noReplyCount++;
    }
  });

  // Calculate per-agent stats
  const agentStats: AgentDelayStats[] = Array.from(agentMap.entries())
    .map(([agentName, data]) => {
      const avgDelaySeconds = Math.round(
        data.delays.reduce((sum, d) => sum + d, 0) / data.delays.length
      );
      
      return {
        agentName,
        avgDelaySeconds,
        avgDelayFormatted: formatSecondsToTime(avgDelaySeconds),
      };
    })
    .sort((a, b) => b.avgDelaySeconds - a.avgDelaySeconds); // Sort by slowest first

  return {
    lastUpdated: new Date().toISOString(),
    analysisDate,
    agentStats,
  };
}

/**
 * Process per-agent response time records (new format)
 * Filters out "Total" entries as they represent daily average
 */
export function processAgentResponseTimeRecords(
  records: AgentResponseTimeRecord[],
  analysisDate: string
): DelayTimeData {
  if (records.length === 0) {
    return {
      lastUpdated: new Date().toISOString(),
      analysisDate,
      agentStats: [],
    };
  }

  // Extract daily average from "Total" entry
  const totalRecord = records.find(record => record.AGENT_FULL_NAME === 'Total');
  let dailyAverageDelaySeconds: number | undefined;
  let dailyAverageDelayFormatted: string | undefined;
  
  if (totalRecord) {
    dailyAverageDelaySeconds = parseResponseTimeToSeconds(totalRecord.AVG_ADJUSTED_RESPONSE_TIME);
    dailyAverageDelayFormatted = totalRecord.AVG_ADJUSTED_RESPONSE_TIME; // Already in HH:MM:SS format
  }

  // Filter out "Total" entries and process per-agent data
  const agentStats: AgentDelayStats[] = records
    .filter(record => record.AGENT_FULL_NAME !== 'Total')
    .map(record => {
      const delaySeconds = parseResponseTimeToSeconds(record.AVG_ADJUSTED_RESPONSE_TIME);
      
      return {
        agentName: record.AGENT_FULL_NAME,
        avgDelaySeconds: delaySeconds,
        avgDelayFormatted: record.AVG_ADJUSTED_RESPONSE_TIME, // Already in HH:MM:SS format
      };
    })
    .sort((a, b) => a.avgDelaySeconds - b.avgDelaySeconds); // Sort by fastest first

  return {
    lastUpdated: new Date().toISOString(),
    analysisDate,
    dailyAverageDelaySeconds,
    dailyAverageDelayFormatted,
    agentStats,
  };
}

/**
 * Save delay time data to blob storage
 */
export async function saveDelayTimeData(data: DelayTimeData): Promise<void> {
  // Save with date-specific filename
  const dateBlobName = `${DELAY_BLOB_PREFIX}/daily/${data.analysisDate}.json`;
  
  // Delete existing blob if it exists, then save new one
  try {
    const { blobs } = await list({ prefix: dateBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch (error) {
    // Ignore errors if blob doesn't exist
  }
  
  await put(dateBlobName, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
  
  // Also save as latest for dashboard
  const latestBlobName = `${DELAY_BLOB_PREFIX}/latest.json`;
  
  try {
    const { blobs } = await list({ prefix: latestBlobName });
    if (blobs.length > 0) {
      await del(blobs[0].url);
    }
  } catch (error) {
    // Ignore errors if blob doesn't exist
  }
  
  await put(latestBlobName, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
  });
}

/**
 * Get the latest delay time data from blob storage
 */
export async function getLatestDelayTimeData(): Promise<DelayTimeData | null> {
  try {
    // List blobs to find the latest.json file
    const { blobs } = await list({
      prefix: 'delay-time/latest.json',
    });
    
    if (blobs.length === 0) {
      console.log('[Chat Storage] No latest delay time data found');
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    
    if (!response.ok) {
      console.error('[Chat Storage] Failed to fetch latest delay time:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data as DelayTimeData;
  } catch (error) {
    console.error('[Chat Storage] Error fetching latest delay time data:', error);
    return null;
  }
}

/**
 * Get delay time data for a specific date
 */
export async function getDailyDelayTimeData(date: string): Promise<DelayTimeData | null> {
  try {
    // List blobs to find the exact URL
    const { blobs } = await list({
      prefix: `delay-time/daily/${date}.json`,
    });
    
    if (blobs.length === 0) {
      console.log(`[Chat Storage] No delay time data found for date: ${date}`);
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    
    if (!response.ok) {
      console.error(`[Chat Storage] Failed to fetch delay time data for ${date}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    return data as DelayTimeData;
  } catch (error) {
    console.error(`[Chat Storage] Error fetching delay time data for ${date}:`, error);
    return null;
  }
}
