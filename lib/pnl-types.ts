// P&L Types

export interface EntryType {
  type: string;
  volume: number;
  price: number;
  revenue: number;
  embassyFee: number;
  cost: number;
}

export interface CostBreakdown {
  embassyFees?: number;
  transportation?: number;
  dmwFees?: number;
  owwaFees?: number;
  governmentFees?: number;
  dubaiPoliceFees?: number;
  thirdPartyFacilitator?: number;
  documentPrinting?: number;
}

// Per-order unit costs (not aggregated)
export interface UnitCosts {
  dmwFees?: number;         // OEC: 61.5
  owwaFees?: number;        // OWWA: 92
  embassyFees?: number;     // TTJ: 220, varies for TTL/TTE
  transportation?: number;  // TTL/TTE: 100
  thirdPartyFacilitator?: number; // TTJ: 100
  dubaiPoliceFees?: number; // GCC: 220
  governmentFees?: number;  // Ethiopian PP: 1350
}

export interface ServicePnL {
  name: string;
  volume: number;
  price: number;
  serviceFees: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  transportation?: number;
  // For travel visas with multiple entry types
  entryTypes?: EntryType[];
  // Cost breakdown (aggregated totals)
  costBreakdown?: CostBreakdown;
  // Per-order unit costs
  unitCosts?: UnitCosts;
}

export interface FixedCosts {
  laborCost: number;
  llm: number;
  proTransportation: number;
  total: number;
}

export interface PnLData {
  fileName: string;
  date?: string;
  services: {
    oec: ServicePnL;
    owwa: ServicePnL;
    ttl: ServicePnL;
    ttlSingle: ServicePnL;
    ttlDouble: ServicePnL;
    ttlMultiple: ServicePnL;
    tte: ServicePnL;
    tteSingle: ServicePnL;
    tteDouble: ServicePnL;
    tteMultiple: ServicePnL;
    ttj: ServicePnL;
    visaSaudi: ServicePnL;
    schengen: ServicePnL;
    gcc: ServicePnL;
    ethiopianPP: ServicePnL;
    filipinaPP: ServicePnL;
  };
  summary: {
    totalGrossProfit: number;
    fixedCosts: FixedCosts;
    netProfit: number;
  };
}

export interface AggregatedPnL {
  files: string[];
  services: {
    oec: ServicePnL;
    owwa: ServicePnL;
    ttl: ServicePnL;
    ttlSingle: ServicePnL;
    ttlDouble: ServicePnL;
    ttlMultiple: ServicePnL;
    tte: ServicePnL;
    tteSingle: ServicePnL;
    tteDouble: ServicePnL;
    tteMultiple: ServicePnL;
    ttj: ServicePnL;
    visaSaudi: ServicePnL;
    schengen: ServicePnL;
    gcc: ServicePnL;
    ethiopianPP: ServicePnL;
    filipinaPP: ServicePnL;
  };
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
    fixedCosts: FixedCosts;
    netProfit: number;
  };
}

