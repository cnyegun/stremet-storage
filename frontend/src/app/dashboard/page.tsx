'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import type { DashboardData } from '@shared/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import { actionLabel, formatDateTime, machineCategoryLabel } from '@/lib/utils';

// --- Colors ---
const COLORS = {
  blue: '#1565C0',
  green: '#2E7D32',
  amber: '#E65100',
  red: '#C62828',
  teal: '#00796B',
  purple: '#6A1B9A',
  grey: '#546E7A',
  lightBlue: '#42A5F5',
};

const PIE_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#00796B', '#6A1B9A', '#C62828', '#546E7A', '#42A5F5', '#D84315', '#1B5E20'];

// --- Small components ---

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h1" sx={{ mt: 0.5, color: color || 'text.primary' }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

function SectionHeader({ title, linkHref, linkLabel }: { title: string; linkHref?: string; linkLabel?: string }) {
  return (
    <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="subtitle1">{title}</Typography>
      {linkHref && <Link href={linkHref} style={{ fontSize: 12, color: '#1565C0', fontWeight: 600 }}>{linkLabel || 'View all'}</Link>}
    </Box>
  );
}

function activityChipColor(action: string) {
  switch (action) {
    case 'check_in': return 'success';
    case 'check_out': return 'warning';
    case 'move': return 'info';
    default: return 'default';
  }
}

// --- Chart tooltip style ---
const tooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 3, border: '1px solid #B0BEC5', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  labelStyle: { fontWeight: 700, fontSize: 12 },
};

