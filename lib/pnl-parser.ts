import * as XLSX from 'xlsx';
import * as fs from 'fs';
import type { ServicePnL, PnLData, AggregatedPnL, FixedCosts, EntryType, CostBreakdown, UnitCosts } from './pnl-types';

// Helper to parse a number from various formats
function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[AED$,\s]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Parse OEC sheet - specific structure
function parseOECSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume",10]
  // Row 2: [null,"Price",61.5]
  // Row 3: [null,"Service Fees",0]
  // Row 4: [null,"Total Revenue ",615]
  // Row 5: ["Direct Cost Per Order (COGS)","DMW Fees for Verification",61.5]
  // Row 6: [null,"Total Cost",615]
  // Row 7: ["Gross Profit",null,0]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const dmwFees = parseNumber(data[5]?.[2]);
  const totalCost = parseNumber(data[6]?.[2]);
  const grossProfit = parseNumber(data[7]?.[2]);

  const costBreakdown: CostBreakdown = {
    dmwFees,
  };

  // Unit cost per order: DMW Fees = 61.5 AED
  const unitCosts: UnitCosts = {
    dmwFees: 61.5,
  };

  return {
    name: 'OEC',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    costBreakdown,
    unitCosts,
  };
}

// Parse OWWA sheet - same structure as OEC
function parseOWWASheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const owwaFees = parseNumber(data[5]?.[2]);
  const totalCost = parseNumber(data[6]?.[2]);
  const grossProfit = parseNumber(data[7]?.[2]);

  const costBreakdown: CostBreakdown = {
    owwaFees,
  };

  // Unit cost per order: OWWA Fees = 92 AED
  const unitCosts: UnitCosts = {
    owwaFees: 92,
  };

  return {
    name: 'OWWA',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    costBreakdown,
    unitCosts,
  };
}

// Parse TTL (Travel to Lebanon) sheet - has entry types
function parseTTLSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","Single Entry","4"]
  // Row 2: [null,null,"Double Entry","5"]
  // Row 3: [null,null,"Multiple Entry","7"]
  // Row 4: [null,"Price","Single Entry",425]
  // Row 5: [null,null,"Double Entry",565]
  // Row 6: [null,null,"Multiple Entry",745]
  // Row 7: [null,null,"Transportation",100]
  // Row 8: [null,"Service Fees",null,0]
  // Row 9: [null,"Revenue / Volume","Single Entry",2100]
  // Row 10: [null,null,"Double Entry",3325]
  // Row 11: [null,null,"Multiple Entry",5915]
  // Row 12: [null,"Total Revenue",null,11340]
  // Row 21: [null,"Total Cost",null,11340]
  // Row 22: ["Gross Profit",null,null,0]
  
  const singleVolume = parseNumber(data[1]?.[3]);
  const doubleVolume = parseNumber(data[2]?.[3]);
  const multipleVolume = parseNumber(data[3]?.[3]);
  
  const singlePrice = parseNumber(data[4]?.[3]);
  const doublePrice = parseNumber(data[5]?.[3]);
  const multiplePrice = parseNumber(data[6]?.[3]);
  const transportation = parseNumber(data[7]?.[3]);
  
  const serviceFees = parseNumber(data[8]?.[3]);
  
  const singleRevenue = parseNumber(data[9]?.[3]);
  const doubleRevenue = parseNumber(data[10]?.[3]);
  const multipleRevenue = parseNumber(data[11]?.[3]);
  
  const totalRevenue = parseNumber(data[12]?.[3]);
  const totalCost = parseNumber(data[21]?.[3]);
  const grossProfit = parseNumber(data[22]?.[3]);
  
  const totalVolume = singleVolume + doubleVolume + multipleVolume;

  // Embassy fees from rows 13-15
  const singleEmbassyFee = parseNumber(data[13]?.[3]);
  const doubleEmbassyFee = parseNumber(data[14]?.[3]);
  const multipleEmbassyFee = parseNumber(data[15]?.[3]);

  const entryTypes: EntryType[] = [
    { type: 'Single Entry', volume: singleVolume, price: singlePrice, revenue: singleRevenue, embassyFee: singleEmbassyFee, cost: singleRevenue },
    { type: 'Double Entry', volume: doubleVolume, price: doublePrice, revenue: doubleRevenue, embassyFee: doubleEmbassyFee, cost: doubleRevenue },
    { type: 'Multiple Entry', volume: multipleVolume, price: multiplePrice, revenue: multipleRevenue, embassyFee: multipleEmbassyFee, cost: multipleRevenue },
  ];

  const costBreakdown: CostBreakdown = {
    embassyFees: singleEmbassyFee + doubleEmbassyFee + multipleEmbassyFee,
    transportation,
  };

  // Unit costs per order - embassy fees vary by entry type, transport is 100
  const unitCosts: UnitCosts = {
    transportation: 100,
  };

  return {
    name: 'Travel to Lebanon',
    volume: totalVolume,
    price: totalVolume > 0 ? totalRevenue / totalVolume : 0,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    transportation,
    entryTypes,
    costBreakdown,
    unitCosts,
  };
}

