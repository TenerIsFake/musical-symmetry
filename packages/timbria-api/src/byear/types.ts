export interface EarLabel { label: string; confidence: number; }
export interface EarResult {
  instruments: EarLabel[];
  effects: EarLabel[];
  mood: EarLabel[];
}
export interface ByEarResponse extends EarResult {
  domain: 'isolated' | 'mix';
  fxTypeIds: number[];
}
