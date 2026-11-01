import { describe, expect, it } from 'vitest';
import { logicalSize } from '../src/systems/layout';

describe('logicalSize', () => {
  it('uses 1280x720 for a 16:9 landscape screen', () => {
    expect(logicalSize(1280, 720)).toEqual({ width: 1280, height: 720, portrait: false });
  });

  it('uses 720x1280 for a 9:16 portrait phone (360x640)', () => {
    expect(logicalSize(360, 640)).toEqual({ width: 720, height: 1280, portrait: true });
  });

  it('widens the canvas for a long landscape phone (844x390) so nothing is letterboxed or cropped', () => {
    const s = logicalSize(844, 390);
    expect(s.height).toBe(720);
    expect(s.width / s.height).toBeCloseTo(844 / 390, 1);
  });

  it('caps very long screens and never goes below the base size', () => {
    expect(logicalSize(3000, 400).width).toBe(1700);
    expect(logicalSize(1000, 1000)).toMatchObject({ width: 1280, height: 720 });
    expect(logicalSize(390, 844).height).toBeLessThanOrEqual(1700);
    expect(logicalSize(390, 844).width).toBe(720);
  });
});
