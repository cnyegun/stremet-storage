const STANDARD_MAX_VOLUME = 19.4;

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getOccupancyRatio(used: number | string, total: number | string) {
  const usedValue = toNumber(used);
  const totalValue = toNumber(total) || STANDARD_MAX_VOLUME;

  if (!totalValue) {
    return 0;
  }

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

  if (state === 'danger') {
    return {
      border: '#DC2626',
      fill: '#FEE2E2',
      accent: '#B91C1C',
    };
  }

  if (state === 'warning') {
    return {
      border: '#D97706',
      fill: '#FEF3C7',
      accent: '#B45309',
    };
  }

  if (state === 'empty') {
    return {
      border: '#D1D5DB',
      fill: '#F9FAFB',
      accent: '#6B7280',
    };
  }

  return {
    border: '#16A34A',
    fill: '#DCFCE7',
    accent: '#166534',
  };
}
