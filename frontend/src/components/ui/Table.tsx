'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
};

export function Table<T>({ columns, data, sortBy, sortOrder, onSort, rowKey, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto border border-app-border shadow-panel">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-app-navBg text-left text-xs uppercase tracking-wider text-app-navText">
            {columns.map((column) => (
              <th key={column.key} className={cn('border-b border-slate-600 px-3 py-2.5 font-medium', column.className)}>
                {column.sortable && onSort ? (
                  <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => onSort(column.key)} type="button">
                    {column.header}
                    <span className="text-slate-500">{sortBy === column.key ? (sortOrder === 'asc' ? ' \u25B2' : ' \u25BC') : ' \u25C6'}</span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {data.map((row, index) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'border-b border-app-borderLight last:border-b-0',
                index % 2 === 1 && 'bg-gray-50',
                onRowClick && 'cursor-pointer hover:bg-blue-50',
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-3 py-2 align-top text-app-text', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
