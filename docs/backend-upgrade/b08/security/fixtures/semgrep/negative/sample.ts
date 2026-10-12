export function parse(source: string): unknown {
  return JSON.parse(source);
}
export const secureTransport = { rejectUnauthorized: true };