// Parse TTE (Travel to Egypt) sheet - similar to TTL but no Double Entry
function parseTTESheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","Single Entry","4"]
  // Row 2: [null,null,"Multiple Entry","7"]
  // Row 3: [null,"Price","Single Entry",370]
  // Row 4: [null,null,"Multiple Entry",470]
  // Row 5: [null,null,"Transportation",100]
  // Row 6: [null,"Service Fees",null,0]
  // Row 7: [null,"Revenue / Volume","Single Entry",1880]
  // Row 8: [null,null,"Multiple Entry",3990]
  // Row 9: [null,"Total Revenue",null,5870]
  // Row 16: [null,"Total Cost",null,5870]
  // Row 17: ["Gross Profit",null,null,0]
  
  const singleVolume = parseNumber(data[1]?.[3]);
  const multipleVolume = parseNumber(data[2]?.[3]);
  
  const singlePrice = parseNumber(data[3]?.[3]);
  const multiplePrice = parseNumber(data[4]?.[3]);
  const transportation = parseNumber(data[5]?.[3]);
  
  const serviceFees = parseNumber(data[6]?.[3]);
  
  const singleRevenue = parseNumber(data[7]?.[3]);
  const multipleRevenue = parseNumber(data[8]?.[3]);
  
  const totalRevenue = parseNumber(data[9]?.[3]);
  const totalCost = parseNumber(data[16]?.[3]);
  const grossProfit = parseNumber(data[17]?.[3]);
  
  const totalVolume = singleVolume + multipleVolume;

  // Embassy fees from rows 10-11
  const singleEmbassyFee = parseNumber(data[10]?.[3]);
  const multipleEmbassyFee = parseNumber(data[11]?.[3]);

  const entryTypes: EntryType[] = [
    { type: 'Single Entry', volume: singleVolume, price: singlePrice, revenue: singleRevenue, embassyFee: singleEmbassyFee, cost: singleRevenue },
    { type: 'Multiple Entry', volume: multipleVolume, price: multiplePrice, revenue: multipleRevenue, embassyFee: multipleEmbassyFee, cost: multipleRevenue },
  ];

  const costBreakdown: CostBreakdown = {
    embassyFees: singleEmbassyFee + multipleEmbassyFee,
    transportation,
  };

  // Unit costs per order - embassy fees vary by entry type, transport is 100
  const unitCosts: UnitCosts = {
    transportation: 100,
  };

  return {
    name: 'Travel to Egypt',
    volume: totalVolume,
    price: totalVolume > 0 ? totalRevenue / totalVolume : 0,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    transportation,
    entryTypes,
    costBreakdown,
    unitCosts,
  };
}

// Parse TTJ (Travel to Jordan) sheet
function parseTTJSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","3","Notes"]
  // Row 2: [null,"Price",320,"..."]
  // Row 3: [null,"Service Fees",0,null]
  // Row 4: [null,"Total Revenue",960,null]
  // Row 5: ["Direct Cost Per Order (COGS)","Embassy Fees",320,null]
  // Row 6: [null,"Total Cost",960,null]
  // Row 7: ["Gross Profit",null,0,null]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const embassyFees = parseNumber(data[5]?.[2]);
  const totalCost = parseNumber(data[6]?.[2]);
  const grossProfit = parseNumber(data[7]?.[2]);

  const costBreakdown: CostBreakdown = {
    embassyFees,
    thirdPartyFacilitator: volume * 100, // 100 AED per order
  };

  // Unit costs per order: Embassy Fees = 220, 3rd Party Facilitator = 100
  const unitCosts: UnitCosts = {
    embassyFees: 220,
    thirdPartyFacilitator: 100,
  };

  return {
    name: 'Travel to Jordan',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    costBreakdown,
    unitCosts,
  };
}

