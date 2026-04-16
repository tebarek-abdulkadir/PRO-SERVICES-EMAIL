import { getAllComplaintsBeforeDate, filterProspectsWithoutPreviousComplaints } from '@/lib/complaints-conversion-service';
import { EMAIL_TRAVEL_REGIONS, resolveEmailTravelRegionKey } from '@/lib/email-travel-regions';
import { getServiceKeyFromComplaintType } from '@/lib/pnl-complaints-types';
import type { ByContractType, Conversions, Prospects } from '@/lib/types';
import { pauseBetweenComplaintBlobFetches } from '@/lib/email-blob-throttle';
import { getDailyData, getLatestRun, getProspectDetailsByDate, getProspectsGroupedByHousehold } from '@/lib/unified-storage';

const TRAVEL_COMPLAINT_SERVICE_KEYS = new Set([
  'ttl',
  'ttlSingle',
  'ttlDouble',
  'ttlMultiple',
  'tte',
  'tteSingle',
  'tteDouble',
  'tteMultiple',
  'ttj',
  'schengen',
  'gcc',
]);

type StoredProspectDetail = Awaited<ReturnType<typeof getProspectDetailsByDate>>[number];
type StoredHouseholdGroup = Awaited<ReturnType<typeof getProspectsGroupedByHousehold>>[number];

interface ComplaintRecord {
  creationDate?: string;
  complaintType?: string;
  contractId?: string;
  housemaidId?: string;
  clientId?: string;
}

export interface EnrichedProspectDetail extends StoredProspectDetail {
  hasComplaintOnDate: boolean;
  convertedServices: string[];
}

/** Unique conversion counts for the email service table: same prospect keys as dashboard conversions, CC/MV from household contract (matches by-contract-type prospects). */
export interface EmailSalesCcMvSplit {
  oec: { cc: number; mv: number };
  owwa: { cc: number; mv: number };
  filipinaPassportRenewal: { cc: number; mv: number };
  ethiopianPassportRenewal: { cc: number; mv: number };
  travel: Record<string, { cc: number; mv: number }>;
}

export interface DashboardProspectsData {
  date: string;
  fileName?: string;
  totalProcessed: number;
  totalConversations: number;
  isProcessing: boolean;
  prospects: Prospects & {
    details: EnrichedProspectDetail[];
  };
  conversions: Conversions;
  countryCounts: Record<string, number>;
  /** Travel-visa country counts split by household contract type (MV vs CC), same rules as `countryCounts` */
  countryCountsByContractType: { MV: Record<string, number>; CC: Record<string, number> };
  byContractType: ByContractType;
  /** Deduped sales (unique prospect keys) split CC/MV using household contract type — aligns with dashboard conversions + byContractType. */
  emailSalesCcMv: EmailSalesCcMvSplit;
  latestRun: Awaited<ReturnType<typeof getLatestRun>>;
  households: StoredHouseholdGroup[];
  prospectDetails: EnrichedProspectDetail[];
}

async function getComplaintsForDate(date: string): Promise<ComplaintRecord[]> {
  try {
    const { getAvailableDailyComplaintsDates, getDailyComplaints } = await import(
      '@/lib/daily-complaints-storage'
    );
    const datesResult = await getAvailableDailyComplaintsDates();

    if (!datesResult.success || !datesResult.dates || datesResult.dates.length === 0) {
      return [];
    }

    const allComplaintsResults = [];
    for (const complaintDate of datesResult.dates) {
      allComplaintsResults.push(await getDailyComplaints(complaintDate));
      await pauseBetweenComplaintBlobFetches();
    }

    return allComplaintsResults
      .filter((result) => result.success && result.data)
      .flatMap((result) => result.data?.complaints || [])
      .filter((complaint) => {
        if (!complaint.creationDate) {
          return false;
        }

        const complaintDate = complaint.creationDate.split(/[T ]/)[0];
        return complaintDate === date;
      });
  } catch (error) {
    console.error('Error fetching complaints for date:', error);
    return [];
  }
}

