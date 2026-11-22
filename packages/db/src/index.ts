export type D1SessionConstraint = 'first-primary' | 'first-unconstrained';

export interface D1DatabaseSession {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  getBookmark(): string | null;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession?(constraintOrBookmark?: D1SessionConstraint | string): D1DatabaseSession;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Response>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface D1Response {
  success: boolean;
  meta: Record<string, unknown>;
}

export * from './queries';
export * from './catalog';
export * from './recipe-catalog';
export * from './recipe-content';
export * from './recipe-media';
export * from './personalization';
export * from './ranking-nutrition';
export * from './meal-planning';
export * from './family-preferences';
export * from './d1-session';
export * from './recipe-search';
export * from './recipe-localizations';
export * from './barcode-products';
