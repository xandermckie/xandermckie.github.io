type Row = Record<string, unknown>;

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function splitList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function colName(raw: string): string {
  const trimmed = raw.trim();
  const dotted = trimmed.split('.');
  return dotted[dotted.length - 1] ?? trimmed;
}

function isNull(value: unknown): boolean {
  return value === null || value === undefined;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function matchesWhere(row: Row, where: string, params: unknown[]): boolean {
  if (!where) return true;
  const parts = where.split(/\s+AND\s+/i);
  let index = 0;
  for (const part of parts) {
    const clause = part.trim();
    const eqLit = clause.match(/^([\w.]+)\s*=\s*'([^']*)'$/i);
    if (eqLit) {
      if (String(row[colName(eqLit[1] ?? '')] ?? '') !== (eqLit[2] ?? '')) return false;
      continue;
    }
    const eq = clause.match(/^([\w.]+)\s*=\s*\?$/i);
    if (eq) {
      if (String(row[colName(eq[1])] ?? '') !== String(params[index++] ?? '')) return false;
      continue;
    }
    const gt = clause.match(/^([\w.]+)\s*>\s*\?$/i);
    if (gt) {
      if (!(compare(row[colName(gt[1])], params[index++]) > 0)) return false;
      continue;
    }
    const gte = clause.match(/^([\w.]+)\s*>=\s*\?$/i);
    if (gte) {
      if (!(compare(row[colName(gte[1])], params[index++]) >= 0)) return false;
      continue;
    }
    const isNullClause = clause.match(/^([\w.]+)\s+IS\s+NULL$/i);
    if (isNullClause) {
      if (!isNull(row[colName(isNullClause[1])])) return false;
      continue;
    }
    const notNull = clause.match(/^([\w.]+)\s+IS\s+NOT\s+NULL$/i);
    if (notNull) {
      if (isNull(row[colName(notNull[1])])) return false;
      continue;
    }
    throw new Error(`Unsupported WHERE clause: ${clause}`);
  }
  return true;
}

function project(row: Row, columns: string): Row {
  const trimmed = columns.trim();
  if (trimmed === '*' || trimmed === 'u.*' || trimmed === 's.*') return { ...row };
  if (/^count\(\*\)\s+as\s+n$/i.test(trimmed)) return row;
  if (/^1\s+as\s+ok$/i.test(trimmed)) return { ok: 1 };
  const out: Row = {};
  for (const part of splitList(trimmed)) {
    const alias = part.split(/\s+as\s+/i);
    const source = colName(alias[0] ?? part);
    const name = alias[1] ? alias[1].trim() : source;
    out[name] = row[source];
  }
  return out;
}

export class MemoryD1 {
  readonly tables: Record<string, Row[]> = {
    users: [],
    sessions: [],
    magic_links: [],
    entitlements: [],
    completions: [],
    sync_blobs: [],
    rate_limits: [],
    deletion_log: [],
    ops_sessions: [],
    ops_audit: [],
    ops_http_events: [],
  };
  private completionId = 1;
  private deletionId = 1;

  prepare(query: string): MemoryStatement {
    return new MemoryStatement(this, query);
  }

