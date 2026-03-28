'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useWorkerSession } from '@/components/ui/WorkerSession';
import { api } from '@/lib/api';
import { resizeImage } from '@/lib/resizeImage';
import type { ActionProposal } from '@shared/types';

// Inline SVG icons to avoid @mui/icons-material dependency issues
function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
    </svg>
  );
}

type ActionStatus = 'pending' | 'executing' | 'done' | 'error' | 'cancelled';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  action?: ActionProposal;
  actionStatus?: ActionStatus;
  actionError?: string;
}

let messageIdCounter = 0;
function nextId() { return ++messageIdCounter; }

function renderMarkdown(text: string): string {
  // Sanitize HTML tags
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headings: ## heading
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Markdown tables
  html = html.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, header: string, _sep: string, body: string) => {
    const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row: string) => {
      const tds = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Unordered lists: - item or * item
  html = html.replace(/^((?:[\t ]*[-*] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line => `<li>${line.replace(/^[\t ]*[-*] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Paragraphs: split by double newline
  html = html.split(/\n{2,}/).map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-3]|ul|ol|table|li)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

const ACTION_COLORS = {
  check_in: { bg: '#e8f5e9', border: '#4caf50', label: 'Check in', icon: '+' },
  check_out: { bg: '#fff3e0', border: '#ff9800', label: 'Check out', icon: '-' },
  move: { bg: '#e3f2fd', border: '#1565C0', label: 'Move', icon: '\u2192' },
} as const;

function getActionDetails(action: ActionProposal): { label: string; rows: [string, string][] } {
  switch (action.action) {
    case 'check_in':
      return {
        label: 'Check in',
        rows: [
          ['Item', action.item_code],
          ['To', action.location],
          ['Quantity', String(action.quantity)],
          ...(action.notes ? [['Notes', action.notes] as [string, string]] : []),
        ],
      };
    case 'check_out': {
      const coRows: [string, string][] = [
        ['Item', action.item_code],
        ['Unit', action.unit_code],
        ['From', action.location],
        ['Source', action.source_type],
      ];
      if (action.notes) coRows.push(['Notes', action.notes]);
      return { label: 'Check out', rows: coRows };
    }
    case 'move': {
      const mvRows: [string, string][] = [
        ['Unit', action.unit_code],
        ['From', action.from],
        ['To', action.to],
        ['Quantity', action.quantity ? String(action.quantity) : 'All'],
      ];
      if (action.notes) mvRows.push(['Notes', action.notes]);
      return { label: 'Move', rows: mvRows };
    }
  }
}

export function SannaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { workerName } = useWorkerSession();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const updateMessage = useCallback((id: number, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const handleConfirm = useCallback(async (msg: Message) => {
    if (!msg.action || !workerName) return;
    updateMessage(msg.id, { actionStatus: 'executing' });

    try {
      const action = msg.action;
      let successText = '';

      if (action.action === 'check_in') {
        const res = await api.checkInItem({
          item_id: action.item_id,
          shelf_slot_id: action.shelf_slot_id,
          quantity: action.quantity,
          checked_in_by: workerName,
          notes: action.notes,
        });
        successText = `Checked in ${res.data.unit_code} to ${res.data.location}`;
      } else if (action.action === 'check_out') {
        const res = await api.checkOutItem({
          assignment_id: action.assignment_id,
          source_type: action.source_type,
          checked_out_by: workerName,
          notes: action.notes,
        });
        successText = `Checked out ${res.data.unit_code} from ${res.data.location}`;
      } else if (action.action === 'move') {
        const res = await api.moveItem({
          assignment_id: action.assignment_id,
          source_type: action.source_type,
          to_shelf_slot_id: action.to_shelf_slot_id,
          to_machine_id: action.to_machine_id,
          performed_by: workerName,
          quantity: action.quantity,
          notes: action.notes,
        });
        successText = `Moved ${res.data.unit_code} from ${res.data.from} to ${res.data.to} (${res.data.quantity_moved} pcs)`;
      }

      updateMessage(msg.id, { actionStatus: 'done' });
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: successText }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Action failed';
      updateMessage(msg.id, { actionStatus: 'error', actionError: errorMsg });
    }
  }, [workerName, updateMessage]);

  const handleCancel = useCallback((msg: Message) => {
    updateMessage(msg.id, { actionStatus: 'cancelled' });
  }, [updateMessage]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setPendingImage(dataUrl);
    } catch {
      // silently fail — worker can retry
    }
    // reset so same file can be selected again
    e.target.value = '';
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !pendingImage) return;
    if (loading) return;

    const userMsg: Message = { id: nextId(), role: 'user', content: trimmed || '(photo)', imageBase64: pendingImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const imageToSend = pendingImage;
    setPendingImage(null);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.sendAssistantMessage({
        message: trimmed,
        imageBase64: imageToSend || undefined,
        history,
        workerName: workerName || undefined,
      });
      const d = res.data;
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: d.message,
        sql: d.sql,
        data: d.data,
        rowCount: d.rowCount,
        action: d.action,
        actionStatus: d.action ? 'pending' : undefined,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: `Sorry, something went wrong. ${err instanceof Error ? err.message : 'Please try again.'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      {!open && (
        <Fab
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1300,
            bgcolor: '#1565C0',
            color: '#fff',
            width: 56,
            height: 56,
            '&:hover': { bgcolor: '#0d47a1' },
          }}
        >
          <ChatIcon />
        </Fab>
      )}

      {/* Chat panel */}
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: { xs: 'calc(100vw - 48px)', sm: 480 },
            height: { xs: 'calc(100vh - 100px)', sm: 620 },
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{
            bgcolor: '#263238',
            color: '#fff',
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #1565C0',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: '#1565C0',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}>
                S
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>Sanna</Typography>
                <Typography sx={{ fontSize: 10, opacity: 0.6, lineHeight: 1 }}>Warehouse assistant</Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1.5,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            bgcolor: '#f5f5f5',
          }}>
            {messages.length === 0 && !loading && (
              <Box sx={{ textAlign: 'center', mt: 4, opacity: 0.5 }}>
                <Typography sx={{ fontSize: 13, mb: 0.5 }}>Ask me about the warehouse</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  &quot;Where is KONE-001-PANEL-A?&quot;
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  &quot;Move the Kone panels to laser cutter 1&quot;
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  &quot;Check out VALM-003 from Zone D&quot;
                </Typography>
              </Box>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            ))}

            {loading && (
              <Box sx={{
                alignSelf: 'flex-start',
                bgcolor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px 12px 12px 2px',
                px: 1.5,
                py: 1,
                maxWidth: '85%',
              }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Sanna is thinking
                  <ThinkingDots />
                </Typography>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Image preview */}
          {pendingImage && (
            <Box sx={{ px: 1, pt: 0.5, bgcolor: '#fff', borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                <img src={pendingImage} alt="Pending" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e0e0e0' }} />
                <IconButton
                  size="small"
                  onClick={() => setPendingImage(null)}
                  sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, bgcolor: '#fff', border: '1px solid #ccc', '&:hover': { bgcolor: '#f5f5f5' } }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Photo attached</Typography>
            </Box>
          )}

          {/* Input */}
          <Box sx={{
            p: 1,
            borderTop: pendingImage ? 'none' : '1px solid #e0e0e0',
            bgcolor: '#fff',
            display: 'flex',
            gap: 0.5,
            alignItems: 'flex-end',
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              sx={{ color: '#757575', '&:hover': { color: '#1565C0' } }}
            >
              <CameraIcon />
            </IconButton>
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder={pendingImage ? 'Add a message or just send the photo...' : 'Ask Sanna...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              multiline
              maxRows={3}
              sx={{
                '& .MuiInputBase-root': { fontSize: 13, py: 0.5 },
                '& .MuiOutlinedInput-root': { borderRadius: '8px' },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={loading || (!input.trim() && !pendingImage)}
              sx={{
                color: '#1565C0',
                '&.Mui-disabled': { color: '#bdbdbd' },
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
}

function ThinkingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <span style={{ display: 'inline-block', width: 16 }}>{dots}</span>;
}

function ActionCard({ action, status, error, onConfirm, onCancel }: {
  action: ActionProposal;
  status: ActionStatus;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = ACTION_COLORS[action.action];
  const details = getActionDetails(action);
  const isDone = status === 'done';
  const isCancelled = status === 'cancelled';
  const isError = status === 'error';
  const isExecuting = status === 'executing';
  const isPending = status === 'pending';

  return (
    <Box sx={{
      mt: 0.5,
      border: `1.5px solid ${isCancelled ? '#bdbdbd' : colors.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      opacity: isCancelled ? 0.5 : 1,
    }}>
      {/* Header */}
      <Box sx={{
        bgcolor: isCancelled ? '#e0e0e0' : colors.bg,
        px: 1.5,
        py: 0.6,
        display: 'flex',
        alignItems: 'center',
        gap: 0.8,
        borderBottom: `1px solid ${isCancelled ? '#bdbdbd' : colors.border}`,
      }}>
        <Box sx={{
          width: 20,
          height: 20,
          borderRadius: '4px',
          bgcolor: isCancelled ? '#9e9e9e' : colors.border,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {colors.icon}
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{details.label}</Typography>
        {isDone && <Typography sx={{ fontSize: 10, color: '#4caf50', fontWeight: 600, ml: 'auto' }}>Done</Typography>}
        {isCancelled && <Typography sx={{ fontSize: 10, color: '#9e9e9e', ml: 'auto' }}>Cancelled</Typography>}
        {isError && <Typography sx={{ fontSize: 10, color: '#d32f2f', fontWeight: 600, ml: 'auto' }}>Failed</Typography>}
      </Box>

      {/* Details */}
      <Box sx={{ px: 1.5, py: 0.8, bgcolor: '#fff' }}>
        {details.rows.map(([label, value]) => (
          <Box key={label} sx={{ display: 'flex', gap: 1, py: 0.15 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 56 }}>{label}</Typography>
            <Typography sx={{ fontSize: 11, fontFamily: 'Roboto Mono, monospace', fontWeight: 500 }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* Error message */}
      {isError && error && (
        <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#ffebee' }}>
          <Typography sx={{ fontSize: 11, color: '#d32f2f' }}>{error}</Typography>
        </Box>
      )}

      {/* Buttons */}
      {(isPending || isExecuting) && (
        <Box sx={{
          px: 1.5,
          py: 0.8,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          borderTop: '1px solid #e0e0e0',
          bgcolor: '#fafafa',
        }}>
          <MuiButton
            variant="outlined"
            onClick={onCancel}
            disabled={isExecuting}
            sx={{ fontSize: 11, py: 0.25, px: 1.2, minWidth: 0, textTransform: 'none' }}
          >
            Cancel
          </MuiButton>
          <MuiButton
            variant="contained"
            onClick={onConfirm}
            disabled={isExecuting}
            sx={{ fontSize: 11, py: 0.25, px: 1.2, minWidth: 0, textTransform: 'none' }}
          >
            {isExecuting ? 'Executing...' : 'Confirm'}
          </MuiButton>
        </Box>
      )}
    </Box>
  );
}

function MessageBubble({ message, onConfirm, onCancel }: {
  message: Message;
  onConfirm: (msg: Message) => void;
  onCancel: (msg: Message) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <Box sx={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      <Box sx={{
        bgcolor: isUser ? '#1565C0' : '#fff',
        color: isUser ? '#fff' : '#111827',
        border: isUser ? 'none' : '1px solid #e0e0e0',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        px: 1.5,
        py: 1,
      }}>
        {isUser ? (
          <Box>
            {message.imageBase64 && (
              <img src={message.imageBase64} alt="Sent" style={{ maxWidth: 200, borderRadius: 6, display: 'block', marginBottom: 4 }} />
            )}
            {message.content && message.content !== '(photo)' && (
              <Typography sx={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.content}
              </Typography>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              fontSize: 12.5,
              lineHeight: 1.6,
              wordBreak: 'break-word',
              '& p': { m: 0, mb: 0.5 },
              '& p:last-child': { mb: 0 },
              '& ul, & ol': { m: 0, pl: 2, mb: 0.5 },
              '& li': { mb: 0.2 },
              '& strong': { fontWeight: 600 },
              '& em': { fontStyle: 'italic' },
              '& h1,& h2,& h3': { fontSize: 13, fontWeight: 700, mt: 0.5, mb: 0.3 },
              '& code': { fontFamily: 'Roboto Mono, monospace', fontSize: 11, bgcolor: '#f0f0f0', px: 0.4, borderRadius: '2px' },
              '& table': { borderCollapse: 'collapse', fontSize: 11, my: 0.5, width: '100%' },
              '& th, & td': { border: '1px solid #ddd', px: 0.8, py: 0.3, textAlign: 'left' },
              '& th': { bgcolor: '#f5f5f5', fontWeight: 600 },
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </Box>

      {/* Action card */}
      {message.action && message.actionStatus && (
        <ActionCard
          action={message.action}
          status={message.actionStatus}
          error={message.actionError}
          onConfirm={() => onConfirm(message)}
          onCancel={() => onCancel(message)}
        />
      )}

    </Box>
  );
}
