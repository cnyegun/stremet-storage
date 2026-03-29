'use client';

import { useId, type SelectHTMLAttributes } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

type Option = { label: string; value: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
};

export function Select({ label, id, name, options, value, onChange }: SelectProps) {
  const autoId = useId();
  const resolvedId = id || autoId;
  const resolvedName = name || resolvedId;

  return (
    <TextField
      id={resolvedId}
      name={resolvedName}
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
