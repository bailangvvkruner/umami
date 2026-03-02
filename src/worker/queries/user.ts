import { Database, toDate } from '../lib/db';
import { User, ROLES } from '../types';
import { uuid } from '../lib/crypto';

export async function getUserById(db: Database, userId: string): Promise<User | null> {
    const sql = `
        SELECT 
            user_id as id,
            username,
            password,
            role,
            logo_url as logoUrl,
            display_name as displayName,
            created_at as createdAt,
            updated_at as updatedAt,
            deleted_at as deletedAt
        FROM user 
        WHERE user_id = ? AND deleted_at IS NULL
    `;
    return db.queryOne<User>(sql, [userId]);
}

export async function getUserByUsername(db: Database, username: string, includePassword = true): Promise<User | null> {
    const sql = `
        SELECT 
            user_id as id,
            username,
            ${includePassword ? 'password,' : ''}
            role,
            logo_url as logoUrl,
            display_name as displayName,
            created_at as createdAt,
            updated_at as updatedAt,
            deleted_at as deletedAt
        FROM user 
        WHERE username = ? AND deleted_at IS NULL
    `;
    return db.queryOne<User>(sql, [username]);
}

export async function getUsers(db: Database, options: { page?: number; pageSize?: number; search?: string } = {}): Promise<{ data: User[]; count: number }> {
    const { page = 1, pageSize = 10, search } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (search) {
        whereClause += ' AND username LIKE ?';
        params.push(`%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as count FROM user ${whereClause}`;
    const countResult = await db.queryOne<{ count: number }>(countSql, params);
    const count = countResult?.count || 0;

    const sql = `
        SELECT 
            user_id as id,
            username,
            role,
            display_name as displayName,
            created_at as createdAt
        FROM user 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    const data = await db.query<User>(sql, [...params, pageSize, offset]);

    return { data, count };
}

export async function createUser(db: Database, data: { username: string; password: string; role?: string }): Promise<User> {
    const id = uuid();
    const role = data.role || ROLES.user;
    const now = toDate(new Date());

    const sql = `
        INSERT INTO user (user_id, username, password, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(sql, [id, data.username, data.password, role, now, now]);

    return {
        id,
        username: data.username,
        password: data.password,
        role,
        createdAt: now,
        updatedAt: now,
    };
}

export async function updateUser(db: Database, userId: string, data: Partial<User>): Promise<User | null> {
    const updates: string[] = [];
    const params: any[] = [];
    const now = toDate(new Date());

    if (data.username !== undefined) {
        updates.push('username = ?');
        params.push(data.username);
    }
    if (data.password !== undefined) {
        updates.push('password = ?');
        params.push(data.password);
    }
    if (data.role !== undefined) {
        updates.push('role = ?');
        params.push(data.role);
    }
    if (data.displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(data.displayName);
    }

    if (updates.length === 0) {
        return getUserById(db, userId);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(userId);

    const sql = `UPDATE user SET ${updates.join(', ')} WHERE user_id = ?`;
    await db.execute(sql, params);

    return getUserById(db, userId);
}

export async function deleteUser(db: Database, userId: string): Promise<boolean> {
    const now = toDate(new Date());
    const sql = `UPDATE user SET deleted_at = ? WHERE user_id = ?`;
    const result = await db.execute(sql, [now, userId]);
    return result.meta.changes > 0;
}

export async function getUserTeams(db: Database, userId: string): Promise<any[]> {
    const sql = `
        SELECT 
            t.team_id as id,
            t.name,
            t.access_code as accessCode,
            tu.role
        FROM team t
        JOIN team_user tu ON t.team_id = tu.team_id
        WHERE tu.user_id = ? AND t.deleted_at IS NULL
        ORDER BY t.name
    `;
    return db.query(sql, [userId]);
}
