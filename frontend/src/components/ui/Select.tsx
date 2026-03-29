'use client';

import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

type Option = { label: string; value: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
};

export function Select({ label, id, name, options, value, onChange }: SelectProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputName = name || inputId;

  return (
    <TextField
      id={inputId}
      name={inputName}
      label={label}
      value={value ?? ''}
      onChange={onChange as any}
      select
      fullWidth
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
