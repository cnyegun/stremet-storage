'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import PersonIcon from '@mui/icons-material/PersonOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import type { GlobalSearchResponse } from '@shared/types';
import { useDebouncedValue } from '@/lib/hooks';
import { api } from '@/lib/api';
import { locationLabel, machineCategoryLabel } from '@/lib/utils';

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 200);

  // Build flat list of navigable results for keyboard nav
  const flatResults: Array<{ href: string; label: string }> = [];
  if (results) {
    for (const item of results.items) flatResults.push({ href: `/items/${item.id}`, label: item.item_code });
    for (const m of results.machines) flatResults.push({ href: `/machines/${m.id}`, label: m.code });
    for (const c of results.customers) flatResults.push({ href: `/items?search=${encodeURIComponent(c.name)}`, label: c.name });
    for (const loc of results.locations) flatResults.push({ href: `/racks/${loc.rack_id}`, label: loc.rack_code });
  }

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    setSelectedIndex(-1);
    router.push(href);
  }, [router]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    void api.globalSearch(debouncedQuery.trim())
      .then((r) => {
        setResults(r.data);
        setOpen(true);
        setSelectedIndex(-1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || flatResults.length === 0) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      navigate(flatResults[selectedIndex].href);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // Keyboard shortcut: focus search on "/" or Ctrl+K
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const hasResults = results && (results.items.length > 0 || results.customers.length > 0 || results.locations.length > 0 || results.machines.length > 0);
  const noResults = results && !hasResults;

  let flatIndex = -1;

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} sx={{ position: 'relative', flex: 1, maxWidth: 420, minWidth: 180 }}>
        <Box
          component="input"
          ref={inputRef}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search items, machines, customers...  (/)"
          sx={{
            width: '100%',
            height: 32,
            px: 1.5,
            pl: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 0.75,
            bgcolor: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            outline: 'none',
            '&::placeholder': { color: 'rgba(255,255,255,0.4)' },
            '&:focus': { bgcolor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.35)' },
          }}
        />
        <SearchIcon sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />

        <Popper open={open && query.trim().length > 0} anchorEl={anchorRef.current} placement="bottom-start" sx={{ zIndex: 1300, width: anchorRef.current?.offsetWidth || 400, minWidth: 360 }}>
          <Paper variant="outlined" sx={{ mt: 0.5, maxHeight: 420, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            {loading && !results ? (
              <Box px={2} py={1.5}>
                <Typography variant="body2" color="text.secondary">Searching...</Typography>
              </Box>
            ) : noResults ? (
              <Box px={2} py={1.5}>
                <Typography variant="body2" color="text.secondary">No results for &quot;{query}&quot;</Typography>
              </Box>
            ) : hasResults ? (
              <>
                {results.items.length > 0 ? (
                  <Box>
                    <Box px={2} pt={1.5} pb={0.5}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</Typography>
                    </Box>
                    {results.items.map((item) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <Box
                          key={item.id}
                          onClick={() => navigate(`/items/${item.id}`)}
                          sx={{
                            px: 2, py: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                            bgcolor: selectedIndex === idx ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <InventoryIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={600} noWrap>{item.item_code}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{item.name}{item.customer_name ? ` — ${item.customer_name}` : ''}</Typography>
                          </Box>
                          {item.current_location ? (
                            <Typography variant="caption" fontFamily="monospace" color="primary.main" flexShrink={0}>
                              {locationLabel(item.current_location)}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.disabled" flexShrink={0}>Not stored</Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}

                {results.machines.length > 0 ? (
                  <Box>
                    <Divider />
                    <Box px={2} pt={1.5} pb={0.5}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Machines</Typography>
                    </Box>
                    {results.machines.map((m) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <Box
                          key={m.id}
                          onClick={() => navigate(`/machines/${m.id}`)}
                          sx={{
                            px: 2, py: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                            bgcolor: selectedIndex === idx ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <PrecisionManufacturingIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontFamily="monospace" fontWeight={600} noWrap>{m.code}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{m.name} — {machineCategoryLabel(m.category)}</Typography>
                          </Box>
                          {m.active_volume > 0 ? (
                            <Typography variant="caption" color="text.secondary" flexShrink={0}>{m.active_volume.toFixed(1)} m³ active</Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}

                {results.customers.length > 0 ? (
                  <Box>
                    <Divider />
                    <Box px={2} pt={1.5} pb={0.5}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customers</Typography>
                    </Box>
                    {results.customers.map((c) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <Box
                          key={c.id}
                          onClick={() => navigate(`/items?search=${encodeURIComponent(c.name)}`)}
                          sx={{
                            px: 2, py: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                            bgcolor: selectedIndex === idx ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontWeight={600} noWrap>{c.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{c.code}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" flexShrink={0}>{c.volume_in_storage.toFixed(1)} m³ in storage</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}

                {results.locations.length > 0 ? (
                  <Box>
                    <Divider />
                    <Box px={2} pt={1.5} pb={0.5}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Racks</Typography>
                    </Box>
                    {results.locations.map((loc) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <Box
                          key={loc.rack_id}
                          onClick={() => navigate(`/racks/${loc.rack_id}`)}
                          sx={{
                            px: 2, py: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                            bgcolor: selectedIndex === idx ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <PlaceIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontWeight={600} noWrap>{loc.rack_code}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{loc.rack_label}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" flexShrink={0}>{loc.volume_stored.toFixed(1)} m³ stored</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}
              </>
            ) : null}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
