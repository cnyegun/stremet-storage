import pool from '../db/pool';
import type { ActionProposal } from '@shared/types';

const LLM_API_URL = 'https://opencode.ai/zen/v1/chat/completions';
const LLM_API_KEY = 'sk-5U31szKCRP2TIQll1clR4ETEMduIZpuHQFx1jCvHjEqM463DIfIkkyWCKmgZbn3n';
const LLM_MODEL = 'kimi-k2.5';

const SCHEMA_PROMPT = `You are Sanna, a helpful warehouse assistant for Stremet, a sheet metal manufacturing company.
You answer questions about inventory, storage locations, occupancy, customers, machines, and production.
Keep answers concise and direct — workers are busy. Format numbers clearly.
Do NOT end your responses with follow-up offers like "I can also look up..." or "Would you like me to...". Just answer the question and stop. Workers will ask if they need more.
When a worker sends a photo (of a label, sticker, barcode, or product), extract any item codes, part numbers, customer names, or other identifying info from the image. Then use that to look up the item in the database.

When you need data from the database, output a SQL query inside a \`\`\`sql code block. Do NOT use XML tags, tool calls, or function calls — just a plain \`\`\`sql code block.
ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER anything.
After I give you the query results, summarize them in a clear, readable way.

DATABASE SCHEMA:

-- zones: Physical areas of the 1000m2 factory floor
-- Codes: A (raw materials), B (work-in-progress), C (finished goods), D (customer orders), E (general stock)
zones(id UUID PK, name, code UNIQUE, description, color, position_x, position_y, width, height)

-- racks: Shelving units within zones. ~5 racks per zone.
-- rack_type: raw_materials | work_in_progress | finished_goods | customer_orders | general_stock
racks(id UUID PK, zone_id FK->zones, code UNIQUE e.g. "A-R1", label, rack_type, row_count, column_count, display_order, position_in_zone, total_shelves)

-- shelf_slots: Individual cells within racks. Addressed as rack_code/R{row}C{col}.
shelf_slots(id UUID PK, rack_id FK->racks, shelf_number, row_number, column_number, capacity, current_count)

-- customers: Finnish companies (Kone, Wärtsilä, Valmet, Ponsse, Cargotec, Outokumpu, Metso, Nokia)
customers(id UUID PK, name, code UNIQUE e.g. "KONE", contact_email)

-- items: Parts/products tracked. item_code format like "KONE-001-PANEL-A"
-- type: customer_order | general_stock
items(id UUID PK, item_code UNIQUE, customer_id FK->customers nullable, name, description, material, dimensions, weight_kg, type, order_number nullable, quantity)

-- storage_assignments: Tracks which item/unit is on which shelf. Active if checked_out_at IS NULL.
storage_assignments(id UUID PK, item_id FK->items, shelf_slot_id FK->shelf_slots, unit_code, parent_unit_code nullable, quantity, checked_in_at, checked_out_at nullable, checked_in_by, checked_out_by nullable, notes)

-- machines: Factory equipment. Categories: sheet_metal, cutting, laser, robot_bending, bending
machines(id UUID PK, name, code UNIQUE, category, description)

-- machine_assignments: Items currently at a machine. Active if removed_at IS NULL.
-- Machines are treated as locations — items move to/from machines just like shelves.
machine_assignments(id UUID PK, item_id FK->items, machine_id FK->machines, unit_code, parent_unit_code nullable, quantity, assigned_at, assigned_by, removed_at nullable, removed_by nullable, notes)

-- activity_log: Audit trail of all actions
activity_log(id UUID PK, item_id FK->items, action [check_in|check_out|move|note_added], tracking_unit_code nullable, machine_id FK nullable, from_location, to_location, performed_by, notes, created_at)

KEY QUERY PATTERNS:
- Find where an item is stored: JOIN storage_assignments (WHERE checked_out_at IS NULL) -> shelf_slots -> racks -> zones
- Zone occupancy: SUM(current_count) / SUM(capacity) from shelf_slots JOIN racks WHERE zone_id = ...
- Items checked in today: storage_assignments WHERE checked_in_at >= CURRENT_DATE
- Available space: shelf_slots WHERE capacity - current_count >= N
- Customer items: JOIN items ON customer_id -> customers WHERE code/name ILIKE ...
- Use ILIKE for text search (handles Finnish characters like ä, ö)
- Today's date: CURRENT_DATE

ACTIONS YOU CAN PERFORM:
Besides answering questions with SQL, you can help workers check in items, check out items, and move items between locations.
When the worker asks you to perform an action, FIRST use SQL queries to resolve the needed UUIDs (item_id, assignment_id, shelf_slot_id, machine_id), THEN propose the action.

To propose an action, output a JSON block inside \`\`\`action fences (similar to how you output SQL in \`\`\`sql fences):

CHECK-IN (place an item onto a shelf):
\`\`\`action
{"action":"check_in","item_id":"<uuid>","item_code":"<item code>","shelf_slot_id":"<uuid>","location":"<rack/cell label e.g. A-R1/R2C3>","quantity":<number>}
\`\`\`

CHECK-OUT (remove an item from storage or a machine):
\`\`\`action
{"action":"check_out","assignment_id":"<uuid>","unit_code":"<tracking unit code>","source_type":"shelf","location":"<current location label>","item_code":"<item code>"}
\`\`\`
For machine check-out use "source_type":"machine".

MOVE (move an item from one location to another):
\`\`\`action
{"action":"move","assignment_id":"<uuid>","unit_code":"<tracking unit code>","source_type":"shelf","from":"<from label>","to":"<to label>","to_shelf_slot_id":"<uuid if moving to a shelf>","to_machine_id":"<uuid if moving to a machine>","quantity":<number or null for all>}
\`\`\`

RULES FOR ACTIONS:
- ALWAYS resolve names to UUIDs with SQL first. Never guess or make up UUIDs.
- Include human-readable labels (item_code, location names) so the worker can verify before confirming.
- Only propose ONE action at a time.
- Write a short summary BEFORE the \`\`\`action block explaining what you will do.
- The worker's name is filled in automatically — never ask for it.
- If you cannot find the item, shelf, or machine, tell the worker what you searched for and that nothing matched.
- Do NOT combine an action block with a SQL block in the same response — either query or propose, not both.`;

