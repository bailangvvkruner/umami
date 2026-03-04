import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, ROLES } from './types';
import { createDatabase } from './lib/db';
import { hash, createSecureToken, uuid } from './lib/crypto';
import { checkAuth, saveAuth, hasPermission } from './lib/auth';
import { getUserByUsername, createUser, getUsers, updateUser } from './queries/user';
import { getWebsiteById, getUserWebsites, createWebsite, updateWebsite, deleteWebsite, resetWebsite } from './queries/website';
import { createSession, getActiveVisitors } from './queries/session';
import { saveEvent, getWebsiteStats, getPageviews, getMetrics, getWebsiteEvents } from './queries/event';
import { getUserTeams, createTeam, getTeamById, deleteTeam, getTeamMembers } from './queries/team';
import bcrypt from 'bcryptjs';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-umami-share-token'],
}));

app.get('/', async (c) => {
    const env = c.env as Env;
    
    if (env.ASSETS) {
        try {
            const url = new URL(c.req.url);
            const asset = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin)));
            if (asset.status === 200) {
                return asset;
            }
        } catch (e) {}
    }
    
    return c.json({ name: 'Umami Analytics', version: '1.0.0', platform: 'Cloudflare Workers' });
});

app.get('/api/config', (c) => {
    return c.json({
        version: '1.0.0',
        locale: 'en-US',
        telemetryDisabled: true,
    });
});

const authApp = new Hono<{ Bindings: Env }>();

authApp.post('/login', async (c) => {
    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ username: string; password: string }>();

    if (!body.username || !body.password) {
        return c.json({ error: 'Username and password required' }, 400);
    }

    const user = await getUserByUsername(db, body.username);

    if (!user) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    const valid = await bcrypt.compare(body.password, user.password);

    if (!valid) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await saveAuth(c, { userId: user.id });

    return c.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
        },
    });
});

authApp.post('/logout', async (c) => {
    return c.json({ success: true });
});

authApp.post('/verify', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json({
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
        },
    });
});

app.route('/api/auth', authApp);

const usersApp = new Hono<{ Bindings: Env }>();

usersApp.post('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user || !hasPermission(user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ username: string; password: string; role?: string }>();

    const existing = await getUserByUsername(db, body.username);
    if (existing) {
        return c.json({ error: 'Username already exists' }, 400);
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const newUser = await createUser(db, {
        username: body.username,
        password: hashedPassword,
        role: body.role || ROLES.user,
    });

    return c.json({
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
    });
});

usersApp.get('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user || !hasPermission(user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const search = c.req.query('search');

    const { data, total } = await getUsers(db, { page, pageSize, search });

    return c.json({ data, total, page, pageSize });
});

app.route('/api/users', usersApp);

const meApp = new Hono<{ Bindings: Env }>();

meApp.get('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json({
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
    });
});

meApp.get('/websites', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, total } = await getUserWebsites(db, user.id, { page, pageSize });

    return c.json({ data, total, page, pageSize });
});

meApp.get('/teams', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, total } = await getUserTeams(db, user.id, { page, pageSize });

    return c.json({ data, total, page, pageSize });
});

meApp.post('/password', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ currentPassword: string; newPassword: string }>();

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) {
        return c.json({ error: 'Current password is incorrect' }, 400);
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    await updateUser(db, user.id, { password: hashedPassword });

    return c.json({ success: true });
});

app.route('/api/me', meApp);

const websitesApp = new Hono<{ Bindings: Env }>();

websitesApp.post('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ name: string; domain?: string; shareId?: string }>();

    const website = await createWebsite(db, {
        name: body.name,
        domain: body.domain,
        shareId: body.shareId,
        userId: user.id,
    });

    return c.json(website);
});

websitesApp.get('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, total } = await getUserWebsites(db, user.id, { page, pageSize });

    return c.json({ data, total, page, pageSize });
});

websitesApp.get('/:websiteId', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json(website);
});

websitesApp.put('/:websiteId', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user.id && !hasPermission(user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{ name?: string; domain?: string; shareId?: string }>();
    const updated = await updateWebsite(db, websiteId, body);

    return c.json(updated);
});

websitesApp.delete('/:websiteId', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user.id && !hasPermission(user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await deleteWebsite(db, websiteId);

    return c.json({ success: true });
});

websitesApp.post('/:websiteId/reset', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user.id && !hasPermission(user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await resetWebsite(db, websiteId);

    return c.json({ success: true });
});

websitesApp.get('/:websiteId/stats', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = c.req.query('startAt') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endAt = c.req.query('endAt') || new Date().toISOString();

    const stats = await getWebsiteStats(db, websiteId, startAt, endAt);

    return c.json(stats);
});

websitesApp.get('/:websiteId/pageviews', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = c.req.query('startAt') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endAt = c.req.query('endAt') || new Date().toISOString();
    const unit = (c.req.query('unit') as 'hour' | 'day' | 'month') || 'day';

    const pageviews = await getPageviews(db, websiteId, startAt, endAt, unit);

    return c.json(pageviews);
});

