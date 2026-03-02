import { Database, toDate } from '../lib/db';
import { Team, TeamUser, ROLES } from '../types';
import { uuid } from '../lib/crypto';

export async function getTeamById(db: Database, teamId: string): Promise<Team | null> {
    const sql = `
        SELECT 
            team_id as id,
            name,
            access_code as accessCode,
            logo_url as logoUrl,
            created_at as createdAt,
            updated_at as updatedAt,
            deleted_at as deletedAt
        FROM team 
        WHERE team_id = ? AND deleted_at IS NULL
    `;
    return db.queryOne<Team>(sql, [teamId]);
}

export async function getUserTeams(db: Database, userId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: (Team & { role: string })[]; count: number }> {
    const { page = 1, pageSize = 10 } = options;
    const offset = (page - 1) * pageSize;

    const countSql = `
        SELECT COUNT(*) as count 
        FROM team t
        JOIN team_user tu ON t.team_id = tu.team_id
        WHERE tu.user_id = ? AND t.deleted_at IS NULL
    `;
    const countResult = await db.queryOne<{ count: number }>(countSql, [userId]);
    const count = countResult?.count || 0;

    const sql = `
        SELECT 
            t.team_id as id,
            t.name,
            t.access_code as accessCode,
            t.logo_url as logoUrl,
            t.created_at as createdAt,
            tu.role
        FROM team t
        JOIN team_user tu ON t.team_id = tu.team_id
        WHERE tu.user_id = ? AND t.deleted_at IS NULL
        ORDER BY t.name ASC
        LIMIT ? OFFSET ?
    `;

    const data = await db.query<Team & { role: string }>(sql, [userId, pageSize, offset]);

    return { data, count };
}

export async function createTeam(db: Database, data: { name: string; userId: string }): Promise<Team> {
    const teamId = uuid();
    const teamUserId = uuid();
    const now = toDate(new Date());

    const teamSql = `
        INSERT INTO team (team_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `;

    const teamUserSql = `
        INSERT INTO team_user (team_user_id, team_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(teamSql, [teamId, data.name, now, now]);
    await db.execute(teamUserSql, [teamUserId, teamId, data.userId, ROLES.teamOwner, now, now]);

    return {
        id: teamId,
        name: data.name,
        createdAt: now,
        updatedAt: now,
    };
}

export async function updateTeam(db: Database, teamId: string, data: Partial<Team>): Promise<Team | null> {
    const updates: string[] = [];
    const params: any[] = [];
    const now = toDate(new Date());

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.accessCode !== undefined) {
        updates.push('access_code = ?');
        params.push(data.accessCode);
    }

    if (updates.length === 0) {
        return getTeamById(db, teamId);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(teamId);

    const sql = `UPDATE team SET ${updates.join(', ')} WHERE team_id = ?`;
    await db.execute(sql, params);

    return getTeamById(db, teamId);
}

export async function deleteTeam(db: Database, teamId: string): Promise<boolean> {
    await db.execute(`UPDATE website SET team_id = NULL WHERE team_id = ?`, [teamId]);
    await db.execute(`DELETE FROM team_user WHERE team_id = ?`, [teamId]);

    const sql = `DELETE FROM team WHERE team_id = ?`;
    const result = await db.execute(sql, [teamId]);
    return result.meta.changes > 0;
}

export async function getTeamMembers(db: Database, teamId: string, options: { page?: number; pageSize?: number } = {}): Promise<{ data: (TeamUser & { username: string })[]; count: number }> {
    const { page = 1, pageSize = 10 } = options;
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) as count FROM team_user WHERE team_id = ?`;
    const countResult = await db.queryOne<{ count: number }>(countSql, [teamId]);
    const count = countResult?.count || 0;

    const sql = `
        SELECT 
            tu.team_user_id as id,
            tu.team_id as teamId,
            tu.user_id as userId,
            tu.role,
            tu.created_at as createdAt,
            u.username
        FROM team_user tu
        JOIN user u ON tu.user_id = u.user_id
        WHERE tu.team_id = ?
        ORDER BY tu.created_at ASC
        LIMIT ? OFFSET ?
    `;

    const data = await db.query<TeamUser & { username: string }>(sql, [teamId, pageSize, offset]);

    return { data, count };
}

export async function addTeamMember(db: Database, teamId: string, userId: string, role: string = ROLES.teamMember): Promise<TeamUser> {
    const id = uuid();
    const now = toDate(new Date());

    const sql = `
        INSERT INTO team_user (team_user_id, team_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(sql, [id, teamId, userId, role, now, now]);

    return {
        id,
        teamId,
        userId,
        role,
        createdAt: now,
        updatedAt: now,
    };
}

export async function removeTeamMember(db: Database, teamId: string, userId: string): Promise<boolean> {
    const sql = `DELETE FROM team_user WHERE team_id = ? AND user_id = ?`;
    const result = await db.execute(sql, [teamId, userId]);
    return result.meta.changes > 0;
}

export async function updateTeamMemberRole(db: Database, teamId: string, userId: string, role: string): Promise<boolean> {
    const now = toDate(new Date());
    const sql = `UPDATE team_user SET role = ?, updated_at = ? WHERE team_id = ? AND user_id = ?`;
    const result = await db.execute(sql, [role, now, teamId, userId]);
    return result.meta.changes > 0;
}

export async function joinTeam(db: Database, accessCode: string, userId: string): Promise<Team | null> {
    const team = await db.queryOne<Team>(
        `SELECT team_id as id, name, access_code as accessCode FROM team WHERE access_code = ? AND deleted_at IS NULL`,
        [accessCode]
    );

    if (!team) return null;

    const existing = await db.queryOne<{ id: string }>(
        `SELECT team_user_id as id FROM team_user WHERE team_id = ? AND user_id = ?`,
        [team.id, userId]
    );

    if (existing) return team;

    await addTeamMember(db, team.id, userId, ROLES.teamMember);

    return team;
}
