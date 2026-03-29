'use client';

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import TextField from '@mui/material/TextField';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, id, name, value, onChange, type, placeholder, min, max, disabled }: InputProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputName = name || inputId;

  return (
    <TextField
      id={inputId}
      name={inputName}
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
