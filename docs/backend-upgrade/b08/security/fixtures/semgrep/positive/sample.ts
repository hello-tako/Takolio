export function execute(source: string) {
  eval(source);
  return new Function(source);
}
export const insecureTransport = { rejectUnauthorized: false };
