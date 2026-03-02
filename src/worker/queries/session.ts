import { Database, toDate } from '../lib/db';
import { Session } from '../types';
import { uuid, uuidv5, hash } from '../lib/crypto';

export async function createSession(
    db: Database,
    data: {
        id?: string;
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
        createdAt?: Date;
    }
): Promise<string> {
    const sessionId = data.id || uuid();
    const now = toDate(data.createdAt || new Date());

    const sql = `
        INSERT INTO session (
            session_id, website_id, browser, os, device, screen, 
            language, country, region, city, distinct_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        WHERE session_id = ?
    `;
    return db.queryOne<Session>(sql, [sessionId]);
}

export async function getWebsiteSessions(
    db: Database,
    websiteId: string,
    options: {
        page?: number;
        pageSize?: number;
        startAt?: number;
        endAt?: number;
        search?: string;
    } = {}
): Promise<{ data: any[]; count: number }> {
    const { page = 1, pageSize = 10, startAt, endAt, search } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE website_id = ?';
    const params: any[] = [websiteId];

    if (startAt) {
        whereClause += ' AND created_at >= ?';
        params.push(new Date(startAt).toISOString());
    }
    if (endAt) {
        whereClause += ' AND created_at <= ?';
        params.push(new Date(endAt).toISOString());
    }

    const countSql = `SELECT COUNT(*) as count FROM session ${whereClause}`;
    const countResult = await db.queryOne<{ count: number }>(countSql, params);
    const count = countResult?.count || 0;

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
        LIMIT ? OFFSET ?
    `;

    const data = await db.query(sql, [...params, pageSize, offset]);

    return { data, count };
}

export async function getSessionStats(db: Database, websiteId: string, startAt: number, endAt: number): Promise<{ visitors: number; visits: number }> {
    const sql = `
        SELECT 
            COUNT(DISTINCT session_id) as visitors,
            COUNT(*) as visits
        FROM website_event 
        WHERE website_id = ? 
            AND created_at >= ? 
            AND created_at <= ?
    `;

    const result = await db.queryOne<{ visitors: number; visits: number }>(sql, [
        websiteId,
        new Date(startAt).toISOString(),
        new Date(endAt).toISOString(),
    ]);

    return result || { visitors: 0, visits: 0 };
}

function startOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfHour(date: Date): Date {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
}

export async function generateSessionId(sourceId: string, ip: string, userAgent: string, createdAt: Date): Promise<string> {
    const sessionSalt = await hash(startOfMonth(createdAt).toUTCString());
    return uuidv5(sourceId, ip, userAgent, sessionSalt);
}

export async function generateVisitId(sessionId: string, createdAt: Date): Promise<string> {
    const visitSalt = await hash(startOfHour(createdAt).toUTCString());
    return uuidv5(sessionId, visitSalt);
}
