'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Collapse from '@mui/material/Collapse';
import { api } from '@/lib/api';

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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
}

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

export function SannaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.sendAssistantMessage({ message: trimmed, history });
      const d = res.data;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.message,
        sql: d.sql,
        data: d.data,
        rowCount: d.rowCount,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
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
                  &quot;How full is Zone A?&quot;
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  &quot;Show items checked in today&quot;
                </Typography>
              </Box>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
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

          {/* Input */}
          <Box sx={{
            p: 1,
            borderTop: '1px solid #e0e0e0',
            bgcolor: '#fff',
            display: 'flex',
            gap: 0.5,
            alignItems: 'flex-end',
          }}>
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder="Ask Sanna..."
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
              disabled={loading || !input.trim()}
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

function MessageBubble({ message }: { message: Message }) {
  const [showSQL, setShowSQL] = useState(false);
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
          <Typography sx={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </Typography>
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

      {/* Data table */}
      {message.data && message.data.length > 0 && (
        <Box sx={{
          mt: 0.5,
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          bgcolor: '#fff',
          overflow: 'hidden',
        }}>
          <Box sx={{ overflowX: 'auto', maxHeight: 200 }}>
            <Table size="small" sx={{ '& td, & th': { fontSize: 11, py: 0.3, px: 0.8 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  {Object.keys(message.data[0]).map(key => (
                    <TableCell key={key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {key}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {message.data.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    {Object.values(row).map((val, j) => (
                      <TableCell key={j} sx={{ whiteSpace: 'nowrap' }}>
                        {val === null ? '—' : String(val)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {message.data.length > 10 && (
            <Typography sx={{ fontSize: 10, color: 'text.secondary', px: 1, py: 0.3, bgcolor: '#f5f5f5' }}>
              Showing 10 of {message.rowCount ?? message.data.length} rows
            </Typography>
          )}
        </Box>
      )}

      {/* SQL toggle */}
      {message.sql && (
        <Box sx={{ mt: 0.3 }}>
          <Typography
            component="button"
            onClick={() => setShowSQL(s => !s)}
            sx={{
              fontSize: 10,
              color: 'text.secondary',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              p: 0,
              textDecoration: 'underline',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {showSQL ? 'Hide query' : 'View query'}
          </Typography>
          <Collapse in={showSQL}>
            <Box sx={{
              mt: 0.3,
              p: 0.8,
              bgcolor: '#263238',
              color: '#e0e0e0',
              borderRadius: '4px',
              fontFamily: 'Roboto Mono, monospace',
              fontSize: 10.5,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              wordBreak: 'break-all',
            }}>
              {message.sql}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}