function enrichProspectsWithComplaintStatus(
  prospects: StoredProspectDetail[],
  complaints: ComplaintRecord[]
): EnrichedProspectDetail[] {
  return prospects.map((prospect) => {
    const matchingComplaints = complaints.filter((complaint) => {
      return (
        (prospect.contractId && complaint.contractId === prospect.contractId) ||
        (prospect.maidId && complaint.housemaidId === prospect.maidId) ||
        (prospect.clientId && complaint.clientId === prospect.clientId)
      );
    });

    const convertedServices: string[] = [];
    let hasComplaintOnDate = false;

    if (matchingComplaints.length > 0) {
      hasComplaintOnDate = true;

      for (const complaint of matchingComplaints) {
        if (!complaint.complaintType) {
          continue;
        }

        const serviceKey = getServiceKeyFromComplaintType(complaint.complaintType);

        if (serviceKey === 'oec' && prospect.isOECProspect && !convertedServices.includes('OEC')) {
          convertedServices.push('OEC');
        } else if (
          serviceKey === 'owwa' &&
          prospect.isOWWAProspect &&
          !convertedServices.includes('OWWA')
        ) {
          convertedServices.push('OWWA');
        } else if (
          serviceKey &&
          TRAVEL_COMPLAINT_SERVICE_KEYS.has(serviceKey) &&
          prospect.isTravelVisaProspect &&
          !convertedServices.includes('Travel Visa')
        ) {
          convertedServices.push('Travel Visa');
        } else if (
          serviceKey === 'filipinaPP' &&
          prospect.isFilipinaPassportRenewalProspect &&
          !convertedServices.includes('Filipina PP')
        ) {
          convertedServices.push('Filipina PP');
        } else if (
          serviceKey === 'ethiopianPP' &&
          prospect.isEthiopianPassportRenewalProspect &&
          !convertedServices.includes('Ethiopian PP')
        ) {
          convertedServices.push('Ethiopian PP');
        }
      }
    }

    return {
      ...prospect,
      hasComplaintOnDate,
      convertedServices,
    };
  });
}

async function calculateConversionsForDate(
  date: string,
  prospects: StoredProspectDetail[],
  preloadedComplaints?: ComplaintRecord[]
): Promise<Conversions> {
  if (prospects.length === 0) {
    return {
      oec: 0,
      owwa: 0,
      travelVisa: 0,
      filipinaPassportRenewal: 0,
      ethiopianPassportRenewal: 0,
    };
  }

  try {
    const complaints = preloadedComplaints ?? (await getComplaintsForDate(date));

    const conversions = {
      oec: new Set<string>(),
      owwa: new Set<string>(),
      travelVisa: new Set<string>(),
      filipinaPassportRenewal: new Set<string>(),
      ethiopianPassportRenewal: new Set<string>(),
    };

    for (const prospect of prospects) {
      const matchingComplaints = complaints.filter((complaint) => {
        return (
          (prospect.contractId && complaint.contractId === prospect.contractId) ||
          (prospect.maidId && complaint.housemaidId === prospect.maidId) ||
          (prospect.clientId && complaint.clientId === prospect.clientId)
        );
      });

      if (matchingComplaints.length === 0) {
        continue;
      }

      for (const complaint of matchingComplaints) {
        if (!complaint.complaintType) {
          continue;
        }

        const serviceKey = getServiceKeyFromComplaintType(complaint.complaintType);
        const prospectKey = prospect.contractId || prospect.maidId || prospect.clientId;

        if (!serviceKey || !prospectKey) {
          continue;
        }

        if (serviceKey === 'oec' && prospect.isOECProspect) {
          conversions.oec.add(prospectKey);
        } else if (serviceKey === 'owwa' && prospect.isOWWAProspect) {
          conversions.owwa.add(prospectKey);
        } else if (
          serviceKey &&
          TRAVEL_COMPLAINT_SERVICE_KEYS.has(serviceKey) &&
          prospect.isTravelVisaProspect
        ) {
          conversions.travelVisa.add(prospectKey);
        } else if (
          serviceKey === 'filipinaPP' &&
          prospect.isFilipinaPassportRenewalProspect
        ) {
          conversions.filipinaPassportRenewal.add(prospectKey);
        } else if (
          serviceKey === 'ethiopianPP' &&
          prospect.isEthiopianPassportRenewalProspect
        ) {
          conversions.ethiopianPassportRenewal.add(prospectKey);
        }
      }
    }

    return {
      oec: conversions.oec.size,
      owwa: conversions.owwa.size,
      travelVisa: conversions.travelVisa.size,
      filipinaPassportRenewal: conversions.filipinaPassportRenewal.size,
      ethiopianPassportRenewal: conversions.ethiopianPassportRenewal.size,
    };
  } catch (error) {
    console.error('Error calculating complaints-based conversions:', error);
    return {
      oec: 0,
      owwa: 0,
      travelVisa: 0,
      filipinaPassportRenewal: 0,
      ethiopianPassportRenewal: 0,
    };
  }
}

function householdMembersContractBucket(members: StoredProspectDetail[]): 'CC' | 'MV' | null {
  const contractType = members.find((m) => m.contractType)?.contractType || '';
  if (contractType === 'CC') return 'CC';
  if (contractType === 'MV') return 'MV';
  return null;
}

