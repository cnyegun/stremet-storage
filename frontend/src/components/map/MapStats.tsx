import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { MapStatsData } from './types';

interface MapStatsProps {
  stats: MapStatsData;
}

export function MapStats({ stats }: MapStatsProps) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip label={`${Number(stats.total_volume_stored).toFixed(1)} m³ stored`} size="small" variant="outlined" />
      <Chip label={`${stats.occupied_slots}/${stats.total_slots} cells occupied`} size="small" variant="outlined" />
      <Chip label={`${stats.available_slots} available`} size="small" color="success" variant="outlined" />
    </Stack>
  );
}
