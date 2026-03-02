import { Database, toDate } from '../lib/db';
import { Website } from '../types';
import { uuid } from '../lib/crypto';

export async function getWebsiteById(db: Database, websiteId: string): Promise<Website | null> {
    const sql = `
        SELECT 
            website_id as id,
            name,
            domain,
            share_id as shareId,
            reset_at as resetAt,
            user_id as userId,
            team_id as teamId,
            created_by as createdBy,
            created_at as createdAt,
            updated_at as updatedAt,
            deleted_at as deletedAt
        FROM website 
        WHERE website_id = ?1 AND deleted_at IS NULL
    `;
    return db.queryOne<Website>(sql, [websiteId]);
}

export async function getWebsiteByShareId(db: Database, shareId: string): Promise<Website | null> {
    const sql = `
        SELECT 
            website_id as id,
            name,
            domain,
            share_id as shareId,
            reset_at as resetAt,
            user_id as userId,
            team_id as teamId,
            created_by as createdBy,
            created_at as createdAt,
            updated_at as updatedAt
        FROM website 
        WHERE share_id = ?1 AND deleted_at IS NULL
    `;
    return db.queryOne<Website>(sql, [shareId]);
}

export async function getWebsitesByUserId(db: Database, userId: string, options: { page?: number; pageSize?: number; search?: string } = {}): Promise<{ data: Website[]; total: number }> {
    const { page = 1, pageSize = 10, search } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE user_id = ? AND deleted_at IS NULL';
    const params: any[] = [userId];

    if (search) {
        whereClause += ' AND (name LIKE ? OR domain LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as count FROM website ${whereClause}`;
    const countResult = await db.queryOne<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;

    const sql = `
        SELECT 
            website_id as id,
            name,
            domain,
            share_id as shareId,
            reset_at as resetAt,
            user_id as userId,
            team_id as teamId,
            created_at as createdAt
        FROM website 
        ${whereClause}
        ORDER BY name ASC
        LIMIT ${pageSize} OFFSET ${offset}
    `;

    const data = await db.query<Website>(sql, params);

    return { data, total };
}

export async function getWebsitesByTeamId(db: Database, teamId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: Website[]; total: number }> {
    const { page = 1, pageSize = 10 } = options;
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) as count FROM website WHERE team_id = ? AND deleted_at IS NULL`;
    const countResult = await db.queryOne<{ count: number }>(countSql, [teamId]);
    const total = countResult?.count || 0;

    const sql = `
        SELECT 
            website_id as id,
            name,
            domain,
            share_id as shareId,
            user_id as userId,
            team_id as teamId,
            created_at as createdAt
        FROM website 
        WHERE team_id = ? AND deleted_at IS NULL
        ORDER BY name ASC
        LIMIT ${pageSize} OFFSET ${offset}
    `;

    const data = await db.query<Website>(sql, [teamId]);

    return { data, total };
}

export async function createWebsite(db: Database, data: { name: string; domain?: string; userId?: string; teamId?: string; shareId?: string }): Promise<Website> {
    const id = uuid();
    const now = toDate(new Date());

    const sql = `
        INSERT INTO website (website_id, name, domain, share_id, user_id, team_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `;

    await db.execute(sql, [id, data.name, data.domain || null, data.shareId || null, data.userId || null, data.teamId || null, now, now]);

    return {
        id,
        name: data.name,
        domain: data.domain,
        shareId: data.shareId,
        userId: data.userId,
        teamId: data.teamId,
        createdAt: now,
        updatedAt: now,
    };
}

export async function updateWebsite(db: Database, websiteId: string, data: Partial<Website>): Promise<Website | null> {
    const updates: string[] = [];
    const params: any[] = [];
    const now = toDate(new Date());

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.domain !== undefined) {
        updates.push('domain = ?');
        params.push(data.domain);
    }
    if (data.shareId !== undefined) {
        updates.push('share_id = ?');
        params.push(data.shareId);
    }

    if (updates.length === 0) {
        return getWebsiteById(db, websiteId);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(websiteId);

    const sql = `UPDATE website SET ${updates.join(', ')} WHERE website_id = ?`;
    await db.execute(sql, params);

    return getWebsiteById(db, websiteId);
}

export async function deleteWebsite(db: Database, websiteId: string): Promise<boolean> {
    const now = toDate(new Date());

    await db.execute(`DELETE FROM event_data WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM session_data WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM website_event WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM session WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM report WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM segment WHERE website_id = ?`, [websiteId]);

    const sql = `DELETE FROM website WHERE website_id = ?`;
    const result = await db.execute(sql, [websiteId]);
    return result.meta.changes > 0;
}

export async function resetWebsite(db: Database, websiteId: string): Promise<boolean> {
    const now = toDate(new Date());

    await db.execute(`DELETE FROM event_data WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM session_data WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM website_event WHERE website_id = ?`, [websiteId]);
    await db.execute(`DELETE FROM session WHERE website_id = ?`, [websiteId]);

    const sql = `UPDATE website SET reset_at = ? WHERE website_id = ?`;
    const result = await db.execute(sql, [now, websiteId]);
    return result.meta.changes > 0;
}

export async function getWebsiteCount(db: Database, userId?: string): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM website WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
    }

    const result = await db.queryOne<{ count: number }>(sql, params);
    return result?.count || 0;
}
