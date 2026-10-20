export type StagingTestOperation = 'enroll-staging-test' | 'revoke-staging-test';
export const STAGING_TEST_OPERATIONS: readonly StagingTestOperation[];
export function validateStagingTestPayload(operation: StagingTestOperation, environment: string, payload: Record<string, unknown>): Record<string, unknown>;
export function executeStagingTestIdentity(options: Record<string, unknown>): Promise<void>;