  execute(sql: string, params: unknown[]): { rows: Row[]; changes: number } {
    const q = normalizeSql(sql);
    if (/^SELECT 1 as ok$/i.test(q)) return { rows: [{ ok: 1 }], changes: 0 };

    const join = q.match(
      /^SELECT\s+(.+?)\s+FROM\s+sessions\s+s\s+JOIN\s+users\s+u\s+ON\s+u\.id\s+=\s+s\.user_id(?:\s+WHERE\s+(.+))?$/i,
    );
    if (join) {
      const rows: Row[] = [];
      for (const session of this.tables.sessions) {
        const user = this.tables.users.find((item) => item.id === session.user_id);
        if (!user) continue;
        const merged: Row = { ...user, token_hash: session.token_hash, expires_at: session.expires_at, user_id: session.user_id };
        if (matchesWhere(merged, join[2] ?? '', params)) rows.push(project(merged, join[1] ?? '*'));
      }
      return { rows, changes: 0 };
    }

    const select = q.match(
      /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+([\w.]+)\s+(ASC|DESC))?(?:\s+LIMIT\s+(\d+))?$/i,
    );
    if (select) {
      const table = this.table(select[2] ?? '');
      const filtered = table.filter((row) => matchesWhere(row, select[3] ?? '', params));
      const count = select[1] && /^count\(\*\)\s+as\s+n$/i.test(select[1].trim());
      if (count) return { rows: [{ n: filtered.length }], changes: 0 };
      const orderCol = select[4] ? colName(select[4]) : null;
      const ordered = orderCol
        ? [...filtered].sort((a, b) => {
            const dir = (select[5] ?? 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
            return compare(a[orderCol], b[orderCol]) * dir;
          })
        : filtered;
      const limit = select[6] ? Number(select[6]) : ordered.length;
      return { rows: ordered.slice(0, limit).map((row) => project(row, select[1] ?? '*')), changes: 0 };
    }

    const insertConflict = q.match(
      /^INSERT INTO (\w+) \((.+?)\) VALUES \((.+?)\) ON CONFLICT\((.+?)\) DO UPDATE SET (.+)$/i,
    );
    if (insertConflict) {
      return this.insert(insertConflict[1] ?? '', insertConflict[2] ?? '', insertConflict[3] ?? '', params, {
        cols: splitList(insertConflict[4] ?? ''),
        set: insertConflict[5] ?? '',
      });
    }
    const insertReplace = q.match(/^INSERT OR REPLACE INTO (\w+) \((.+?)\) VALUES \((.+?)\)$/i);
    if (insertReplace) {
      return this.insert(insertReplace[1] ?? '', insertReplace[2] ?? '', insertReplace[3] ?? '', params, {
        replace: true,
      });
    }
    const insert = q.match(/^INSERT INTO (\w+) \((.+?)\) VALUES \((.+?)\)$/i);
    if (insert) {
      return this.insert(insert[1] ?? '', insert[2] ?? '', insert[3] ?? '', params, {});
    }

    const update = q.match(/^UPDATE (\w+) SET (.+?)(?: WHERE (.+))?$/i);
    if (update) {
      const table = this.table(update[1] ?? '');
      const assignments = splitList(update[2] ?? '');
      let p = 0;
      const parsed = assignments.map((assignment) => {
        const col = colName(assignment.split('=')[0] ?? '');
        if (/^[\w.]+\s*=\s*NULL$/i.test(assignment)) return { col, kind: 'null' as const };
        if (/^[\w.]+\s*=\s*\?$/.test(assignment)) return { col, kind: 'param' as const, value: params[p++] };
        if (/^[\w.]+\s*=\s*'([^']*)'$/.test(assignment)) {
          return { col, kind: 'lit' as const, value: assignment.split('=')[1]?.trim().slice(1, -1) };
        }
        if (/^[\w.]+\s*=\s*[\w.]+\s*\+\s*1$/.test(assignment)) return { col, kind: 'inc' as const };
        throw new Error(`Unsupported SET: ${assignment}`);
      });
      const whereParams = params.slice(p);
      let changes = 0;
      for (const row of table) {
        if (!matchesWhere(row, update[3] ?? '', whereParams)) continue;
        for (const item of parsed) {
          if (item.kind === 'null') row[item.col] = null;
          else if (item.kind === 'inc') row[item.col] = Number(row[item.col] ?? 0) + 1;
          else row[item.col] = item.value;
        }
        changes += 1;
      }
      return { rows: [], changes };
    }

    const del = q.match(/^DELETE FROM (\w+)(?: WHERE (.+))?$/i);
    if (del) {
      const name = del[1] ?? '';
      const table = this.table(name);
      const kept: Row[] = [];
      let changes = 0;
      const removed: Row[] = [];
      for (const row of table) {
        if (matchesWhere(row, del[2] ?? '', params)) {
          changes += 1;
          removed.push(row);
        } else kept.push(row);
      }
      this.tables[name] = kept;
      if (name === 'users') {
        for (const user of removed) {
          const id = user.id;
          this.tables.sessions = this.tables.sessions.filter((row) => row.user_id !== id);
          this.tables.entitlements = this.tables.entitlements.filter((row) => row.user_id !== id);
          this.tables.completions = this.tables.completions.filter((row) => row.user_id !== id);
          this.tables.sync_blobs = this.tables.sync_blobs.filter((row) => row.user_id !== id);
        }
      }
      return { rows: [], changes };
    }

    throw new Error(`Unsupported SQL: ${q}`);
  }

  private table(name: string): Row[] {
    const table = this.tables[name];
    if (!table) throw new Error(`Unknown table ${name}`);
    return table;
  }

  private insert(
    tableName: string,
    colSql: string,
    valSql: string,
    params: unknown[],
    options: { replace?: boolean; cols?: string[]; set?: string },
  ): { rows: Row[]; changes: number } {
    const cols = splitList(colSql);
    const tokens = splitList(valSql);
    let p = 0;
    const row: Row = {};
    for (let i = 0; i < cols.length; i++) {
      const token = tokens[i] ?? 'NULL';
      const col = cols[i] ?? '';
      if (token === '?') row[col] = params[p++];
      else if (/^null$/i.test(token)) row[col] = null;
      else if (token.startsWith("'") && token.endsWith("'")) row[col] = token.slice(1, -1);
      else if (!Number.isNaN(Number(token))) row[col] = Number(token);
      else row[col] = token;
    }
    if (tableName === 'completions' && row.id == null) row.id = this.completionId++;
    if (tableName === 'deletion_log' && row.id == null) row.id = this.deletionId++;

    const table = this.table(tableName);
    if (options.replace || options.cols) {
      const keys = options.cols ?? cols.slice(0, 1);
      const existing = table.find((item) => keys.every((key) => String(item[key]) === String(row[key])));
      if (existing) {
        if (options.set) {
          for (const assignment of splitList(options.set)) {
            const inc = assignment.match(/^(\w+)\s*=\s*\1\s*\+\s*1$/);
            if (inc) {
              existing[inc[1] ?? ''] = Number(existing[inc[1] ?? ''] ?? 0) + 1;
              continue;
            }
            const excluded = assignment.match(/^(\w+)\s*=\s*excluded\.(\w+)$/i);
            if (excluded) {
              existing[excluded[1] ?? ''] = row[excluded[2] ?? ''];
              continue;
            }
            const literal = assignment.match(/^(\w+)\s*=\s*'(.+)'$/);
            if (literal) {
              existing[literal[1] ?? ''] = literal[2];
              continue;
            }
            throw new Error(`Unsupported ON CONFLICT SET: ${assignment}`);
          }
        } else {
          for (const col of cols) existing[col] = row[col];
        }
        return { rows: [], changes: 1 };
      }
    }
    table.push(row);
    return { rows: [], changes: 1 };
  }
}

class MemoryStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: MemoryD1,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): MemoryStatement {
    const next = new MemoryStatement(this.db, this.sql);
    next.params = values;
    return next;
  }

  async first<T = Row>(): Promise<T | null> {
    const { rows } = this.db.execute(this.sql, this.params);
    return (rows[0] as T) ?? null;
  }

  async run(): Promise<{ success: true }> {
    this.db.execute(this.sql, this.params);
    return { success: true };
  }

  async all<T = Row>(): Promise<{ results: T[] }> {
    const { rows } = this.db.execute(this.sql, this.params);
    return { results: rows as T[] };
  }
}