type MultimodalContent = Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: string } }>;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContent;
}

interface AssistantResult {
  message: string;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  action?: ActionProposal;
}

function validateSQL(sql: string): boolean {
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  const upper = trimmed.toUpperCase();

  // Must start with SELECT or WITH
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return false;
  }

  // Block dangerous keywords
  const blocked = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|CALL)\b/i;
  if (blocked.test(trimmed)) {
    return false;
  }

  // Block multiple statements
  const withoutStrings = trimmed.replace(/'[^']*'/g, '');
  if (withoutStrings.includes(';') && withoutStrings.indexOf(';') < withoutStrings.length - 1) {
    return false;
  }

  return true;
}

function extractSQL(text: string): string | null {
  // Skip if text has an action block — actions take priority
  if (/```action/i.test(text)) return null;

  // Look for ```sql ... ``` blocks
  const match = text.match(/```sql\s*([\s\S]*?)```/);
  if (match) return splitFirstStatement(match[1].trim());

  // Also try plain ``` blocks
  const plainMatch = text.match(/```\s*(SELECT[\s\S]*?)```/i);
  if (plainMatch) return splitFirstStatement(plainMatch[1].trim());

  // Handle XML-style tool calls the model sometimes emits
  const xmlMatch = text.match(/<parameter name="sql">\s*([\s\S]*?)\s*<\/parameter>/);
  if (xmlMatch) return splitFirstStatement(xmlMatch[1].trim());

  // Last resort: find a bare SELECT ... statement (multi-line)
  const bareMatch = text.match(/((?:WITH|SELECT)\s[\s\S]*?(?:;|\n\n|$))/i);
  if (bareMatch) {
    const candidate = bareMatch[1].trim().replace(/;$/, '');
    if (candidate.split('\n').length >= 2) return candidate;
  }

  return null;
}

// If the LLM puts multiple SQL statements in one block, take only the first
function splitFirstStatement(sql: string): string {
  // Remove comment lines
  const lines = sql.split('\n').filter(line => !line.trim().startsWith('--'));
  const cleaned = lines.join('\n').trim();
  // Split on semicolons (outside of string literals) and take the first non-empty statement
  const statements = cleaned.split(/;\s*\n/).filter(s => s.trim());
  return (statements[0] || cleaned).trim().replace(/;$/, '');
}

function extractAction(text: string): ActionProposal | null {
  const match = text.match(/```action\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[1].trim());
    if (obj.action === 'check_in' && obj.item_id && obj.shelf_slot_id && obj.item_code && obj.location) {
      return obj as ActionProposal;
    }
    if (obj.action === 'check_out' && obj.assignment_id && obj.unit_code && obj.item_code) {
      return obj as ActionProposal;
    }
    if (obj.action === 'move' && obj.assignment_id && obj.unit_code && (obj.to_shelf_slot_id || obj.to_machine_id)) {
      return obj as ActionProposal;
    }
    return null;
  } catch {
    return null;
  }
}

function extractTextBeforeAction(text: string): string {
  const idx = text.indexOf('```action');
  if (idx <= 0) return '';
  return text.slice(0, idx).trim();
}

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const body = JSON.stringify({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: SCHEMA_PROMPT },
      ...messages,
    ],
    max_tokens: 2048,
    temperature: 0.1,
  });

  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'stremet-backend',
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const json = await response.json() as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

