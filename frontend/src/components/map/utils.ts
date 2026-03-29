function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const STANDARD_MAX_VOLUME = 19.4;

export function getOccupancyRatio(used: number | string, total: number | string) {
  const usedValue = toNumber(used);
  // Use user-specified standard volume as default if total is not provided or 0
  const totalValue = toNumber(total) || STANDARD_MAX_VOLUME;

  return usedValue / totalValue;
}

export function getOccupancyState(used: number | string, total: number | string) {
  const ratio = getOccupancyRatio(used, total);

  if (ratio === 0) {
    return 'empty';
  }

  if (ratio > 0.85) {
    return 'danger';
  }

  if (ratio > 0.5) {
    return 'warning';
  }

  return 'success';
}

export function getOccupancyPalette(used: number | string, total: number | string) {
  const state = getOccupancyState(used, total);

  if (state === 'empty') {
    return {
      border: '#E5E7EB',
      fill: '#F9FAFB', // Very light gray for 0%
      accent: '#9CA3AF',
    };
  }

  if (state === 'danger') {
    return {
      border: '#DC2626',
      fill: '#FEE2E2', // Red for 86% - 100%+
      accent: '#B91C1C',
    };
  }

  if (state === 'warning') {
    return {
      border: '#D97706',
      fill: '#FEF3C7', // Yellow/Orange for 51% - 85%
      accent: '#B45309',
    };
  }

  return {
    border: '#16A34A',
    fill: '#DCFCE7', // Green for 1% - 50%
    accent: '#166534',
  };
}

