'use client';

import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Option = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
};

export function Select({ label, className, id, options, ...props }: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-1 text-xs font-medium text-app-textMuted" htmlFor={id}>
      {label ? <span className="uppercase tracking-wider text-app-text">{label}</span> : null}
      <select
        id={id}
        className={cn(
          'min-h-11 border border-app-border bg-white px-3 py-2 text-sm text-app-text shadow-inset outline-none focus:border-app-primary focus:ring-1 focus:ring-app-primary',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
