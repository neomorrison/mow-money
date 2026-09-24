// UI-only state that survives re-renders (tabs, filters, pending result and report data).
import type { DayReport, JobOutcome, MowJobSpec } from '../core/types';
import type { Route } from './router';

export interface ResultData {
  outcome: JobOutcome;
  spec: MowJobSpec | null;
  kind: 'manual' | 'autopilot';
  address: string;
  ownerName: string;
  portrait: string;
  returnTo: string;          // hash to go back to
  levelBefore: number;
  levelAfter: number;
  shown?: boolean;
}

export const ui = {
  lastRoute: { screen: 'title', params: [] } as Route,
  result: null as ResultData | null,
  report: null as DayReport | null,
  reportShown: false,
  mapTown: 'home',
  clientsFilterHood: 'all',
  clientsSort: 'due' as 'due' | 'satisfaction' | 'risk' | 'price' | 'name',
  clientsSearch: '',
  openClientId: null as string | null,
  garageTab: 'mower' as 'mower' | 'trimmer' | 'blower' | 'vehicle' | 'addon' | 'owned',
  financeTab: 'overview' as 'overview' | 'ledger' | 'loans' | 'marketing' | 'bids',
  crewTab: 'staff' as 'staff' | 'hiring' | 'crews',
  businessTab: 'charts' as 'charts' | 'achievements' | 'sell',
  businessRange: 28,
  loanAmount: 0,
  loanWeeks: 26,
  bidDrafts: {} as Record<string, string>,
};