// Parse Schengen sheet
function parseSchengenSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","3"]
  // Row 2: [null,"Price",0]
  // Row 3: [null,"Service Fees",0]
  // Row 4: [null,"Total Revenue",0]
  // Row 5: ["Direct Cost Per Order (COGS)",null,0]
  // Row 6: ["Gross Profit",null,0]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const totalCost = parseNumber(data[5]?.[2]); // Cost is on row 5
  const grossProfit = parseNumber(data[6]?.[2]);

  return {
    name: 'Schengen Countries',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
  };
}

// Parse GCC sheet
function parseGCCSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","3"]
  // Row 2: [null,"Price",220]
  // Row 3: [null,"Service Fees",0]
  // Row 4: [null,"Total Revenue",660]
  // Row 5: ["Direct Cost Per Order (COGS)","Dubai Police Government Fees",220]
  // Row 6: [null,"Total",660]
  // Row 7: ["Gross Profit",null,0]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const dubaiPoliceFees = parseNumber(data[5]?.[2]);
  const totalCost = parseNumber(data[6]?.[2]); // Total is on row 6
  const grossProfit = parseNumber(data[7]?.[2]);

  const costBreakdown: CostBreakdown = {
    dubaiPoliceFees,
  };

  // Unit cost per order: Dubai Police = 220 AED
  const unitCosts: UnitCosts = {
    dubaiPoliceFees: 220,
  };

  return {
    name: 'GCC',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    costBreakdown,
    unitCosts,
  };
}

// Parse Ethiopian PP Renewal sheet
function parseEthiopianPPSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","3"]
  // Row 2: [null,"Price",1350]
  // Row 3: [null,"Service Fees",0]
  // Row 4: [null,"Total Revenue",4050]
  // Row 5: ["Direct Cost Per Order (COGS)","Government Fees",1350]
  // Row 6: [null,"Total",4050]
  // Row 7: ["Gross Profit",null,0]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const governmentFees = parseNumber(data[5]?.[2]);
  const totalCost = parseNumber(data[6]?.[2]); // Total is on row 6
  const grossProfit = parseNumber(data[7]?.[2]);

  const costBreakdown: CostBreakdown = {
    governmentFees,
  };

  // Unit cost per order: Government Fees = 1350 AED
  const unitCosts: UnitCosts = {
    governmentFees: 1350,
  };

  return {
    name: 'Ethiopian Passport Renewal',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
    costBreakdown,
    unitCosts,
  };
}

// Parse Filipina PP Renewal sheet
function parseFilipinaPPSheet(sheet: XLSX.WorkSheet): ServicePnL {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 1: ["Revenue","Volume","3"]
  // Row 2: [null,"Price",0]
  // Row 3: [null,"Service Fees",0]
  // Row 4: [null,"Total Revenue",0]
  // Row 5: ["Direct Cost Per Order (COGS)",null,0]
  // Row 6: ["Gross Profit",null,0]
  
  const volume = parseNumber(data[1]?.[2]);
  const price = parseNumber(data[2]?.[2]);
  const serviceFees = parseNumber(data[3]?.[2]);
  const totalRevenue = parseNumber(data[4]?.[2]);
  const totalCost = parseNumber(data[5]?.[2]); // Cost is on row 5
  const grossProfit = parseNumber(data[6]?.[2]);

  return {
    name: 'Filipina Passport Renewal',
    volume,
    price,
    serviceFees,
    totalRevenue,
    totalCost,
    grossProfit,
  };
}

// Parse Comprehensive P&L sheet
function parseComprehensivePnL(sheet: XLSX.WorkSheet): { fixedCosts: FixedCosts; netProfit: number } {
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true, defval: null });
  
  // Row 11: ["Fixed Costs","Labor Cost",55000]
  // Row 12: [null,"LLM",3650]
  // Row 13: [null,"PRO Transportation",2070]
  // Row 14: [null,"Total",60720]
  // Row 15: ["Net Profit ",null,-60720]
  
  const laborCost = parseNumber(data[11]?.[2]);
  const llm = parseNumber(data[12]?.[2]);
  const proTransportation = parseNumber(data[13]?.[2]);
  const totalFixed = parseNumber(data[14]?.[2]);
  const netProfit = parseNumber(data[15]?.[2]);

  return {
    fixedCosts: {
      laborCost,
      llm,
      proTransportation,
      total: totalFixed,
    },
    netProfit,
  };
}

