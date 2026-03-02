import { Database, toDate } from '../lib/db';
import { Session } from '../types';
import { uuid, hash } from '../lib/crypto';

export async function createSession(
    db: Database,
    data: {
        websiteId: string;
        browser?: string;
        os?: string;
        device?: string;
        screen?: string;
        language?: string;
        country?: string;
        region?: string;
        city?: string;
        distinctId?: string;
    }
): Promise<string> {
    const sessionId = uuid();
    const now = toDate(new Date());

    const sql = `
        INSERT INTO session (
            session_id, website_id, browser, os, device, screen, 
            language, country, region, city, distinct_id, created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `;

    await db.execute(sql, [
        sessionId,
        data.websiteId,
        data.browser || null,
        data.os || null,
        data.device || null,
        data.screen || null,
        data.language || null,
        data.country || null,
        data.region || null,
        data.city || null,
        data.distinctId || null,
        now,
    ]);

    return sessionId;
}

export async function getSessionById(db: Database, sessionId: string): Promise<Session | null> {
    const sql = `
        SELECT 
            session_id as id,
            website_id as websiteId,
            browser,
            os,
            device,
            screen,
            language,
            country,
            region,
            city,
            distinct_id as distinctId,
            created_at as createdAt
        FROM session 
        WHERE session_id = ?1
    `;
    return db.queryOne<Session>(sql, [sessionId]);
}

export async function getSessionsByWebsiteId(
    db: Database,
    websiteId: string,
    options: {
        page?: number;
        pageSize?: number;
        startAt?: string;
        endAt?: string;
    } = {}
): Promise<{ data: Session[]; total: number }> {
    const { page = 1, pageSize = 10, startAt, endAt } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE website_id = ?';
    const params: any[] = [websiteId];

    if (startAt) {
        whereClause += ' AND created_at >= ?';
        params.push(startAt);
    }
    if (endAt) {
        whereClause += ' AND created_at <= ?';
        params.push(endAt);
    }

    const countSql = `SELECT COUNT(*) as count FROM session ${whereClause}`;
    const countResult = await db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
        SELECT 
            session_id as id,
            website_id as websiteId,
            browser,
            os,
            device,
            screen,
            language,
            country,
            region,
            city,
            distinct_id as distinctId,
            created_at as createdAt
        FROM session 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
    `;

    const data = await db.query<Session>(sql, params);

    return { data, total };
}

export async function getSessionCount(db: Database, websiteId: string, startAt?: string, endAt?: string): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM session WHERE website_id = ?`;
    const params: any[] = [websiteId];

    if (startAt) {
        sql += ' AND created_at >= ?';
        params.push(startAt);
    }
    if (endAt) {
        sql += ' AND created_at <= ?';
        params.push(endAt);
    }

    const result = await db.queryOne<{ count: number }>(sql, params);
    return result?.count || 0;
}

export async function getActiveVisitors(db: Database, websiteId: string): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() - 5 * 60 * 1000);
    const thresholdStr = toDate(threshold);

    const sql = `
        SELECT COUNT(DISTINCT session_id) as count 
        FROM website_event 
        WHERE website_id = ? AND created_at >= ?
    `;

    const result = await db.queryOne<{ count: number }>(sql, [websiteId, thresholdStr]);
    return result?.count || 0;
}
