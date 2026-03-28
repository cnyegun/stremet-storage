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
import { toTitleCase } from '@/lib/utils';

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
            <Typography variant="h3">{rack.code}</Typography>
            <Typography variant="body2" color="text.secondary">{rack.label} • {toTitleCase(rack.rack_type)}</Typography>
            {rack.description ? <Typography variant="caption" color="text.secondary">{rack.description}</Typography> : null}
          </Box>
          <Link href={`/check-in?rack=${encodeURIComponent(rack.id)}`} style={{ fontSize: 13, color: '#1565C0' }}>
            Check in to this rack
          </Link>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" mb={1.5}>
          <Typography variant="body2">{rack.row_count} rows</Typography>
          <Typography variant="body2">{rack.column_count} columns</Typography>
          <Typography variant="body2">{rack.occupancy_used}/{rack.occupancy_total} capacity used</Typography>
        </Stack>
        <OccupancyBar used={rack.occupancy_used} total={rack.occupancy_total} />
      </Paper>

      <Paper variant="outlined">
        <TableContainer>
          <MuiTable size="small">
            <TableHead>
              <TableRow>
                <TableCell>Row</TableCell>
                {Array.from({ length: rack.column_count }, (_, index) => (
                  <TableCell key={index}>Column {index + 1}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell sx={{ fontWeight: 500 }}>Row {row.rowNumber}</TableCell>
                  {row.cells.map((cell) => {
                    const palette = getOccupancyPalette(cell.current_count, cell.capacity);

                    return (
                      <TableCell key={cell.id} sx={{ verticalAlign: 'top' }}>
                        <Box sx={{ border: 1, borderColor: palette.border, bgcolor: palette.fill, p: 1, borderRadius: 1 }}>
                          <Typography variant="body2" fontWeight={500}>{cell.current_count === 0 ? 'Empty' : `${cell.current_count} items`}</Typography>
                          <Typography variant="caption" color="text.secondary">{cell.current_count}/{cell.capacity}</Typography>
                          <Stack spacing={0.5} mt={1}>
                            {cell.items.map((item) => (
                              <Link key={item.id} href={item.item_href} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Typography variant="caption" color="primary">{item.item_code}</Typography>
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
