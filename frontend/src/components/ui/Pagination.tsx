'use client';

import { Button } from '@/components/ui/Button';

type PaginationProps = {
  currentPage: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ currentPage, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, start + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-app-border bg-app-toolbar px-3 py-2 shadow-panel">
      <p className="font-mono text-xs text-app-textMuted">
        Page {currentPage} of {totalPages} ({total} records)
      </p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          Prev
        </Button>
        {pages.map((page) => (
          <Button key={page} variant={page === currentPage ? 'primary' : 'secondary'} className="min-h-9 min-w-9 px-2 py-1 text-xs" onClick={() => onPageChange(page)}>
            {page}
          </Button>
        ))}
        <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