async function executeReadOnlyQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5000'");

    // Add LIMIT if not present
    const upperSQL = sql.toUpperCase();
    const finalSQL = upperSQL.includes('LIMIT') ? sql : `${sql.replace(/;?\s*$/, '')} LIMIT 100`;

    const result = await client.query(finalSQL);
    await client.query('COMMIT');
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function handleAssistantMessage(
  message: string,
  history: ChatMessage[],
  imageBase64?: string,
): Promise<AssistantResult> {
  const userContent: string | MultimodalContent = imageBase64
    ? [
        { type: 'image_url', image_url: { url: imageBase64, detail: 'auto' } },
        { type: 'text', text: message || 'What is shown in this image? Extract any item codes, barcodes, or product information you can see.' },
      ]
    : message;

  const messages: ChatMessage[] = [
    ...history.slice(-18),
    { role: 'user', content: userContent },
  ];

  let lastSql: string | undefined;
  let lastData: Record<string, unknown>[] | undefined;
  let lastRowCount: number | undefined;

  // Loop: let the LLM run up to 3 SQL queries to answer the question
  for (let round = 0; round < 5; round++) {
    const llmResponse = await callLLM(messages);
    // Check for action proposal first
    const action = extractAction(llmResponse);
    if (action) {
      const summaryText = extractTextBeforeAction(llmResponse);
      return {
        message: summaryText || 'I\'d like to perform this action:',
        sql: lastSql,
        data: lastData,
        rowCount: lastRowCount,
        action,
      };
    }

    const sql = extractSQL(llmResponse);

    if (!sql) {
      // No more SQL — this is the final answer
      return {
        message: llmResponse.trim() || 'I couldn\'t find any results for that query.',
        sql: lastSql,
        data: lastData,
        rowCount: lastRowCount,
      };
    }

    if (!validateSQL(sql)) {
      return { message: 'I can only run read-only queries. I cannot modify any data in the system.' };
    }

    lastSql = sql;
    messages.push({ role: 'assistant', content: llmResponse });

    try {
      const result = await executeReadOnlyQuery(sql);
      lastData = result.rows.slice(0, 50);
      lastRowCount = result.rowCount;
      if (result.rowCount === 0) {
        messages.push({
          role: 'user',
          content: `Query returned 0 rows — no matching data found. Tell the user that nothing was found for their query, or try a different query if you think a different search would help.`,
        });
      } else {
        messages.push({
          role: 'user',
          content: `Query returned ${result.rowCount} rows. Results:\n${JSON.stringify(lastData, null, 2)}\n\nIf you have enough information, give a clear final answer (or propose an action using an \`\`\`action block if the user asked you to do something). If you need another query, go ahead. Do NOT repeat a query you already ran.`,
        });
      }
    } catch (err) {
      console.error('SQL execution error:', err);
      messages.push({
        role: 'user',
        content: `That query failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please fix it or try a different approach.`,
      });
    }
  }

  // If we exhausted rounds, do one final call asking for a summary (or action proposal)
  messages.push({ role: 'user', content: 'Please summarize what you found so far. No more SQL queries. If the user asked you to perform an action and you have all the UUIDs, propose the action now using an ```action block.' });
  const finalResponse = await callLLM(messages);

  const finalAction = extractAction(finalResponse);
  if (finalAction) {
    const summaryText = extractTextBeforeAction(finalResponse);
    return {
      message: summaryText || 'I\'d like to perform this action:',
      sql: lastSql,
      data: lastData,
      rowCount: lastRowCount,
      action: finalAction,
    };
  }

  return {
    message: finalResponse,
    sql: lastSql,
    data: lastData,
    rowCount: lastRowCount,
  };
}