function computeEmailSalesCcMvSplit(
  prospects: StoredProspectDetail[],
  complaints: ComplaintRecord[],
  householdMap: Map<string, StoredProspectDetail[]>
): EmailSalesCcMvSplit {
  const oecCC = new Set<string>();
  const oecMV = new Set<string>();
  const owwaCC = new Set<string>();
  const owwaMV = new Set<string>();
  const filCC = new Set<string>();
  const filMV = new Set<string>();
  const ethCC = new Set<string>();
  const ethMV = new Set<string>();

  const travelSets: Record<string, { cc: Set<string>; mv: Set<string> }> = {};
  for (const { key } of EMAIL_TRAVEL_REGIONS) {
    travelSets[key] = { cc: new Set(), mv: new Set() };
  }

  for (const prospect of prospects) {
    const matchingComplaints = complaints.filter((complaint) => {
      return (
        (prospect.contractId && complaint.contractId === prospect.contractId) ||
        (prospect.maidId && complaint.housemaidId === prospect.maidId) ||
        (prospect.clientId && complaint.clientId === prospect.clientId)
      );
    });

    if (matchingComplaints.length === 0) {
      continue;
    }

    const prospectKey = prospect.contractId || prospect.maidId || prospect.clientId;
    if (!prospectKey) {
      continue;
    }

    const householdKey =
      prospect.contractId || `standalone_${prospect.maidId || prospect.clientId || 'unknown'}`;
    const members = householdMap.get(householdKey) || [];
    const bucket = householdMembersContractBucket(members);
    if (!bucket) {
      continue;
    }

    const addTo = (ccSet: Set<string>, mvSet: Set<string>) => {
      if (bucket === 'CC') {
        ccSet.add(prospectKey);
      } else {
        mvSet.add(prospectKey);
      }
    };

    for (const complaint of matchingComplaints) {
      if (!complaint.complaintType) {
        continue;
      }

      const serviceKey = getServiceKeyFromComplaintType(complaint.complaintType);

      if (serviceKey === 'oec' && prospect.isOECProspect) {
        addTo(oecCC, oecMV);
      } else if (serviceKey === 'owwa' && prospect.isOWWAProspect) {
        addTo(owwaCC, owwaMV);
      } else if (
        serviceKey &&
        TRAVEL_COMPLAINT_SERVICE_KEYS.has(serviceKey) &&
        prospect.isTravelVisaProspect
      ) {
        const region = resolveEmailTravelRegionKey(prospect.travelVisaCountries);
        const ts = region ? travelSets[region] : undefined;
        if (ts) {
          addTo(ts.cc, ts.mv);
        }
      } else if (serviceKey === 'filipinaPP' && prospect.isFilipinaPassportRenewalProspect) {
        addTo(filCC, filMV);
      } else if (serviceKey === 'ethiopianPP' && prospect.isEthiopianPassportRenewalProspect) {
        addTo(ethCC, ethMV);
      }
    }
  }

  const travel: EmailSalesCcMvSplit['travel'] = {};
  for (const { key } of EMAIL_TRAVEL_REGIONS) {
    const s = travelSets[key];
    travel[key] = { cc: s.cc.size, mv: s.mv.size };
  }

  return {
    oec: { cc: oecCC.size, mv: oecMV.size },
    owwa: { cc: owwaCC.size, mv: owwaMV.size },
    filipinaPassportRenewal: { cc: filCC.size, mv: filMV.size },
    ethiopianPassportRenewal: { cc: ethCC.size, mv: ethMV.size },
    travel,
  };
}

