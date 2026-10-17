import { permissionsForRoles } from '@shared/admin';
import { describe, expect, it } from 'vitest';
import { visibleNavItems } from '../../src/admin/lib/nav';

const ids = (roles: Parameters<typeof permissionsForRoles>[0]) =>
  visibleNavItems(permissionsForRoles(roles)).map((item) => item.id);

describe('admin navigation visibility', () => {
  it('shows CONTENT_EDITOR only overview, recipes and settings', () => {
    expect(ids(['CONTENT_EDITOR'])).toEqual(['overview', 'recipes', 'settings']);
  });

  it('hides users and billing from SUPPORT_AGENT but keeps users and households', () => {
    const visible = ids(['SUPPORT_AGENT']);
    expect(visible).toContain('users');
    expect(visible).not.toContain('billing');
    expect(visible).not.toContain('audit');
  });

  it('shows every section to SUPER_ADMIN', () => {
    expect(ids(['SUPER_ADMIN'])).toEqual(['overview', 'users', 'billing', 'ai', 'recipes', 'system', 'audit', 'settings']);
  });

  it('treats unknown roles as having no permissions', () => {
    expect(ids(['GUEST_ROLE'])).toEqual([]);
  });
});
