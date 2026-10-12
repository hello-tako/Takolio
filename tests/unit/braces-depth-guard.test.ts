import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { describe, expect, it } from 'vitest';

// The removed braces owner is archived in the migration packet; exercise its replacement.
const entry = fileURLToPath(new URL('../../src/web/styles/index.css', import.meta.url));
const input = readFileSync(entry, 'utf8');
const compiled = (await postcss([tailwind()]).process(input, { from: entry })).root;
const declarations = (selector: string, property: string) => {
  const values: string[] = [];
  compiled.walkRules(selector, (rule) => {
    rule.walkDecls(property, (declaration) => { values.push(declaration.value); });
  });
  return values;
};

describe('official compiler owner and established application utility contract', () => {
  it('removes both vulnerable discovery owners from the frozen graph', () => {
    const lock = readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');
    expect(lock).not.toMatch(/^\s+(?:braces|chokidar)@/m);
    expect(lock).toContain('tailwindcss@4.3.3');
    expect(lock).toContain('@tailwindcss/postcss@4.3.3');
  });
  it('compiles the actual application entry without unresolved Tailwind directives', () => {
    expect(compiled.toString()).not.toMatch(/@(?:tailwind|config|source|utility)\s/);
    expect(declarations('.sr-only', 'position')).toContain('absolute');
    expect(declarations('.hidden', 'display')).toContain('none');
  });
  it('preserves v3 sibling spacing and skips hidden children', () => {
    for (const [value, rem] of [['0.5', '0.125'], ['1', '0.25'], ['2', '0.5'], ['2.5', '0.625'], ['3', '0.75'], ['3.5', '0.875'], ['4', '1.0'], ['5', '1.25'], ['6', '1.5'], ['7', '1.75']]) {
      const selector = `.space-y-${value.replace('.', '\\.')} > :not([hidden]) ~ :not([hidden])`;
      expect(declarations(selector, 'margin-top')).toContain(`calc(${rem}rem * (1 - var(--tw-space-y-reverse)))`);
    }
    expect(compiled.toString()).not.toMatch(/space-y-[\d.\\]+\s*>\s*:not\(:last-child\)/);
  });
  it('preserves the small input type scale independently of inherited leading', () => {
    expect(declarations('.text-sm', 'line-height').at(-1)).toBe('1.25rem');
    expect(declarations('.text-xs', 'line-height').at(-1)).toBe('1rem');
  });
  it('retains the established full radius and focus outline', () => {
    expect(declarations('.rounded-full', 'border-radius').at(-1)).toBe('9999px');
    expect(declarations('.outline-none', 'outline')).toContain('2px solid transparent');
  });
  it('compiles opacity scrims and semantic focus variants from real callers', () => {
    expect(declarations('.bg-black\\/50', 'background-color').length).toBeGreaterThan(0);
    expect(compiled.toString()).toContain('focus-visible');
    expect(compiled.toString()).toContain('--semantic-focus-rgb');
    expect(compiled.toString()).toContain('--takosan-font-ui');
  });
});
