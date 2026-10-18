import { describe, expect, it, vi } from 'vitest';
import { confirmDeploymentMutation } from '../../scripts/domain/deployments.mjs';

const deploymentId = 'deadbeef-dead-4ead-8ead-deadbeefdead';
const versionId = 'cafe1234-cafe-4234-8234-cafe1234cafe';
const otherId = 'feed1234-feed-4234-8234-feed1234feed';
const stable = () => ({ id: deploymentId, strategy: 'percentage', versions: [{ version_id: versionId, percentage: 100 }] });
function fixture() {
  const events = [];
  return { events,
    recordId: vi.fn(async (id) => { events.push(['record', id]); }),
    readDeployment: vi.fn(async (id) => { events.push(['read', id]); return stable(); }),
    readCurrent: vi.fn(async () => { events.push(['current']); return { deploymentId, versionId }; }),
  };
}

describe('deployment mutation reconciliation', () => {
  it.each([{ id: deploymentId }, stable()])('proves an acknowledgement using exact deployment and current traffic reads', async (response) => {
    const source = fixture();
    const result = await confirmDeploymentMutation(response, versionId, source);
    expect(result).toMatchObject({ deploymentId, versionId, confirmedBy: ['deployment-read', 'current-deployment-read'] });
    expect(source.events).toEqual([['record', deploymentId], ['read', deploymentId], ['current']]);
  });

  it.each([null, {}, { id: '../settings' }, { id: deploymentId.toUpperCase() }, { id: deploymentId + '?x=1' }])(
    'never constructs a read path for a missing or invalid mutation identity', async (response) => {
      const source = fixture();
      await expect(confirmDeploymentMutation(response, versionId, source)).rejects.toThrow('canonical identity');
      expect(source.events).toEqual([]);
    },
  );

  it('retains the acknowledged identity before a failed read without replaying the mutation', async () => {
    const source = fixture();
    source.readDeployment.mockRejectedValue(new Error('read unavailable'));
    await expect(confirmDeploymentMutation({ id: deploymentId }, versionId, source)).rejects.toThrow('read unavailable');
    expect(source.recordId).toHaveBeenCalledExactlyOnceWith(deploymentId);
    expect(source.readDeployment).toHaveBeenCalledOnce();
    expect(source.readCurrent).not.toHaveBeenCalled();
  });

  it('does not read or continue when the durable identity record cannot be saved', async () => {
    const source = fixture();
    source.recordId.mockRejectedValue(new Error('receipt unavailable'));
    await expect(confirmDeploymentMutation({ id: deploymentId }, versionId, source)).rejects.toThrow('receipt unavailable');
    expect(source.readDeployment).not.toHaveBeenCalled();
  });

  it.each([
    { ...stable(), strategy: 'other' },
    { ...stable(), versions: [{ version_id: otherId, percentage: 100 }] },
    { ...stable(), versions: [{ version_id: versionId, percentage: 50 }] },
    { ...stable(), versions: null },
  ])('rejects contradictory acknowledgement metadata even if later reads would succeed', async (response) => {
    const source = fixture();
    await expect(confirmDeploymentMutation(response, versionId, source)).rejects.toThrow();
    expect(source.recordId).toHaveBeenCalledOnce();
    expect(source.readDeployment).not.toHaveBeenCalled();
  });

  it.each([
    { ...stable(), id: otherId },
    { ...stable(), versions: [{ version_id: otherId, percentage: 100 }] },
    { ...stable(), versions: [{ version_id: versionId, percentage: 50 }, { version_id: otherId, percentage: 50 }] },
    { ...stable(), versions: [] },
  ])('rejects an unrelated, incomplete or split deployment read', async (observed) => {
    const source = fixture();
    source.readDeployment.mockResolvedValue(observed);
    await expect(confirmDeploymentMutation({ id: deploymentId }, versionId, source)).rejects.toThrow();
    expect(source.readCurrent).not.toHaveBeenCalled();
  });

  it.each([{ deploymentId: otherId, versionId }, { deploymentId, versionId: otherId }])(
    'rejects changed current traffic after the deployment-specific read', async (current) => {
      const source = fixture();
      source.readCurrent.mockResolvedValue(current);
      await expect(confirmDeploymentMutation({ id: deploymentId }, versionId, source)).rejects.toThrow('Current deployment');
    },
  );
});
