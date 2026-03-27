'use client';

import { Input } from '@/components/ui/Input';

interface MapSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MapSearch({ value, onChange }: MapSearchProps) {
  return (
    <div className="min-w-[280px] flex-1">
      <Input
        id="map-search"
        label="Quick search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find item code, item name, or customer"
      />
    </div>
  );
}