export function parsePnLFile(filePath: string): PnLData {
  // Read file as buffer to handle special characters in path
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const fileName = filePath.split('/').pop() || filePath;

  const createEmptyService = (name: string): ServicePnL => ({
    name,
    volume: 0,
    price: 0,
    serviceFees: 0,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
  });

  const services = {
    oec: parseOECSheet(workbook.Sheets['OEC']),
    owwa: parseOWWASheet(workbook.Sheets['OWWA']),
    ttl: parseTTLSheet(workbook.Sheets['TTL']),
    ttlSingle: createEmptyService('Tourist Visa to Lebanon – Single Entry'),
    ttlDouble: createEmptyService('Tourist Visa to Lebanon – Double Entry'),
    ttlMultiple: createEmptyService('Tourist Visa to Lebanon – Multiple Entry'),
    tte: parseTTESheet(workbook.Sheets['TTE']),
    tteSingle: createEmptyService('Tourist Visa to Egypt – Single Entry'),
    tteDouble: createEmptyService('Tourist Visa to Egypt – Double Entry'),
    tteMultiple: createEmptyService('Tourist Visa to Egypt – Multiple Entry'),
    ttj: parseTTJSheet(workbook.Sheets['TTJ']),
    visaSaudi: createEmptyService('Visa Saudi'),
    schengen: parseSchengenSheet(workbook.Sheets['Schengen Countries']),
    gcc: parseGCCSheet(workbook.Sheets['GCC']),
    ethiopianPP: parseEthiopianPPSheet(workbook.Sheets['Ethiopian PP Renewal']),
    filipinaPP: parseFilipinaPPSheet(workbook.Sheets['Filipina PP Renewal']),
  };

  const comprehensive = parseComprehensivePnL(workbook.Sheets['Comprehensive P&L']);
  
  const totalGrossProfit = Object.values(services).reduce((sum, s) => sum + s.grossProfit, 0);

  return {
    fileName,
    services,
    summary: {
      totalGrossProfit,
      fixedCosts: comprehensive.fixedCosts,
      netProfit: comprehensive.netProfit,
    },
  };
}

