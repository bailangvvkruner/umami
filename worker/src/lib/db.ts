import { Env } from '../types';

export class Database {
    constructor(private db: D1Database) {}

    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        const stmt = this.db.prepare(sql);
        const result = await stmt.bind(...params).all<T>();
        return result.results;
    }

    async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
        const results = await this.query<T>(sql, params);
        return results[0] || null;
    }

    async execute(sql: string, params: any[] = []): Promise<D1Result> {
        const stmt = this.db.prepare(sql);
        return stmt.bind(...params).run();
    }

    async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
        return this.db.batch(statements);
    }

    async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
        return fn(this);
    }
}

export function createDatabase(env: Env): Database {
    return new Database(env.DB);
}

export function getPlaceholder(index: number): string {
    return `?${index}`;
}

export function buildWhereClause(conditions: Record<string, any>): { clause: string; params: any[] } {
    const parts: string[] = [];
    const params: any[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(conditions)) {
        if (value === undefined || value === null) {
            parts.push(`${key} IS NULL`);
        } else if (Array.isArray(value)) {
            const placeholders = value.map(() => getPlaceholder(index++)).join(', ');
            parts.push(`${key} IN (${placeholders})`);
            params.push(...value);
        } else {
            parts.push(`${key} = ${getPlaceholder(index++)}`);
            params.push(value);
        }
    }

    return {
        clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
        params,
    };
}

export function buildOrderBy(sort: string, order: 'ASC' | 'DESC' = 'ASC'): string {
    return `ORDER BY ${sort} ${order}`;
}

export function buildPagination(page: number = 1, pageSize: number = 10): { clause: string; offset: number } {
    const offset = (page - 1) * pageSize;
    return {
        clause: `LIMIT ${pageSize} OFFSET ${offset}`,
        offset,
    };
}

export function toDate(date: Date | string | undefined): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    return date.toISOString();
}

export function fromDate(dateStr: string): Date {
    return new Date(dateStr);
}
