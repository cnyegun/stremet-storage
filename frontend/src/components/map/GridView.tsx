'use client';

import { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { EmptyState } from '@/components/ui/EmptyState';
import { rackDisplayLabel } from '@/lib/utils';
import type { MapCell, MapRack } from './types';
import { OccupancyBar } from './OccupancyBar';
import { getOccupancyPalette } from './utils';

interface GridViewProps {
  racks: MapRack[];
}

function groupCellsByRow(rack: MapRack) {
  const rows = new Map<number, MapCell[]>();
  for (const cell of rack.cells) {
    const existing = rows.get(cell.row_number) || [];
    existing.push(cell);
    rows.set(cell.row_number, existing);
  }
  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rowNumber, cells]) => {
      const byColumn = new Map(cells.map((cell) => [cell.column_number, cell]));
      return {
        rowNumber,
        cells: Array.from({ length: rack.column_count }, (_, index) => byColumn.get(index + 1)).filter((cell): cell is MapCell => Boolean(cell)),
      };
    });
}

export function GridView({ racks }: GridViewProps) {
  const [expandedRackIds, setExpandedRackIds] = useState<string[]>(racks.map((rack) => rack.id));
  const [expandedCellId, setExpandedCellId] = useState<string | null>(null);

  function toggleRack(rackId: string) {
    setExpandedRackIds((current) => (current.includes(rackId) ? current.filter((id) => id !== rackId) : [...current, rackId]));
  }

  function renderCell(cell: MapCell) {
    const expanded = expandedCellId === cell.id;
    const palette = getOccupancyPalette(cell.current_count, cell.capacity);

    return (
      <TableCell key={cell.id} sx={{ verticalAlign: 'top', bgcolor: 'background.paper', p: 1 }}>
        <Box
          onClick={() => setExpandedCellId((current) => (current === cell.id ? null : cell.id))}
          sx={{ cursor: 'pointer', border: 1, p: 1, borderColor: palette.border, bgcolor: palette.fill, borderRadius: 1 }}
        >
          <OccupancyBar used={cell.current_volume_m3} total={cell.max_volume_m3} compact />
        </Box>
        <Collapse in={expanded}>
          <Stack spacing={0.5} mt={1}>
            {cell.items.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Empty cell.</Typography>
            ) : (
              cell.items.map((item) => (
                <Link key={item.id} href={item.item_href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Typography variant="body2" fontWeight={700} color="primary" sx={{ fontSize: '0.75rem' }}>{item.item_code}</Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{item.volume_m3?.toFixed(2)} m³</Typography>
                  </Box>
                </Link>
              ))
            )}
          </Stack>
        </Collapse>
      </TableCell>
    );
  }

  if (racks.length === 0) {
    return <EmptyState title="No racks available" description="Storage racks are not available yet." />;
  }

  return (
    <Stack spacing={2}>
      {racks.map((rack) => {
        const expanded = expandedRackIds.includes(rack.id);
        const rows = groupCellsByRow(rack);

        return (
          <Paper key={rack.id} variant="outlined">
            <Box onClick={() => toggleRack(rack.id)} sx={{ p: 2, cursor: 'pointer', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
              <Box flex={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>{rackDisplayLabel(rack)}</Typography>
                    <Typography variant="caption" color="text.secondary">Standard rack · {rack.row_count}x{rack.column_count} grid</Typography>
                  </Box>
                  <Link href={`/racks/${rack.id}`} style={{ fontSize: 13, color: '#1565C0', fontWeight: 600 }}>Inspect Rack</Link>
                </Stack>
                <OccupancyBar used={rack.occupancy_used} total={rack.occupancy_total} label="Rack occupancy" />
              </Box>
            </Box>
            <Collapse in={expanded}>
              <TableContainer>
                <MuiTable size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ width: 80, fontWeight: 700 }}>Row</TableCell>
                      {Array.from({ length: 10 }, (_, i) => (
                        <TableCell key={i} align="center" sx={{ fontWeight: 700 }}>Col {i + 1}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>Lvl {row.rowNumber}</TableCell>
                        {row.cells.map(renderCell)}
                      </TableRow>
                    ))}
                  </TableBody>
                </MuiTable>
              </TableContainer>
            </Collapse>
          </Paper>
        );
      })}
    </Stack>
  );
}
