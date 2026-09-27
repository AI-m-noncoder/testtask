import { useDebouncedValue } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { MemberSortField, MembersQuery, MemberStatus, SortOrder } from '../../api/types';

export const PAGE_SIZES = [10, 20, 50];
const SORT_FIELDS: MemberSortField[] = ['name', 'email', 'createdAt', 'role'];
const STATUSES: MemberStatus[] = ['active', 'invited'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULTS = { page: 1, pageSize: 20, sortBy: 'name', sortOrder: 'asc' } as const;

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;

/**
 * Filters, sorting, page and the opened member live in the URL: the view survives
 * a reload and can be shared as a link. Hand-edited garbage falls back to defaults.
 */
export function useMembersParams() {
  const [params, setParams] = useSearchParams();

  const query = useMemo<MembersQuery>(() => {
    const page = Number(params.get('page'));
    const pageSize = Number(params.get('pageSize'));
    const roleId = params.get('roleId');
    const branchId = params.get('branchId');
    return {
      page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
      pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULTS.pageSize,
      search: params.get('search')?.trim() || undefined,
      roleId: roleId && UUID_RE.test(roleId) ? roleId : undefined,
      branchId: branchId && (branchId === 'none' || UUID_RE.test(branchId)) ? branchId : undefined,
      status: oneOf(params.get('status'), STATUSES),
      sortBy: oneOf(params.get('sortBy'), SORT_FIELDS) ?? DEFAULTS.sortBy,
      sortOrder: oneOf<SortOrder>(params.get('sortOrder'), ['asc', 'desc']) ?? DEFAULTS.sortOrder,
    };
  }, [params]);

  /** Changing anything but the page returns to page 1 */
  const update = useCallback(
    (patch: Partial<MembersQuery>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const isDefault = DEFAULTS[key as keyof typeof DEFAULTS] === value;
            if (value === undefined || value === '' || isDefault) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // A hand-edited ?member= that isn't an id is treated as "nothing opened"
  const memberParam = params.get('member');
  const selectedMemberId = memberParam && UUID_RE.test(memberParam) ? memberParam : null;
  const setSelectedMember = useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('member', id);
        else next.delete('member');
        return next;
      }),
    [setParams],
  );

  // The search box updates the URL after a pause in typing. `pushed` is the last value
  // written to the URL, so a URL change that didn't come from typing (back/forward)
  // can be told apart and copied into the box.
  const [searchInput, setSearchInput] = useState(query.search ?? '');
  const [debouncedSearch] = useDebouncedValue(searchInput.trim(), 300);
  const pushed = useRef(query.search ?? '');

  useEffect(() => {
    // Wait until the debounced value has caught up with the input: right after a reset
    // it still holds the old text and would write it back into the URL
    const settled = debouncedSearch === searchInput.trim();
    if (!settled || debouncedSearch === pushed.current) return;
    pushed.current = debouncedSearch;
    update({ search: debouncedSearch || undefined });
  }, [debouncedSearch, searchInput, update]);

  useEffect(() => {
    const fromUrl = query.search ?? '';
    if (fromUrl === pushed.current) return;
    pushed.current = fromUrl;
    setSearchInput(fromUrl);
  }, [query.search]);

  const hasFilters = Boolean(query.search || query.roleId || query.branchId || query.status);
  const resetFilters = useCallback(() => {
    pushed.current = '';
    setSearchInput('');
    update({ search: undefined, roleId: undefined, branchId: undefined, status: undefined });
  }, [update]);

  return {
    query,
    update,
    hasFilters,
    resetFilters,
    searchInput,
    setSearchInput,
    selectedMemberId,
    setSelectedMember,
  };
}
