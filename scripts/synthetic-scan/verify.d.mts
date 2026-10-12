export function verifySyntheticImages(
  directory: string,
  prepared: unknown,
  dataset: unknown,
): Promise<{ images: number; annotated: number; documents: number }>;