// --- Page ---

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.getDashboard()
      .then((res) => { if (active) setData(res.data); })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  if (!data) {
    if (error) return <EmptyState title="Unable to load dashboard" description={error} />;
    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LoadingSpinner />
        <Typography variant="body2" color="text.secondary">Loading dashboard...</Typography>
      </Paper>
    );
  }

  const { stats, recent_activity, customer_breakdown, machines, aging, daily_activity, rack_occupancy, material_breakdown } = data;

  const totalActivity = daily_activity.reduce((sum, d) => sum + d.total, 0);
  const totalCheckIns = daily_activity.reduce((sum, d) => sum + d.check_ins, 0);
  const totalCheckOuts = daily_activity.reduce((sum, d) => sum + d.check_outs, 0);

  const machinesNeedingAttention = machines.filter((m) => m.needs_attention > 0);

  // Prepare chart data
  const activityChartData = daily_activity.map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    'Check-ins': d.check_ins,
    'Check-outs': d.check_outs,
    'Moves': d.moves,
  }));

  const rackChartData = rack_occupancy.map((r) => ({
    name: r.code,
    used: r.used_cells,
    empty: r.total_cells - r.used_cells,
    items: r.item_count,
  }));

  const customerChartData = customer_breakdown.map((c) => ({
    name: c.customer_code,
    fullName: c.customer_name,
    value: c.total_quantity,
  }));

  const materialChartData = material_breakdown.map((m) => ({
    name: m.material,
    value: m.total_quantity,
  }));

  const agingChartData = [
    { name: '< 14 days', value: aging.total_active - aging.over_14_days, color: COLORS.green },
    { name: '14-30 days', value: aging.over_14_days - aging.over_30_days, color: COLORS.amber },
    { name: '30-60 days', value: aging.over_30_days - aging.over_60_days, color: COLORS.red },
    { name: '> 60 days', value: aging.over_60_days, color: COLORS.purple },
  ].filter((d) => d.value > 0);

  return (
    <Stack spacing={2}>
      <Typography variant="h3">Dashboard</Typography>

      {/* Key metrics */}
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <StatCard label="Total items in storage" value={stats.total_items_stored} sub={`across ${stats.slots_in_use} cells`} />
        <StatCard label="Warehouse occupancy" value={`${stats.occupancy_percent}%`} color={stats.occupancy_percent >= 90 ? COLORS.red : stats.occupancy_percent >= 70 ? COLORS.amber : COLORS.green} sub={`${stats.volume_stored.toFixed(1)} / ${stats.total_capacity.toFixed(1)} m\u00B3`} />
        <StatCard label="Storage cells" value={`${stats.slots_in_use} / ${stats.total_slots}`} sub={`${stats.total_slots - stats.slots_in_use} available`} />
        <StatCard label="Activity (30 days)" value={totalActivity} sub={`${totalCheckIns} in \u00B7 ${totalCheckOuts} out`} />
      </Stack>

      {/* Alerts row */}
      {(aging.over_30_days > 0 || machinesNeedingAttention.length > 0) && (
        <Stack direction="row" flexWrap="wrap" gap={1.5}>
          {aging.over_30_days > 0 && (
            <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 200, borderColor: 'warning.main', borderLeftWidth: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                <Typography variant="subtitle1">Aging items</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                <strong>{aging.over_30_days}</strong> items in storage over 30 days
                {aging.over_60_days > 0 && <> ({aging.over_60_days} over 60 days)</>}
              </Typography>
            </Paper>
          )}
          {machinesNeedingAttention.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 200, borderColor: 'error.main', borderLeftWidth: 3 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <WarningAmberIcon sx={{ fontSize: 18, color: 'error.main' }} />
                <Typography variant="subtitle1">Machines need attention</Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {machinesNeedingAttention.map((m) => (
                  <span key={m.id}>
                    <Link href={`/machines/${m.id}`} style={{ color: '#1565C0' }}>{m.code}</Link>
                    {' '}({m.needs_attention} items){' '}
                  </span>
                ))}
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {/* Activity trend chart — full width */}
      {activityChartData.length > 0 && (
        <Paper variant="outlined">
          <SectionHeader title="Activity trend (30 days)" linkHref="/activity" />
          <Box sx={{ p: 2, height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFD8DC" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Check-ins" stackId="1" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.3} />
                <Area type="monotone" dataKey="Check-outs" stackId="1" stroke={COLORS.amber} fill={COLORS.amber} fillOpacity={0.3} />
                <Area type="monotone" dataKey="Moves" stackId="1" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* Rack occupancy bar chart + pie charts row */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
        {/* Rack occupancy */}
        <Paper variant="outlined" sx={{ flex: 2, minWidth: 0 }}>
          <SectionHeader title="Rack occupancy (cells used)" linkHref="/" linkLabel="Storage grid" />
          <Box sx={{ p: 2, height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rackChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFD8DC" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="used" name="Used cells" stackId="a" fill={COLORS.blue} radius={[0, 0, 0, 0]} />
                <Bar dataKey="empty" name="Empty cells" stackId="a" fill="#CFD8DC" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Item aging donut */}
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 260 }}>
          <SectionHeader title="Item aging" />
          <Box sx={{ p: 2, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {agingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agingChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    style={{ fontSize: 11 }}
                  >
                    {agingChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="caption" color="text.secondary">No active items</Typography>
            )}
          </Box>
        </Paper>
      </Stack>

      {/* Customer + Material pie charts */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
        {/* Items by customer */}
        <Paper variant="outlined" sx={{ flex: 1 }}>
          <SectionHeader title="Items by customer (quantity)" />
          <Box sx={{ p: 2, height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerChartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFD8DC" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, _name, props) => [`${value} units`, (props as unknown as { payload: { fullName: string } }).payload.fullName]}
                />
                <Bar dataKey="value" name="Quantity" fill={COLORS.blue} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Material breakdown */}
        <Paper variant="outlined" sx={{ flex: 1 }}>
          <SectionHeader title="Material breakdown" />
          <Box sx={{ p: 2, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={materialChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={(props: any) => `${props.name} (${((props.percent ?? 0) * 100).toFixed(0)}%)`}
                  style={{ fontSize: 10 }}
                >
                  {materialChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Stack>

      {/* Two-column layout: recent activity + tables */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>

        {/* Recent activity */}
        <Paper variant="outlined" sx={{ flex: 2, minWidth: 0 }}>
          <SectionHeader title="Recent activity" linkHref="/activity" />
          <TableContainer>
            <MuiTable size="small">
              <TableBody>
                {recent_activity.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell sx={{ width: 110 }}>
                      <Typography variant="caption">{formatDateTime(entry.created_at)}</Typography>
                    </TableCell>
                    <TableCell sx={{ width: 90 }}>
                      <Chip label={actionLabel(entry.action)} size="small" color={activityChipColor(entry.action) as any} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Link href={`/items/${entry.item_id}`} style={{ color: '#1565C0', fontSize: 13 }}>{entry.item_code}</Link>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{entry.item_name}</Typography>
                    </TableCell>
                    <TableCell sx={{ width: 100 }}>
                      <Typography variant="caption">{entry.performed_by}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </MuiTable>
          </TableContainer>
        </Paper>

        {/* Right column: machines */}
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 260 }}>
          <SectionHeader title="Machines" linkHref="/machines" />
          <TableContainer>
            <MuiTable size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Machine</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {machines.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link href={`/machines/${m.id}`} style={{ color: '#1565C0', textDecoration: 'none' }}>
                        <Typography variant="body2" fontWeight={600}>{m.code}</Typography>
                      </Link>
                      <Typography variant="caption" color="text.secondary">{machineCategoryLabel(m.category)}</Typography>
                    </TableCell>
                    <TableCell align="right">{m.active_items}</TableCell>
                    <TableCell align="right">
                      {m.needs_attention > 0 ? (
                        <Chip label={`${m.needs_attention} alert`} size="small" color="error" variant="outlined" />
                      ) : m.active_items > 0 ? (
                        <Chip label="Active" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip label="Idle" size="small" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </MuiTable>
          </TableContainer>
        </Paper>
      </Stack>
    </Stack>
  );
}
