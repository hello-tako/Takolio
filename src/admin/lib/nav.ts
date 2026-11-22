import type { AdminPermission } from '@shared/admin';
import type { LucideIcon } from 'lucide-react';
import { Activity, Bot, ChefHat, CreditCard, Home, LayoutDashboard, ScrollText, Settings, Users } from 'lucide-react';

export type AdminNavId = 'overview' | 'users' | 'billing' | 'ai' | 'recipes' | 'system' | 'audit' | 'settings';
export type AdminSubNavId = 'households';

export interface AdminSubNavItem {
  id: AdminSubNavId;
  to: string;
  icon: LucideIcon;
  anyOf: readonly AdminPermission[];
  matches?: readonly string[];
}

export interface AdminNavItem {
  id: AdminNavId;
  to: string;
  icon: LucideIcon;
  /** Visible when the user holds any of these permissions. */
  anyOf: readonly AdminPermission[];
  /** Path prefixes that keep this item highlighted (e.g. /households under Users). */
  matches?: readonly string[];
  /** Optional nested routes rendered in the sidebar when permitted (e.g. AD05 /households). */
  subItems?: readonly AdminSubNavItem[];
}

export const ADMIN_HOUSEHOLDS_NAV_ITEM: AdminSubNavItem = {
  id: 'households',
  to: '/households',
  icon: Home,
  anyOf: ['households.read'],
  matches: ['/households'],
};

// Navigation visibility is cosmetic: the worker enforces every permission on each request.
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { id: 'overview', to: '/', icon: LayoutDashboard, anyOf: ['overview.read'] },
  {
    id: 'users',
    to: '/users',
    icon: Users,
    anyOf: ['users.read', 'households.read'],
    matches: ['/users', '/households'],
    subItems: [ADMIN_HOUSEHOLDS_NAV_ITEM],
  },
  { id: 'billing', to: '/billing', icon: CreditCard, anyOf: ['billing.read'] },
  { id: 'ai', to: '/ai', icon: Bot, anyOf: ['ai.read'] },
  { id: 'recipes', to: '/recipes', icon: ChefHat, anyOf: ['recipes.read'], matches: ['/recipes'] },
  { id: 'system', to: '/system', icon: Activity, anyOf: ['system.read'] },
  { id: 'audit', to: '/audit', icon: ScrollText, anyOf: ['audit.read'] },
  { id: 'settings', to: '/settings', icon: Settings, anyOf: ['admin.self.read'] },
];

export function hasPermission(permissions: readonly string[], permission: AdminPermission): boolean {
  return permissions.includes(permission);
}

export function visibleNavItems(permissions: readonly string[]): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => item.anyOf.some((permission) => hasPermission(permissions, permission)));
}

export function visibleSubNavItems(item: AdminNavItem, permissions: readonly string[]): AdminSubNavItem[] {
  return (item.subItems ?? []).filter((sub) =>
    sub.anyOf.some((permission) => hasPermission(permissions, permission)),
  );
}

/** `/` matches only itself; other prefixes also match their nested detail routes. */
export function isNavItemActive(
  item: Pick<AdminNavItem, 'to' | 'matches'>,
  pathname: string,
): boolean {
  return (item.matches ?? [item.to]).some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
