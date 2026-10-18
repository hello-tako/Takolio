import { verifyStableWorkerDeployment } from '../release-check.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// Mutation acknowledgements are not traffic proof; reconcile their ID against both live reads.
export async function confirmDeploymentMutation(response, versionId, { recordId, readDeployment, readCurrent }) {
  if (typeof response?.id !== 'string' || !UUID.test(response.id) ||
      typeof versionId !== 'string' || !UUID.test(versionId)) {
    throw new Error('Deployment mutation requires reconciliation: canonical identity missing');
  }
  await recordId(response.id);
  if (response.strategy !== undefined && response.strategy !== 'percentage') {
    throw new Error('Deployment mutation strategy differs from the requested stable deployment');
  }
  if (Object.hasOwn(response, 'versions')) {
    const acknowledged = verifyStableWorkerDeployment(response);
    if (acknowledged.versionId !== versionId) throw new Error('Deployment acknowledgement version mismatch');
  }
  const observed = verifyStableWorkerDeployment(await readDeployment(response.id));
  if (observed.deploymentId !== response.id || observed.versionId !== versionId) {
    throw new Error('Deployment read does not prove the exact mutation and target version');
  }
  const current = await readCurrent();
  if (current.deploymentId !== response.id || current.versionId !== versionId) {
    throw new Error('Current deployment differs from the recorded mutation');
  }
  return { ...observed, confirmedBy: ['deployment-read', 'current-deployment-read'] };
}
