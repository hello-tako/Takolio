import clsx from 'clsx';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminPermission, AdminUserSummary } from '@shared/admin';
import { useUsers } from '../api/hooks';
import { vi } from '../i18n/vi';
import { useDebouncedValue } from '../lib/hooks';
import { hasPermission, visibleNavItems } from '../lib/nav';
import { Badge, Button } from './ui';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  meta?: string;
  to: string;
}

function CommandPaletteUserLoader({
  query,
  onResults,
}: {
  query: string;
  onResults: (users: AdminUserSummary[]) => void;
}) {
  const users = useUsers({ q: query, page: 1, pageSize: 6, type: 'all' });

  useEffect(() => {
    onResults(users.data?.items ?? []);
  }, [users.data, onResults]);

  return null;
}

export function CommandPalette({
  open,
  onClose,
  permissions,
}: {
  open: boolean;
  onClose: () => void;
  permissions: readonly AdminPermission[];
}) {
  const navigate = useNavigate();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queryInput, setQueryInput] = useState('');
  const debouncedQuery = useDebouncedValue(queryInput.trim(), 180);
  const [matchedUsers, setMatchedUsers] = useState<AdminUserSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const canReadUsers = hasPermission(permissions, 'users.read');
  const shouldSearchUsers = open && canReadUsers && debouncedQuery.length >= 2;

  const handleUserResults = useCallback((users: AdminUserSummary[]) => {
    setMatchedUsers(users);
  }, []);

  useEffect(() => {
    if (!shouldSearchUsers) {
      setMatchedUsers([]);
    }
  }, [shouldSearchUsers]);

  useEffect(() => {
    if (!open) {
      setQueryInput('');
      setMatchedUsers([]);
      setActiveIndex(0);
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const staticItems = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = visibleNavItems(permissions).map((item) => ({
      id: `nav-${item.id}`,
      group: vi.commandPalette.groups.navigation,
      label: vi.commandPalette.items[item.id] ?? vi.layout.nav[item.id],
      meta: item.to,
      to: item.to,
    }));

    if (hasPermission(permissions, 'households.read')) {
      navItems.push({
        id: 'nav-households',
        group: vi.commandPalette.groups.navigation,
        label: vi.commandPalette.items.households,
        meta: '/households',
        to: '/households',
      });
    }

    const actions: CommandItem[] = [];
    if (hasPermission(permissions, 'billing.read')) {
      actions.push({
        id: 'action-billing',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.billing,
        meta: '/billing',
        to: '/billing',
      });
    }
    if (hasPermission(permissions, 'recipes.read')) {
      actions.push({
        id: 'action-recipes',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.recipes,
        meta: '/recipes',
        to: '/recipes',
      });
    }
    if (hasPermission(permissions, 'ai.read')) {
      actions.push({
        id: 'action-ai',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.ai,
        meta: '/ai',
        to: '/ai',
      });
    }
    if (hasPermission(permissions, 'system.read')) {
      actions.push({
        id: 'action-system',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.system,
        meta: '/system',
        to: '/system',
      });
    }
    if (hasPermission(permissions, 'households.write')) {
      actions.push({
        id: 'action-purge-guests',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.purgeGuests,
        meta: '/households',
        to: '/households',
      });
    }
    if (hasPermission(permissions, 'system.write')) {
      actions.push({
        id: 'action-hygiene',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.runHygiene,
        meta: '/system',
        to: '/system',
      });
      actions.push({
        id: 'action-broadcast',
        group: vi.commandPalette.groups.quickActions,
        label: vi.commandPalette.items.sendBroadcast,
        meta: '/system',
        to: '/system',
      });
    }

    return [...navItems, ...actions];
  }, [permissions]);

  const items = useMemo<CommandItem[]>(() => {
    const q = queryInput.trim().toLowerCase();
    const filteredStatic = q
      ? staticItems.filter(
          (item) => item.label.toLowerCase().includes(q) || (item.meta && item.meta.toLowerCase().includes(q)),
        )
      : staticItems;

    const userItems: CommandItem[] = shouldSearchUsers
      ? matchedUsers.map((user) => ({
          id: `user-${user.id}`,
          group: vi.users.tabUsers,
          label: user.displayName ?? vi.users.anonymous,
          meta: user.emailMasked ?? user.id,
          to: `/users/${encodeURIComponent(user.id)}`,
        }))
      : [];

    return [...userItems, ...filteredStatic];
  }, [queryInput, staticItems, shouldSearchUsers, matchedUsers]);

  useEffect(() => {
    setActiveIndex(0);
  }, [queryInput, matchedUsers.length]);

  const selectItem = (item: CommandItem) => {
    onClose();
    navigate(item.to);
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (items.length > 0) {
        setActiveIndex((prev) => (prev + 1) % items.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length > 0) {
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
      }
    } else if (event.key === 'Enter') {
      const target = items[activeIndex];
      if (target) {
        event.preventDefault();
        selectItem(target);
      }
    }
  };

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="cmdk-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {shouldSearchUsers ? (
        <CommandPaletteUserLoader query={debouncedQuery} onResults={handleUserResults} />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="cmdk-modal"
        data-testid="admin-cmdk-dialog"
      >
        <h2 id={titleId} className="sr-only">
          {vi.commandPalette.title}
        </h2>
        <div className="cmdk-header">
          <input
            ref={inputRef}
            type="search"
            className="cmdk-input"
            data-testid="admin-cmdk-input"
            aria-label={vi.commandPalette.title}
            placeholder={vi.commandPalette.placeholder}
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value.slice(0, 100))}
            onKeyDown={onInputKeyDown}
          />
          <Button variant="ghost" className="btn-small" onClick={onClose}>
            {vi.common.close}
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="state-empty" style={{ padding: '20px 16px' }}>
            <p className="muted" style={{ margin: 0 }}>
              {vi.commandPalette.empty}
            </p>
          </div>
        ) : (
          <ul className="cmdk-list" role="listbox" aria-label={vi.commandPalette.title}>
            {items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const active = index === activeIndex;
              return (
                <li key={item.id} role="option" aria-selected={active}>
                  {showGroup ? <div className="cmdk-group-title">{item.group}</div> : null}
                  <button
                    type="button"
                    className={clsx('cmdk-item', active && 'is-active')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                  >
                    <span>{item.label}</span>
                    {item.meta ? (
                      <Badge tone="neutral">
                        <span className="mono">{item.meta}</span>
                      </Badge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="cmdk-footer">
          <span>{vi.commandPalette.hint}</span>
        </div>
      </div>
    </div>
  );
}
