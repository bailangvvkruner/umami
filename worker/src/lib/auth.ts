import { Context } from 'hono';
import { Env, User, ROLES, ROLE_PERMISSIONS, SHARE_TOKEN_HEADER } from '../types';
import { parseSecureToken, parseToken, createSecureToken, hash, uuid } from './crypto';
import { Database, createDatabase } from './db';
import { getUserById } from '../queries/user';

export function getBearerToken(c: Context): string | undefined {
    const auth = c.req.header('authorization');
    return auth?.split(' ')[1];
}

export async function checkAuth(c: Context): Promise<{ user: User | null; token?: string; shareToken?: any }> {
    const env = c.env as Env;
    const token = getBearerToken(c);
    const secret = await hash(env.APP_SECRET);

    const payload = await parseSecureToken(token, secret);
    const shareToken = await parseShareToken(c);

    let user: User | null = null;
    const { userId, authKey } = payload || {};

    if (userId) {
        const db = createDatabase(env);
        user = await getUserById(db, userId);
    } else if (authKey) {
        const authData = await env.KV.get(authKey, 'json') as { userId?: string } | null;
        if (authData?.userId) {
            const db = createDatabase(env);
            user = await getUserById(db, authData.userId);
        }
    }

    if (!user?.id && !shareToken) {
        return { user: null };
    }

    if (user) {
        (user as any).isAdmin = user.role === ROLES.admin;
    }

    return {
        token,
        shareToken,
        user,
    };
}

export async function saveAuth(c: Context, data: { userId: string }, expire: number = 0): Promise<string> {
    const env = c.env as Env;
    const secret = await hash(env.APP_SECRET);
    const authKey = `auth:${uuid()}`;

    await env.KV.put(authKey, JSON.stringify(data), {
        expirationTtl: expire > 0 ? expire : undefined,
    });

    return createSecureToken({ authKey }, secret);
}

export function hasPermission(role: string, permission: string | string[]): boolean {
    const permissions = Array.isArray(permission) ? permission : [permission];
    return permissions.some(p => ROLE_PERMISSIONS[role]?.includes(p) || ROLE_PERMISSIONS[role]?.includes('all'));
}

export async function parseShareToken(c: Context): Promise<any> {
    try {
        const env = c.env as Env;
        const secret = await hash(env.APP_SECRET);
        return parseToken(c.req.header(SHARE_TOKEN_HEADER), secret);
    } catch {
        return null;
    }
}

export async function createSession(c: Context, userId: string): Promise<string> {
    const env = c.env as Env;
    const secret = await hash(env.APP_SECRET);
    const token = await createSecureToken({ userId }, secret);
    return token;
}

export async function verifyToken(token: string, secret: string): Promise<any> {
    return parseSecureToken(token, secret);
}