export function aggregatePnLData(pnlDataList: PnLData[]): AggregatedPnL {
  const files = pnlDataList.map(p => p.fileName);
  
  // Initialize aggregated services
  const createEmptyService = (name: string): ServicePnL => ({
    name,
    volume: 0,
    price: 0,
    serviceFees: 0,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
  });

  const aggregatedServices = {
    oec: createEmptyService('OEC'),
    owwa: createEmptyService('OWWA'),
    ttl: createEmptyService('Travel to Lebanon'),
    ttlSingle: createEmptyService('Tourist Visa to Lebanon – Single Entry'),
    ttlDouble: createEmptyService('Tourist Visa to Lebanon – Double Entry'),
    ttlMultiple: createEmptyService('Tourist Visa to Lebanon – Multiple Entry'),
    tte: createEmptyService('Travel to Egypt'),
    tteSingle: createEmptyService('Tourist Visa to Egypt – Single Entry'),
    tteDouble: createEmptyService('Tourist Visa to Egypt – Double Entry'),
    tteMultiple: createEmptyService('Tourist Visa to Egypt – Multiple Entry'),
    ttj: createEmptyService('Travel to Jordan'),
    visaSaudi: createEmptyService('Visa Saudi'),
    schengen: createEmptyService('Schengen Countries'),
    gcc: createEmptyService('GCC'),
    ethiopianPP: createEmptyService('Ethiopian Passport Renewal'),
    filipinaPP: createEmptyService('Filipina Passport Renewal'),
  };

  // Fixed costs are monthly and should NOT be aggregated across files
  // Use the values from the first file (they're the same in all files)
  const aggregatedFixedCosts: FixedCosts = pnlDataList.length > 0 
    ? { ...pnlDataList[0].summary.fixedCosts }
    : {
        laborCost: 55000,
        llm: 3650,
        proTransportation: 2070,
        total: 60720,
      };

  // Track entry types for aggregation
  const entryTypeMap: Record<string, Record<string, EntryType>> = {};
  const costBreakdownMap: Record<string, CostBreakdown> = {};
  const transportationMap: Record<string, number> = {};

  // Aggregate service data from all files (but NOT fixed costs)
  pnlDataList.forEach(pnl => {
    Object.keys(aggregatedServices).forEach(key => {
      const serviceKey = key as keyof typeof aggregatedServices;
      const service = pnl.services[serviceKey];
      aggregatedServices[serviceKey].volume += service.volume;
      aggregatedServices[serviceKey].totalRevenue += service.totalRevenue;
      aggregatedServices[serviceKey].totalCost += service.totalCost;
      aggregatedServices[serviceKey].grossProfit += service.grossProfit;
      // Service fee is per-order, so keep the first non-zero value (don't sum)
      if (aggregatedServices[serviceKey].serviceFees === 0 && service.serviceFees > 0) {
        aggregatedServices[serviceKey].serviceFees = service.serviceFees;
      }
      
      // Aggregate transportation
      if (service.transportation) {
        transportationMap[serviceKey] = (transportationMap[serviceKey] || 0) + service.transportation;
      }

      // Aggregate entry types
      if (service.entryTypes) {
        if (!entryTypeMap[serviceKey]) {
          entryTypeMap[serviceKey] = {};
        }
        service.entryTypes.forEach(entry => {
          if (!entryTypeMap[serviceKey][entry.type]) {
            entryTypeMap[serviceKey][entry.type] = {
              type: entry.type,
              volume: 0,
              price: entry.price, // Use first file's price as reference
              revenue: 0,
              embassyFee: entry.embassyFee,
              cost: 0,
            };
          }
          entryTypeMap[serviceKey][entry.type].volume += entry.volume;
          entryTypeMap[serviceKey][entry.type].revenue += entry.revenue;
          entryTypeMap[serviceKey][entry.type].cost += entry.cost;
        });
      }

      // Aggregate cost breakdown
      if (service.costBreakdown) {
        if (!costBreakdownMap[serviceKey]) {
          costBreakdownMap[serviceKey] = {};
        }
        const cb = service.costBreakdown;
        const agg = costBreakdownMap[serviceKey];
        if (cb.embassyFees) agg.embassyFees = (agg.embassyFees || 0) + cb.embassyFees;
        if (cb.transportation) agg.transportation = (agg.transportation || 0) + cb.transportation;
        if (cb.dmwFees) agg.dmwFees = (agg.dmwFees || 0) + cb.dmwFees;
        if (cb.governmentFees) agg.governmentFees = (agg.governmentFees || 0) + cb.governmentFees;
        if (cb.dubaiPoliceFees) agg.dubaiPoliceFees = (agg.dubaiPoliceFees || 0) + cb.dubaiPoliceFees;
        if (cb.documentPrinting) agg.documentPrinting = (agg.documentPrinting || 0) + cb.documentPrinting;
      }
    });
  });

  // Calculate average prices and attach aggregated entry types/cost breakdowns
  Object.keys(aggregatedServices).forEach(key => {
    const serviceKey = key as keyof typeof aggregatedServices;
    const service = aggregatedServices[serviceKey];
    service.price = service.volume > 0 ? service.totalRevenue / service.volume : 0;
    
    // Attach aggregated entry types
    if (entryTypeMap[serviceKey]) {
      service.entryTypes = Object.values(entryTypeMap[serviceKey]);
    }
    
    // Attach aggregated cost breakdown
    if (costBreakdownMap[serviceKey] && Object.keys(costBreakdownMap[serviceKey]).length > 0) {
      service.costBreakdown = costBreakdownMap[serviceKey];
    }
    
    // Attach aggregated transportation
    if (transportationMap[serviceKey]) {
      service.transportation = transportationMap[serviceKey];
    }
  });

  const totalRevenue = Object.values(aggregatedServices).reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalCost = Object.values(aggregatedServices).reduce((sum, s) => sum + s.totalCost, 0);
  const totalGrossProfit = Object.values(aggregatedServices).reduce((sum, s) => sum + s.grossProfit, 0);
  const netProfit = totalGrossProfit - aggregatedFixedCosts.total;

  return {
    files,
    services: aggregatedServices,
    summary: {
      totalRevenue,
      totalCost,
      totalGrossProfit,
      fixedCosts: aggregatedFixedCosts,
      netProfit,
    },
  };
}
