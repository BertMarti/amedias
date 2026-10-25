import { describe, expect, it } from 'vitest';
import { appUrl, NATIVE, PUBLIC_URL } from '../../src/ui/native';
import { CSP } from '../../vite.config';

describe('app de Android', () => {
  it('en la web, los enlaces usan la dirección de la propia web', () => {
    expect(NATIVE).toBe(false);
    expect(appUrl()).toBe(location.origin + import.meta.env.BASE_URL);
  });

  it('la dirección pública es https y coincide con la base de GitHub Pages', () => {
    expect(PUBLIC_URL).toMatch(/^https:\/\/[a-z0-9.-]+\/amedias\/$/);
  });

  it('la CSP de la app y de la web es la misma, con Trusted Types', () => {
    expect(CSP).toContain("require-trusted-types-for 'script'");
    expect(CSP).toContain('trusted-types amedias-sw');
    expect(CSP).not.toContain('unsafe');
  });
});
