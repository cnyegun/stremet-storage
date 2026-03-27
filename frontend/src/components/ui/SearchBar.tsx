'use client';

import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/lib/hooks';

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
};

export function SearchBar({ placeholder = 'Search', value = '', onChange }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, 250);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (debouncedValue === value) {
      return;
    }

    onChange(debouncedValue);
  }, [debouncedValue, onChange, value]);

  return (
    <label className="flex min-h-11 items-center gap-2 border border-app-border bg-white px-3 py-2 shadow-inset focus-within:border-app-primary">
      <span className="text-xs font-medium uppercase tracking-wider text-app-textMuted">Search</span>
      <input
        className="w-full border-0 bg-transparent text-sm text-app-text outline-none placeholder:text-gray-400"
        placeholder={placeholder}
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
      />
    </label>
  );
}
