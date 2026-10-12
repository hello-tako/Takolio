import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface AstNode {
  type: string;
  nodes?: AstNode[];
  value?: string;
  parent?: AstNode;
}
type Options = Record<string, unknown>;
interface Braces {
  (input: string | string[], options?: Options): string[];
  parse(input: string, options?: Options): AstNode;
  compile(input: string | AstNode, options?: Options): string;
  expand(input: string | AstNode, options?: Options): string[];
  stringify(input: string | AstNode, options?: Options): string;
}
const require = createRequire(new URL('../../package.json', import.meta.url));
const tailwindRequire = createRequire(require.resolve('tailwindcss'));
const micromatchRequire = createRequire(tailwindRequire.resolve('micromatch'));
const braces = micromatchRequire('braces') as Braces;
const bracesRequire = createRequire(micromatchRequire.resolve('braces'));
const limitMessage = 'Brace nesting exceeds fixed depth limit (128)';
const nested = (open: string, close: string, count: number) => open.repeat(count) + 'x' + close.repeat(count);

const stringApis = [
  ['default', (input: string, options?: Options) => braces(input, options)],
  ['parse', (input: string, options?: Options) => braces.parse(input, options)],
  ['compile', (input: string, options?: Options) => braces.compile(input, options)],
  ['expand', (input: string, options?: Options) => braces.expand(input, options)],
  ['stringify', (input: string, options?: Options) => braces.stringify(input, options)],
] as const;
const hostilePatterns = [
  ['balanced braces', nested('{', '}', 4000)],
  ['balanced parentheses', nested('(', ')', 4000)],
  ['mixed containers', nested('{(', ')}', 2000)],
  ['unclosed braces', '{'.repeat(4000)],
  ['unclosed parentheses', '('.repeat(4000)],
] as const;

function expectBoundedFailure(run: () => unknown) {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(RangeError);
  expect((caught as Error).message).toBe(limitMessage);
}

function deepAst(depth: number): AstNode {
  const root: AstNode = { type: 'root', nodes: [] };
  let current = root;
  for (let n = 0; n < depth; n++) {
    const child: AstNode = { type: 'root', nodes: [], parent: current };
    current.nodes?.push(child);
    current = child;
  }
  current.nodes?.push({ type: 'text', value: 'x', parent: current });
  return root;
}

describe('installed braces recursive nesting mitigation', () => {
  for (const [api, call] of stringApis) {
    for (const [pattern, input] of hostilePatterns) {
      it(`${api} rejects ${pattern} below the upstream character limit`, () => {
        expect(input.length).toBeLessThan(10000);
        expectBoundedFailure(() => call(input));
      });
    }
    it(`${api} cannot disable the bound through options`, () => {
      expectBoundedFailure(() => call(nested('{', '}', 129), {
        maxDepth: Infinity, depthLimit: false, maxLength: 10000, rangeLimit: false,
      }));
    });
    for (const [open, close] of [['{', '}'], ['(', ')']] as const) {
      it(`${api} accepts 128 ${open} containers and rejects the next`, () => {
        expect(() => call(nested(open, close, 128))).not.toThrow();
        expectBoundedFailure(() => call(nested(open, close, 129)));
      });
    }
    it(`${api} counts braces and parentheses together`, () => {
      expect(() => call(nested('{(', ')}', 64))).not.toThrow();
      expectBoundedFailure(() => call(nested('{(', ')}', 65)));
    });
    it(`${api} does not count escaped, quoted or bracket-literal containers`, () => {
      const escaped = '\\{'.repeat(300) + '\\('.repeat(300);
      for (const input of [escaped, '"' + '{('.repeat(300) + '"', '[' + '{('.repeat(300) + ']'])
        expect(() => call(input)).not.toThrow();
    });
  }

  for (const method of ['compile', 'expand', 'stringify'] as const) {
    it(`${method} bounds a caller-supplied deep AST`, () => {
      expect(() => braces[method](deepAst(128))).not.toThrow();
      expectBoundedFailure(() => braces[method](deepAst(10000)));
    });
    it(`direct lib/${method} import also bounds recursive AST walking`, () => {
      const call = bracesRequire(`./lib/${method}`) as (ast: AstNode) => unknown;
      expectBoundedFailure(() => call(deepAst(10000)));
    });
  }
  it('direct parser import rejects deeply nested parentheses', () => {
    const parse = bracesRequire('./lib/parse') as (input: string) => AstNode;
    expectBoundedFailure(() => parse(nested('(', ')', 4000)));
  });
  it('keeps upstream shallow expansion, order, deduplication and numeric limits', () => {
    expect(braces.expand('src/{web,worker}/**/*.{ts,tsx}')).toEqual([
      'src/web/**/*.ts', 'src/web/**/*.tsx', 'src/worker/**/*.ts', 'src/worker/**/*.tsx',
    ]);
    expect(braces.expand('file-{01..03}.ts')).toEqual(['file-01.ts', 'file-02.ts', 'file-03.ts']);
    expect(braces.expand('{a,{b,c}}')).toEqual(['a', 'b', 'c']);
    expect(braces(['a', 'b'])).toEqual(['a', 'b']);
    expect(braces.expand('{a,a,b}', { nodupes: true })).toEqual(['a', 'b']);
    expect(braces.compile('src/{web,worker}')).toBe('src/(web|worker)');
    expect(braces.stringify('src/{web,worker}')).toBe('src/{web,worker}');
    expect(() => braces.expand('{1..2000}')).toThrow('expanded array length exceeds range limit');
    expect(() => braces.parse('x'.repeat(10001))).toThrow(SyntaxError);
  });
  it('actual micromatch and chokidar consumers resolve the patched package', () => {
    const chokidarRequire = createRequire(tailwindRequire.resolve('chokidar'));
    expect(chokidarRequire.resolve('braces')).toBe(micromatchRequire.resolve('braces'));
    const micromatch = tailwindRequire('micromatch') as {
      (files: string[], pattern: string): string[];
      braces(pattern: string, options?: Options): string[];
    };
    expect(micromatch(['src/web/a.ts', 'src/worker/b.ts', 'docs/c.md'], 'src/{web,worker}/*.ts'))
      .toEqual(['src/web/a.ts', 'src/worker/b.ts']);
    expectBoundedFailure(() => micromatch.braces(nested('{', '}', 4000), { expand: true }));
  });
});
