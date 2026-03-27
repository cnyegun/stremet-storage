'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type FilterBarProps = {
  children: ReactNode;
  onClear: () => void;
};

export function FilterBar({ children, onClear }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border border-app-border bg-app-toolbar p-3 shadow-panel lg:flex-row lg:items-end lg:justify-between">
      <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
