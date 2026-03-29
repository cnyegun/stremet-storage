'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getRackMapData } from '@/components/map/api';
import { OccupancyBar } from '@/components/map/OccupancyBar';
import type { MapCell, MapRack } from '@/components/map/types';
import { getOccupancyPalette } from '@/components/map/utils';
import { rackDisplayLabel, toTitleCase } from '@/lib/utils';

function groupCellsByRow(rack: MapRack) {
  const rows = new Map<number, MapCell[]>();
  for (const cell of rack.cells) {
    const current = rows.get(cell.row_number) || [];
    current.push(cell);
    rows.set(cell.row_number, current);
  }

  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rowNumber, cells]) => ({ rowNumber, cells: cells.sort((a, b) => a.column_number - b.column_number) }));
}

export default function RackDetailPage() {
  const params = useParams<{ id: string }>();
  const [rack, setRack] = useState<MapRack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    let active = true;
    void getRackMapData(params.id)
      .then((result) => {
        if (active) setRack(result);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  const rows = useMemo(() => (rack ? groupCellsByRow(rack) : []), [rack]);

  if (!rack) {
    if (error) {
      return <EmptyState title="Unable to load rack" description={error} />;
    }

    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LoadingSpinner />
        <Typography variant="body2" color="text.secondary">Loading rack...</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h3">{rackDisplayLabel(rack)}</Typography>
            <Typography variant="body2" color="text.secondary">{toTitleCase(rack.rack_type)}</Typography>
            {rack.description ? <Typography variant="caption" color="text.secondary">{rack.description}</Typography> : null}
          </Box>
          <Link href={`/check-in?rack=${encodeURIComponent(rack.id)}`} style={{ fontSize: 13, color: '#1565C0' }}>
            Check in to this rack
          </Link>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" mb={1.5}>
          <Typography variant="body2" fontWeight={600}>{rack.row_count} levels</Typography>
          <Typography variant="body2" fontWeight={600}>{rack.column_count} columns</Typography>
          <Typography variant="body2" color="text.secondary">{rack.occupancy_used} / {rack.occupancy_total} capacity used</Typography>
        </Stack>
        <OccupancyBar used={rack.occupancy_used} total={rack.occupancy_total} label="Rack occupancy" />
      </Paper>

      <Paper variant="outlined">
        <TableContainer>
          <MuiTable size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                {Array.from({ length: rack.column_count }, (_, index) => (
                  <TableCell key={index} align="center" sx={{ fontWeight: 700 }}>Col {index + 1}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Lvl {row.rowNumber}</TableCell>
                  {row.cells.map((cell) => {
                    const currentVol = Number(cell.current_volume_m3) || 0;
                    const maxVol = Number(cell.max_volume_m3) || 19.4;
                    const hasMeasuredVolume = currentVol > 0 || cell.current_count === 0;
                    const occupancyUsed = hasMeasuredVolume ? currentVol : cell.current_count;
                    const occupancyTotal = hasMeasuredVolume ? maxVol : Math.max(cell.capacity, cell.current_count, 1);
                    const percentage = Math.round((occupancyUsed / occupancyTotal) * 100);
                    const palette = getOccupancyPalette(occupancyUsed, occupancyTotal);

                    return (
                      <TableCell key={cell.id} sx={{ verticalAlign: 'top', p: 1 }}>
                        <Box sx={{ border: 1, borderColor: palette.border, bgcolor: palette.fill, p: 1, borderRadius: 1, minHeight: 80 }}>
                          <Typography variant="body2" fontWeight={500}>{cell.current_count === 0 ? 'Empty' : `${cell.current_count} items`}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
                            {currentVol.toFixed(1)} / {maxVol.toFixed(1)} m³ ({percentage}%)
                          </Typography>
                          <Stack spacing={0.25} mt={1}>
                            {cell.items.map((item) => (
                              <Link key={item.id} href={item.item_href} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography sx={{ fontSize: '0.7rem', color: 'primary.main', fontWeight: 600 }}>{item.item_code}</Typography>
                              </Link>
                            ))}
                          </Stack>
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </MuiTable>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
