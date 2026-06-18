import { describe, it, expect } from 'vitest';
import { buildEarInfer } from '../src/byear/build-ear-infer.js';
import { StubEarInfer } from '../src/byear/ear-infer.js';
import { ResilientEarInfer } from '../src/byear/resilient-ear-infer.js';

describe('buildEarInfer', () => {
  it('returns StubEarInfer when EAR_INFER_URL is unset', () => {
    expect(buildEarInfer({})).toBeInstanceOf(StubEarInfer);
  });
  it('returns ResilientEarInfer when EAR_INFER_URL is set', () => {
    expect(buildEarInfer({ EAR_INFER_URL: 'http://win:9009' })).toBeInstanceOf(ResilientEarInfer);
  });
});
