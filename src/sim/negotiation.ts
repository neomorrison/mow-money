// Negotiation engine. OWNED BY THE PITCH BUILDER. Pure and deterministic from a seed.
// Implements docs/DESIGN.md section 8. The pitch UI drives it; the sim never calls the UI.
import type { AddOn, Frequency, PitchContext, Tone } from '../core/types';

export type PitchAction =
  | { type: 'opener'; tone: Tone }
  | { type: 'point'; id: string }
  | { type: 'offer'; price: number; freq: Frequency; addOns: AddOn[] }
  | { type: 'accept_counter' }
  | { type: 'trial'; price: number; freq: Frequency; addOns: AddOn[] }
  | { type: 'leave' };

export interface NegotiationState {
  ctx: PitchContext;
  seed: number;
  trust: number;
  patience: number;
  round: number;
  R: number;
  lastCounter: number | null;
  pointsUsed: string[];
  trialUnlocked: boolean;
  done: boolean;
  log: { who: 'you' | 'them'; text: string }[];
}
