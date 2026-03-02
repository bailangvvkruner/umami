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
}

export function createDatabase(db: D1Database): Database {
    return new Database(db);
}

export function toDate(date: Date | string | undefined): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    return date.toISOString();
}

export function getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
}
