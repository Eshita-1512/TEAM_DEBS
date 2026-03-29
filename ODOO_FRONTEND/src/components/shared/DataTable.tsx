import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination, SortOrder } from '@/types/api';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, order: SortOrder) => void;
  currentSort?: { key: string; order: SortOrder };
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  getRowId?: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  pagination,
  onPageChange,
  onSort,
  currentSort,
  onRowClick,
  loading,
  emptyMessage = 'No data found',
  selectedIds,
  onSelectionChange,
  getRowId,
}: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const selectable = Boolean(onSelectionChange && getRowId);

  const handleSort = (key: string) => {
    if (!onSort) return;
    const nextOrder: SortOrder =
      currentSort?.key === key && currentSort.order === 'asc' ? 'desc' : 'asc';
    onSort(key, nextOrder);
  };

  const toggleAll = () => {
    if (!onSelectionChange || !getRowId) return;
    const ids = data.map(getRowId);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds?.has(id));
    onSelectionChange(new Set(allSelected ? [] : ids));
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const visibleCount = pagination
    ? `${Math.min((pagination.page - 1) * pagination.page_size + 1, pagination.total_items)}-${Math.min(pagination.page * pagination.page_size, pagination.total_items)}`
    : `${data.length}`;

  return (
    <section className="surface-panel overflow-hidden rounded-[1.5rem]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div>
          <div className="section-kicker">Records</div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {pagination ? `${visibleCount} of ${pagination.total_items} records` : `${data.length} records`}
          </p>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && data.every((item) => selectedIds?.has(getRowId!(item)))}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable && handleSort(column.key)}
                  className={column.sortable ? 'cursor-pointer select-none' : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable &&
                      (currentSort?.key === column.key ? (
                        currentSort.order === 'asc' ? (
                          <ArrowUp size={13} className="text-[var(--accent)]" />
                        ) : (
                          <ArrowDown size={13} className="text-[var(--accent)]" />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="text-[var(--text-muted)]" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`loading-${index}`}>
                  {Array.from({ length: columns.length + (selectable ? 1 : 0) }).map((__, cellIndex) => (
                    <td key={`loading-cell-${cellIndex}`}>
                      <div className="shimmer h-4 rounded-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <div className="px-6 py-16 text-center text-sm text-[var(--text-muted)]">{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => {
                const rowId = getRowId?.(item);
                const selected = rowId ? selectedIds?.has(rowId) : false;

                return (
                  <tr
                    key={rowId ?? rowIndex}
                    className={onRowClick ? 'cursor-pointer' : undefined}
                    style={{
                      background: selected
                        ? 'var(--surface-tint-info)'
                        : hoveredRow === rowIndex
                          ? 'rgba(37, 99, 235, 0.04)'
                          : undefined,
                    }}
                    onClick={() => onRowClick?.(item)}
                    onMouseEnter={() => setHoveredRow(rowIndex)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {selectable && rowId && (
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(rowId)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className={column.className}>
                        {column.render
                          ? column.render(item)
                          : String((item as Record<string, unknown>)[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            Page {pagination.page} of {pagination.total_pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