websitesApp.get('/:websiteId/metrics', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = c.req.query('startAt') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endAt = c.req.query('endAt') || new Date().toISOString();
    const type = c.req.query('type') || 'url';
    const limit = parseInt(c.req.query('limit') || '10');

    const fieldMap: Record<string, string> = {
        url: 'url_path',
        referrer: 'referrer_domain',
        browser: 'browser',
        os: 'os',
        device: 'device',
        country: 'country',
        city: 'city',
        event: 'event_name',
    };

    const field = fieldMap[type] || 'url_path';
    const metrics = await getMetrics(db, websiteId, startAt, endAt, field, limit);

    return c.json(metrics);
});

websitesApp.get('/:websiteId/active', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const count = await getActiveVisitors(db, websiteId);

    return c.json([{ x: 'active', y: count }]);
});

websitesApp.get('/:websiteId/events', async (c) => {
    const { user, shareToken } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    
    if (!websiteId) {
        return c.json({ error: 'Website ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    if (website.userId !== user?.id && !shareToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const startAt = c.req.query('startAt');
    const endAt = c.req.query('endAt');
    const eventName = c.req.query('eventName');

    const { data, total } = await getWebsiteEvents(db, websiteId, {
        page,
        pageSize,
        startAt,
        endAt,
        eventName,
    });

    return c.json({ data, total, page, pageSize });
});

app.route('/api/websites', websitesApp);

const teamsApp = new Hono<{ Bindings: Env }>();

teamsApp.post('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ name: string }>();

    const team = await createTeam(db, {
        name: body.name,
        userId: user.id,
    });

    return c.json(team);
});

teamsApp.get('/', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, total } = await getUserTeams(db, user.id, { page, pageSize });

    return c.json({ data, total, page, pageSize });
});

teamsApp.get('/:teamId', async (c) => {
    const { user } = await checkAuth(c);
    const teamId = c.req.param('teamId');
    
    if (!teamId) {
        return c.json({ error: 'Team ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const team = await getTeamById(db, teamId);

    if (!team) {
        return c.json({ error: 'Team not found' }, 404);
    }

    return c.json(team);
});

teamsApp.delete('/:teamId', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    
    if (!teamId) {
        return c.json({ error: 'Team ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const team = await getTeamById(db, teamId);

    if (!team) {
        return c.json({ error: 'Team not found' }, 404);
    }

    await deleteTeam(db, teamId);

    return c.json({ success: true });
});

teamsApp.get('/:teamId/users', async (c) => {
    const { user } = await checkAuth(c);

    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    
    if (!teamId) {
        return c.json({ error: 'Team ID required' }, 400);
    }
    
    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, total } = await getTeamMembers(db, teamId, { page, pageSize });

    return c.json({ data, total, page, pageSize });
});

app.route('/api/teams', teamsApp);

const sendApp = new Hono<{ Bindings: Env }>();

sendApp.post('/', async (c) => {
    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{
        website: string;
        hostname?: string;
        url: string;
        referrer?: string;
        title?: string;
        language?: string;
        screen?: string;
        name?: string;
        tag?: string;
        data?: Record<string, any>;
        cache?: boolean;
    }>();

    const website = await getWebsiteById(db, body.website);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    let url: URL;
    try {
        url = new URL(body.url, `https://${body.hostname || 'localhost'}`);
    } catch {
        return c.json({ error: 'Invalid URL' }, 400);
    }

    let referrer: URL | null = null;
    if (body.referrer) {
        try {
            referrer = new URL(body.referrer);
        } catch {
            referrer = null;
        }
    }

    const sessionId = uuid();
    const visitId = uuid();

    await createSession(db, {
        websiteId: website.id,
        language: body.language,
        screen: body.screen,
    });

    await saveEvent(db, {
        websiteId: website.id,
        sessionId,
        visitId,
        eventType: body.name ? 2 : 1,
        urlPath: url.pathname,
        urlQuery: url.search,
        hostname: body.hostname,
        pageTitle: body.title,
        referrerPath: referrer?.pathname,
        referrerDomain: referrer?.hostname,
        eventName: body.name,
        tag: body.tag,
    });

    return c.json({ success: true });
});

app.route('/api/send', sendApp);

app.get('/api/share/:shareId', async (c) => {
    const shareId = c.req.param('shareId');
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteById(db, shareId);

    if (!website || !website.shareId) {
        return c.json({ error: 'Website not found' }, 404);
    }

    return c.json({
        id: website.id,
        name: website.name,
        domain: website.domain,
    });
});

app.get('/api/heartbeat', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/favicon.ico', async (c) => {
    return c.redirect('https://umami.is/favicon.ico');
});

app.notFound(async (c) => {
    const env = c.env as Env;
    
    if (env.ASSETS) {
        try {
            const url = new URL(c.req.url);
            let path = url.pathname;
            
            if (path === '/' || !path.includes('.')) {
                path = '/index.html';
            }
            
            const asset = await env.ASSETS.fetch(new Request(new URL(path, url.origin)));
            if (asset.status === 200) {
                return asset;
            }
        } catch (e) {}
    }
    
    if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'Not found' }, 404);
    }
    
    return c.html(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Umami Analytics</title>
    <meta http-equiv="refresh" content="0;url=/">
</head>
<body>
    <p>Redirecting to <a href="/">home</a>...</p>
</body>
</html>
    `);
});

export default app;
