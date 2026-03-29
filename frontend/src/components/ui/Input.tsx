'use client';

import { useId, type InputHTMLAttributes } from 'react';
import TextField from '@mui/material/TextField';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, id, name, value, onChange, type, placeholder, min, max, disabled }: InputProps) {
  const autoId = useId();
  const resolvedId = id || autoId;
  const resolvedName = name || resolvedId;

  return (
    <TextField
      id={resolvedId}
      name={resolvedName}
      label={label}
      value={value}
      onChange={onChange as any}
      type={type}
      placeholder={placeholder}
      error={Boolean(error)}
      helperText={error || undefined}
      disabled={disabled}
      fullWidth
      slotProps={{ htmlInput: { min, max }, inputLabel: (type === 'date' || type === 'datetime-local') ? { shrink: true } : undefined }}
    />
  );
}
