import { Context } from 'hono';
import { Env, User, ROLES, ROLE_PERMISSIONS } from './types';
import { parseSecureToken, parseToken, createSecureToken, hash, uuid } from './crypto';
import { Database, createDatabase } from './db';
import { getUserById } from './queries/user';

export function getBearerToken(c: Context): string | undefined {
    const auth = c.req.header('authorization');
    return auth?.split(' ')[1];
}

export async function checkAuth(c: Context): Promise<{ user: User | null; token?: string; auth?: any }> {
    const env = c.env as Env;
    const token = getBearerToken(c);
    const secret = await hash(env.APP_SECRET);

    const payload = await parseSecureToken(token, secret);

    let user: User | null = null;
    const { userId, role } = payload || {};

    if (userId) {
        const db = createDatabase(env);
        user = await getUserById(db, userId);
    }

    if (user) {
        (user as any).isAdmin = user.role === ROLES.admin;
    }

    return {
        token,
        auth: { user, token },
        user,
    };
}

export async function saveAuth(c: Context, data: { userId: string; role: string }, expire: number = 0): Promise<string> {
    const env = c.env as Env;
    const secret = await hash(env.APP_SECRET);

    return createSecureToken(data, secret);
}

export function hasPermission(role: string, permission: string | string[]): boolean {
    const permissions = Array.isArray(permission) ? permission : [permission];
    return permissions.some(p => ROLE_PERMISSIONS[role]?.includes(p) || ROLE_PERMISSIONS[role]?.includes('all'));
}

export async function canViewWebsite(auth: any, websiteId: string, db: Database): Promise<boolean> {
    if (!auth?.user) return false;
    if (auth.user.role === ROLES.admin) return true;
    
    const website = await db.queryOne<{ userId: string; teamId: string }>(
        'SELECT user_id as userId, team_id as teamId FROM website WHERE website_id = ? AND deleted_at IS NULL',
        [websiteId]
    );
    
    if (!website) return false;
    if (website.userId === auth.user.id) return true;
    
    if (website.teamId) {
        const teamUser = await db.queryOne<{ role: string }>(
            'SELECT role FROM team_user WHERE team_id = ? AND user_id = ?',
            [website.teamId, auth.user.id]
        );
        if (teamUser) return true;
    }
    
    return false;
}
