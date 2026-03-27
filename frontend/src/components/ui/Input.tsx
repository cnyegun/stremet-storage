'use client';

import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <label className="flex w-full flex-col gap-1 text-xs font-medium text-app-textMuted" htmlFor={id}>
      {label ? <span className="uppercase tracking-wider text-app-text">{label}</span> : null}
      <input
        id={id}
        className={cn(
          'min-h-11 border border-app-border bg-white px-3 py-2 text-sm text-app-text shadow-inset outline-none placeholder:text-gray-400 focus:border-app-primary focus:ring-1 focus:ring-app-primary',
          error && 'border-app-danger',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-app-danger">{error}</span> : null}
    </label>
  );
}
