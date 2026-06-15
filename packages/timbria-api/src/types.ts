export type FxCategory =
  | 'reverb' | 'dynamics' | 'distortion' | 'modulation' | 'delay'
  | 'eq' | 'pitch' | 'source-instrument' | 'source-synth' | 'mic' | 'amp' | 'utility';

export interface FxType {
  id: number; name: string; category: FxCategory;
  fingerprint: string; tells: string; era: string; typical_use: string;
}
export interface GearItem {
  id: number; name: string; fx_type_id: number;
  manufacturer: string; kind: 'hardware' | 'plugin' | 'instrument' | 'synth' | 'mic' | 'amp';
}
export interface Sound {
  id: number; name: string; description: string;
  chain: number[]; // ordered fx_type ids, JSON-encoded in db
  artist_id: number | null;
}

export interface IdNode {
  id: number;
  question: string;            // empty for leaf nodes
  branches: Array<{ answer: string; next: number }>; // JSON in db
  leaf_fx_type_ids: number[];  // JSON in db; non-empty => leaf
  explanation: string;
}