export async function getDashboardProspectsData(date: string): Promise<DashboardProspectsData> {
  const data = await getDailyData(date);

  if (!data) {
    throw new Error(`No prospect data found for date ${date}`);
  }

  const latestRun = await getLatestRun(date);
  const allProspects = await getProspectDetailsByDate(date);
  const households = await getProspectsGroupedByHousehold(date);
  const complaintsBeforeDate = await getAllComplaintsBeforeDate(date);
  const filteredProspects = filterProspectsWithoutPreviousComplaints(
    allProspects.map((prospect) => ({
      contractId: prospect.contractId,
      maidId: prospect.maidId,
      clientId: prospect.clientId,
    })),
    complaintsBeforeDate
  )
    .map((filtered) =>
      allProspects.find(
        (prospect) =>
          (prospect.contractId && prospect.contractId === filtered.contractId) ||
          (prospect.maidId && prospect.maidId === filtered.maidId) ||
          (prospect.clientId && prospect.clientId === filtered.clientId)
      )
    )
    .filter((prospect): prospect is StoredProspectDetail => prospect !== undefined);

  const complaintsOnDate = await getComplaintsForDate(date);
  const enrichedProspects = enrichProspectsWithComplaintStatus(filteredProspects, complaintsOnDate);

  const filteredProspectCounts: Prospects = {
    oec: filteredProspects.filter((prospect) => prospect.isOECProspect).length,
    owwa: filteredProspects.filter((prospect) => prospect.isOWWAProspect).length,
    travelVisa: filteredProspects.filter((prospect) => prospect.isTravelVisaProspect).length,
    filipinaPassportRenewal: filteredProspects.filter(
      (prospect) => prospect.isFilipinaPassportRenewalProspect
    ).length,
    ethiopianPassportRenewal: filteredProspects.filter(
      (prospect) => prospect.isEthiopianPassportRenewalProspect
    ).length,
  };

  const conversions = await calculateConversionsForDate(date, filteredProspects, complaintsOnDate);
  const byContractType: ByContractType = {
    CC: {
      oec: 0,
      owwa: 0,
      travelVisa: 0,
      filipinaPassportRenewal: 0,
      ethiopianPassportRenewal: 0,
    },
    MV: {
      oec: 0,
      owwa: 0,
      travelVisa: 0,
      filipinaPassportRenewal: 0,
      ethiopianPassportRenewal: 0,
    },
  };

  const householdMap = new Map<string, StoredProspectDetail[]>();
  for (const prospect of filteredProspects) {
    const householdKey = prospect.contractId || `standalone_${prospect.maidId || prospect.clientId || 'unknown'}`;
    if (!householdMap.has(householdKey)) {
      householdMap.set(householdKey, []);
    }

    householdMap.get(householdKey)?.push(prospect);
  }

  for (const [, members] of householdMap) {
    const contractType = members.find((member) => member.contractType)?.contractType || '';
    const hasOec = members.some((member) => member.isOECProspect);
    const hasOwwa = members.some((member) => member.isOWWAProspect);
    const hasTravelVisa = members.some((member) => member.isTravelVisaProspect);
    const hasFilipinaPassportRenewal = members.some(
      (member) => member.isFilipinaPassportRenewalProspect
    );
    const hasEthiopianPassportRenewal = members.some(
      (member) => member.isEthiopianPassportRenewalProspect
    );

    if (hasOec) {
      if (contractType === 'CC') {
        byContractType.CC.oec += 1;
      } else if (contractType === 'MV') {
        byContractType.MV.oec += 1;
      }
    }

    if (hasOwwa) {
      if (contractType === 'CC') {
        byContractType.CC.owwa += 1;
      } else if (contractType === 'MV') {
        byContractType.MV.owwa += 1;
      }
    }

    if (hasTravelVisa) {
      if (contractType === 'CC') {
        byContractType.CC.travelVisa += 1;
      } else if (contractType === 'MV') {
        byContractType.MV.travelVisa += 1;
      }
    }

    if (hasFilipinaPassportRenewal) {
      if (contractType === 'CC') {
        byContractType.CC.filipinaPassportRenewal += 1;
      } else if (contractType === 'MV') {
        byContractType.MV.filipinaPassportRenewal += 1;
      }
    }

    if (hasEthiopianPassportRenewal) {
      if (contractType === 'CC') {
        byContractType.CC.ethiopianPassportRenewal += 1;
      } else if (contractType === 'MV') {
        byContractType.MV.ethiopianPassportRenewal += 1;
      }
    }
  }

  const countryCounts: Record<string, number> = {};
  const countryCountsByContractType: { MV: Record<string, number>; CC: Record<string, number> } = {
    MV: {},
    CC: {},
  };

  for (const [, members] of householdMap) {
    const hasTravelVisa = members.some((member) => member.isTravelVisaProspect);

    if (!hasTravelVisa) {
      continue;
    }

    const householdCountries = new Set<string>();
    for (const member of members) {
      if (!member.isTravelVisaProspect) {
        continue;
      }

      for (const country of member.travelVisaCountries || []) {
        if (country && country.toLowerCase() !== 'unspecified') {
          householdCountries.add(country);
        }
      }
    }

    for (const country of householdCountries) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }

    const contractType = members.find((member) => member.contractType)?.contractType || '';
    if (contractType !== 'CC' && contractType !== 'MV') {
      continue;
    }

    const bucket = contractType === 'CC' ? countryCountsByContractType.CC : countryCountsByContractType.MV;
    for (const country of householdCountries) {
      bucket[country] = (bucket[country] || 0) + 1;
    }
  }

  const emailSalesCcMv = computeEmailSalesCcMvSplit(filteredProspects, complaintsOnDate, householdMap);

  return {
    date,
    fileName: data.fileName,
    totalProcessed: data.processedCount,
    totalConversations: data.totalConversations,
    isProcessing: data.isProcessing,
    prospects: {
      ...filteredProspectCounts,
      details: enrichedProspects,
    },
    conversions,
    countryCounts,
    countryCountsByContractType,
    byContractType,
    emailSalesCcMv,
    latestRun,
    households,
    prospectDetails: enrichedProspects,
  };
}
