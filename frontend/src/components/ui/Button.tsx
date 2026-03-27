'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  className,
  variant = 'primary',
  fullWidth,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center border px-5 py-2 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-app-primaryHover bg-app-primary text-white hover:bg-app-primaryHover active:bg-blue-900',
        variant === 'secondary' && 'border-app-border bg-white text-app-text hover:bg-app-panelMuted active:bg-gray-200',
        variant === 'danger' && 'border-red-800 bg-app-danger text-white hover:bg-red-800 active:bg-red-900',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
