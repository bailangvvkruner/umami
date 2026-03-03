import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, ROLES, EVENT_TYPES, COLLECTION_TYPES } from './types';
import { createDatabase, toDate } from './lib/db';
import { hash, createSecureToken, parseSecureToken, parseToken, createToken, uuid } from './lib/crypto';
import { checkAuth, saveAuth, hasPermission, canViewWebsite } from './lib/auth';
import { getUserByUsername, createUser, getUsers, getUserById, updateUser, deleteUser, getUserTeams } from './queries/user';
import { getWebsiteById, getUserWebsites, createWebsite, updateWebsite, deleteWebsite, resetWebsite, transferWebsite, getWebsiteByShareId } from './queries/website';
import { createSession, getSessionById, getWebsiteSessions, getSessionStats, generateSessionId, generateVisitId } from './queries/session';
import { saveEvent, getWebsiteStats, getPageviews, getMetrics, getActiveVisitors, getWebsiteEvents, saveEventData } from './queries/event';
import { getTeamById, getUserTeams as getUserTeamsQuery, createTeam, deleteTeam, getTeamMembers, addTeamMember, removeTeamMember, joinTeam } from './queries/team';
import bcrypt from 'bcryptjs';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-umami-share-token', 'x-umami-cache'],
}));

app.onError((err, c) => {
    console.error('Worker Error:', err);
    return c.json({
        error: err.message || 'Internal Server Error',
        setup: 'Please ensure D1 database and APP_SECRET are configured in Cloudflare Dashboard'
    }, 500);
});

function checkSetup(env: Env): { ok: boolean; error?: string } {
    if (!env.DB) {
        return { ok: false, error: 'D1 database not bound. Please bind a D1 database with variable name "DB" in Cloudflare Dashboard.' };
    }
    if (!env.APP_SECRET) {
        return { ok: false, error: 'APP_SECRET not set. Please add APP_SECRET in Cloudflare Dashboard > Workers > Settings > Variables.' };
    }
    return { ok: true };
}

app.get('/', async (c) => {
    const env = c.env as Env;
    const setup = checkSetup(env);
    
    if (!setup.ok) {
        return c.html(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Umami - Setup Required</title>
    <style>
        body { font-family: system-ui; max-width: 600px; margin: 80px auto; padding: 20px; }
        .error { background: #fee; border: 1px solid #f88; padding: 20px; border-radius: 8px; }
        h1 { color: #c00; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
        ol { line-height: 1.8; }
    </style>
</head>
<body>
    <div class="error">
        <h1>⚠️ Setup Required</h1>
        <p>${setup.error}</p>
        <h3>Setup Instructions:</h3>
        <ol>
            <li>Go to <a href="https://dash.cloudflare.com" target="_blank">Cloudflare Dashboard</a></li>
            <li>Navigate to <strong>Workers & Pages</strong> → <strong>umami</strong></li>
            <li>Go to <strong>Settings</strong> → <strong>Bindings</strong></li>
            <li>Add <strong>D1 Database</strong> binding: Variable name = <code>DB</code></li>
            <li>Go to <strong>Settings</strong> → <strong>Variables and Secrets</strong></li>
            <li>Add variable: Name = <code>APP_SECRET</code>, Value = (any 32+ character string)</li>
            <li>Redeploy the worker</li>
        </ol>
    </div>
</body>
</html>`);
    }
    
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

app.get('/api/heartbeat', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const authApp = new Hono<{ Bindings: Env }>();

authApp.post('/login', async (c) => {
    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ username: string; password: string }>();

    if (!body.username || !body.password) {
        return c.json({ error: 'Username and password required' }, 400);
    }

    const user = await getUserByUsername(db, body.username, true);

    if (!user) {
        return c.json({ error: 'incorrect-username-password' }, 401);
    }

    const valid = await bcrypt.compare(body.password, user.password);

    if (!valid) {
        return c.json({ error: 'incorrect-username-password' }, 401);
    }

    const token = await saveAuth(c, { userId: user.id, role: user.role });
    const teams = await getUserTeams(db, user.id);

    return c.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            isAdmin: user.role === ROLES.admin,
            teams,
        },
    });
});

authApp.post('/logout', async (c) => {
    return c.json({ success: true });
});

authApp.post('/verify', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json(auth);
});

app.route('/api/auth', authApp);

const usersApp = new Hono<{ Bindings: Env }>();

usersApp.post('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user || !hasPermission(auth.user.role, 'all')) {
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
    const { auth } = await checkAuth(c);

    if (!auth?.user || !hasPermission(auth.user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const search = c.req.query('search');

    const { data, count } = await getUsers(db, { page, pageSize, search });

    return c.json({ data, count, page, pageSize });
});

usersApp.get('/:userId', async (c) => {
    const { auth } = await checkAuth(c);
    const userId = c.req.param('userId');

    if (!auth?.user || (!hasPermission(auth.user.role, 'all') && auth.user.id !== userId)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const user = await getUserById(db, userId);
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        createdAt: user.createdAt,
    });
});

usersApp.put('/:userId', async (c) => {
    const { auth } = await checkAuth(c);
    const userId = c.req.param('userId');

    if (!auth?.user || (!hasPermission(auth.user.role, 'all') && auth.user.id !== userId)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ username?: string; password?: string; role?: string; displayName?: string }>();

    if (body.password) {
        body.password = await bcrypt.hash(body.password, 10);
    }

    const user = await updateUser(db, userId, body);
    return c.json(user);
});

usersApp.delete('/:userId', async (c) => {
    const { auth } = await checkAuth(c);
    const userId = c.req.param('userId');

    if (!auth?.user || !hasPermission(auth.user.role, 'all')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    await deleteUser(db, userId);
    return c.json({ success: true });
});

usersApp.get('/:userId/websites', async (c) => {
    const { auth } = await checkAuth(c);
    const userId = c.req.param('userId');

    if (!auth?.user || (!hasPermission(auth.user.role, 'all') && auth.user.id !== userId)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, count } = await getUserWebsites(db, userId, { page, pageSize });

    return c.json({ data, count, page, pageSize });
});

usersApp.get('/:userId/teams', async (c) => {
    const { auth } = await checkAuth(c);
    const userId = c.req.param('userId');

    if (!auth?.user || (!hasPermission(auth.user.role, 'all') && auth.user.id !== userId)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const teams = await getUserTeams(db, userId);
    return c.json(teams);
});

app.route('/api/users', usersApp);

const meApp = new Hono<{ Bindings: Env }>();

meApp.get('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json(auth);
});

meApp.get('/websites', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const includeTeams = c.req.query('includeTeams') === 'true';

    const { data, count } = await getUserWebsites(db, auth.user.id, { page, pageSize, includeTeams });

    return c.json({ data, count, page, pageSize });
});

meApp.get('/teams', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, count } = await getUserTeamsQuery(db, auth.user.id, { page, pageSize });

    return c.json({ data, count, page, pageSize });
});

meApp.post('/password', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ currentPassword: string; newPassword: string }>();

    const user = await getUserById(db, auth.user.id);
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

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
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ name: string; domain?: string; shareId?: string; teamId?: string; id?: string }>();

    const website = await createWebsite(db, {
        id: body.id,
        name: body.name,
        domain: body.domain,
        shareId: body.shareId,
        userId: body.teamId ? undefined : auth.user.id,
        teamId: body.teamId,
        createdBy: auth.user.id,
    });

    return c.json(website);
});

websitesApp.get('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const includeTeams = c.req.query('includeTeams') === 'true';

    const { data, count } = await getUserWebsites(db, auth.user.id, { page, pageSize, includeTeams });

    return c.json({ data, count, page, pageSize });
});

const websiteApp = new Hono<{ Bindings: Env }>();

websiteApp.get('/', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const website = await getWebsiteById(db, websiteId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    return c.json(website);
});

websiteApp.put('/', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{ name?: string; domain?: string; shareId?: string }>();
    const updated = await updateWebsite(db, websiteId, body);

    return c.json(updated);
});

websiteApp.delete('/', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await deleteWebsite(db, websiteId);

    return c.json({ success: true });
});

websiteApp.post('/reset', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await resetWebsite(db, websiteId);

    return c.json({ success: true });
});

websiteApp.post('/transfer', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ userId: string }>();

    const website = await getWebsiteById(db, websiteId);
    if (!website || website.userId !== auth.user.id) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    await transferWebsite(db, websiteId, body.userId);

    return c.json({ success: true });
});

websiteApp.get('/stats', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = parseInt(c.req.query('startAt') || String(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const endAt = parseInt(c.req.query('endAt') || String(Date.now()));

    const stats = await getWebsiteStats(db, websiteId, startAt, endAt);

    return c.json(stats);
});

websiteApp.get('/pageviews', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = parseInt(c.req.query('startAt') || String(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const endAt = parseInt(c.req.query('endAt') || String(Date.now()));
    const unit = (c.req.query('unit') as 'hour' | 'day' | 'month') || 'day';

    const pageviews = await getPageviews(db, websiteId, startAt, endAt, unit);

    return c.json(pageviews);
});

websiteApp.get('/metrics', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const startAt = parseInt(c.req.query('startAt') || String(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const endAt = parseInt(c.req.query('endAt') || String(Date.now()));
    const type = c.req.query('type') || 'url';
    const limit = parseInt(c.req.query('limit') || '10');

    const metrics = await getMetrics(db, websiteId, startAt, endAt, type, limit);

    return c.json(metrics);
});

websiteApp.get('/active', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const count = await getActiveVisitors(db, websiteId);

    return c.json([{ x: 'active', y: count }]);
});

websiteApp.get('/events', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const startAt = c.req.query('startAt') ? parseInt(c.req.query('startAt')!) : undefined;
    const endAt = c.req.query('endAt') ? parseInt(c.req.query('endAt')!) : undefined;
    const eventName = c.req.query('eventName');

    const { data, count } = await getWebsiteEvents(db, websiteId, {
        page,
        pageSize,
        startAt,
        endAt,
        eventName,
    });

    return c.json({ data, count, page, pageSize });
});

websiteApp.get('/sessions', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const startAt = c.req.query('startAt') ? parseInt(c.req.query('startAt')!) : undefined;
    const endAt = c.req.query('endAt') ? parseInt(c.req.query('endAt')!) : undefined;

    const { data, count } = await getWebsiteSessions(db, websiteId, {
        page,
        pageSize,
        startAt,
        endAt,
    });

    return c.json({ data, count, page, pageSize });
});

websitesApp.route('/:websiteId', websiteApp);

app.route('/api/websites', websitesApp);

const teamsApp = new Hono<{ Bindings: Env }>();

teamsApp.post('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ name: string }>();

    const team = await createTeam(db, {
        name: body.name,
        userId: auth.user.id,
    });

    return c.json(team);
});

teamsApp.get('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, count } = await getUserTeamsQuery(db, auth.user.id, { page, pageSize });

    return c.json({ data, count, page, pageSize });
});

teamsApp.post('/join', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ accessCode: string }>();

    const team = await joinTeam(db, body.accessCode, auth.user.id);

    if (!team) {
        return c.json({ error: 'Invalid access code' }, 400);
    }

    return c.json(team);
});

const teamApp = new Hono<{ Bindings: Env }>();

teamApp.get('/', async (c) => {
    const { auth } = await checkAuth(c);
    const teamId = c.req.param('teamId');
    const env = c.env as Env;
    const db = createDatabase(env);

    const team = await getTeamById(db, teamId);

    if (!team) {
        return c.json({ error: 'Team not found' }, 404);
    }

    return c.json(team);
});

teamApp.delete('/', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const env = c.env as Env;
    const db = createDatabase(env);

    await deleteTeam(db, teamId);

    return c.json({ success: true });
});

teamApp.get('/users', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, count } = await getTeamMembers(db, teamId, { page, pageSize });

    return c.json({ data, count, page, pageSize });
});

teamApp.post('/users', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const env = c.env as Env;
    const db = createDatabase(env);
    const body = await c.req.json<{ userId: string; role?: string }>();

    const teamUser = await addTeamMember(db, teamId, body.userId, body.role);

    return c.json(teamUser);
});

teamApp.delete('/users/:userId', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const userId = c.req.param('userId');
    const env = c.env as Env;
    const db = createDatabase(env);

    await removeTeamMember(db, teamId, userId);

    return c.json({ success: true });
});

teamApp.get('/websites', async (c) => {
    const { auth } = await checkAuth(c);

    if (!auth?.user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const env = c.env as Env;
    const db = createDatabase(env);

    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');

    const { data, count } = await getUserWebsites(db, auth.user.id, { page, pageSize });

    return c.json({ data, count, page, pageSize });
});

teamsApp.route('/:teamId', teamApp);

app.route('/api/teams', teamsApp);

const sendApp = new Hono<{ Bindings: Env }>();

sendApp.post('/', async (c) => {
    const env = c.env as Env;
    const db = createDatabase(env);
    const secret = await hash(env.APP_SECRET);
    
    const body = await c.req.json<{
        type: 'event' | 'identify';
        payload: {
            website?: string;
            link?: string;
            pixel?: string;
            hostname?: string;
            url?: string;
            referrer?: string;
            title?: string;
            language?: string;
            screen?: string;
            name?: string;
            tag?: string;
            data?: Record<string, any>;
            timestamp?: number;
            id?: string;
            ip?: string;
            userAgent?: string;
            browser?: string;
            os?: string;
            device?: string;
        };
    }>();

    const { type, payload } = body;
    const {
        website: websiteId,
        link: linkId,
        pixel: pixelId,
        hostname,
        screen,
        language,
        url,
        referrer,
        name,
        data,
        title,
        tag,
        timestamp,
        id: distinctId,
    } = payload;

    const sourceId = websiteId || pixelId || linkId;

    if (!sourceId) {
        return c.json({ error: 'Website, link, or pixel ID required' }, 400);
    }

    let cache: { websiteId: string; sessionId: string; visitId: string; iat: number } | null = null;

    const cacheHeader = c.req.header('x-umami-cache');
    if (cacheHeader) {
        cache = parseToken(cacheHeader, secret) as any;
    }

    if (!cache?.websiteId) {
        const website = await getWebsiteById(db, sourceId);
        if (!website) {
            return c.json({ error: 'Website not found' }, 400);
        }
    }

    const createdAt = timestamp ? new Date(timestamp * 1000) : new Date();
    const now = Math.floor(Date.now() / 1000);

    const ip = payload.ip || c.req.header('cf-connecting-ip') || '';
    const userAgent = payload.userAgent || c.req.header('user-agent') || '';

    const sessionId = distinctId
        ? generateSessionId(sourceId, distinctId, '', createdAt)
        : cache?.sessionId || generateSessionId(sourceId, ip, userAgent, createdAt);

    let visitId = cache?.visitId || generateVisitId(sessionId, createdAt);
    let iat = cache?.iat || now;

    if (!timestamp && now - iat > 1800) {
        visitId = generateVisitId(sessionId, createdAt);
        iat = now;
    }

    if (type === COLLECTION_TYPES.event) {
        const base = hostname ? `https://${hostname}` : 'https://localhost';
        let currentUrl: URL;
        
        try {
            currentUrl = new URL(url || '', base);
        } catch {
            return c.json({ error: 'Invalid URL' }, 400);
        }

        let urlPath = currentUrl.pathname === '/undefined' ? '' : currentUrl.pathname + currentUrl.hash;
        const urlQuery = currentUrl.search.substring(1);

        let referrerPath: string | undefined;
        let referrerQuery: string | undefined;
        let referrerDomain: string | undefined;

        const utmSource = currentUrl.searchParams.get('utm_source');
        const utmMedium = currentUrl.searchParams.get('utm_medium');
        const utmCampaign = currentUrl.searchParams.get('utm_campaign');
        const utmContent = currentUrl.searchParams.get('utm_content');
        const utmTerm = currentUrl.searchParams.get('utm_term');

        const gclid = currentUrl.searchParams.get('gclid');
        const fbclid = currentUrl.searchParams.get('fbclid');
        const msclkid = currentUrl.searchParams.get('msclkid');
        const ttclid = currentUrl.searchParams.get('ttclid');
        const lifatid = currentUrl.searchParams.get('li_fat_id');
        const twclid = currentUrl.searchParams.get('twclid');

        if (referrer) {
            try {
                const referrerUrl = new URL(referrer, base);
                referrerPath = referrerUrl.pathname;
                referrerQuery = referrerUrl.search.substring(1);
                referrerDomain = referrerUrl.hostname.replace(/^www\./, '');
            } catch {}
        }

        const eventType = linkId
            ? EVENT_TYPES.linkEvent
            : pixelId
                ? EVENT_TYPES.pixelEvent
                : name
                    ? EVENT_TYPES.customEvent
                    : EVENT_TYPES.pageView;

        await saveEvent(db, {
            websiteId: sourceId,
            sessionId,
            visitId,
            eventType,
            createdAt,

            pageTitle: title,
            hostname: hostname || currentUrl.hostname,
            urlPath: decodeURIComponent(urlPath),
            urlQuery,
            referrerPath: referrerPath ? decodeURIComponent(referrerPath) : undefined,
            referrerQuery,
            referrerDomain,

            distinctId,
            browser: payload.browser,
            os: payload.os,
            device: payload.device,
            screen,
            language,

            eventName: name,
            eventData: data,
            tag,

            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            utmTerm,

            gclid,
            fbclid,
            msclkid,
            ttclid,
            lifatid,
            twclid,
        });
    } else if (type === COLLECTION_TYPES.identify) {
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                const id = uuid();
                const now = toDate(createdAt);

                let stringValue: string | null = null;
                let numberValue: number | null = null;
                let dataType = 1;

                if (typeof value === 'number') {
                    numberValue = value;
                    dataType = 2;
                } else {
                    stringValue = String(value);
                }

                await db.execute(
                    `INSERT INTO session_data (session_data_id, website_id, session_id, data_key, string_value, number_value, data_type, distinct_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, sourceId, sessionId, key, stringValue, numberValue, dataType, distinctId, now]
                );
            }
        }
    }

    const token = createToken({ websiteId: sourceId, sessionId, visitId, iat }, secret);

    return c.json({ cache: token, sessionId, visitId });
});

app.route('/api/send', sendApp);

app.get('/api/share/:shareId', async (c) => {
    const shareId = c.req.param('shareId');
    const env = c.env as Env;
    const db = createDatabase(env);

    const website = await getWebsiteByShareId(db, shareId);

    if (!website) {
        return c.json({ error: 'Website not found' }, 404);
    }

    return c.json({
        id: website.id,
        name: website.name,
        domain: website.domain,
    });
});

app.get('/api/realtime/:websiteId', async (c) => {
    const { auth } = await checkAuth(c);
    const websiteId = c.req.param('websiteId');
    const env = c.env as Env;
    const db = createDatabase(env);

    if (!await canViewWebsite(auth, websiteId, db)) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const now = Date.now();
    const startAt = now - 30 * 60 * 1000;

    const [pageviews, visitors] = await Promise.all([
        getPageviews(db, websiteId, startAt, now, 'minute'),
        getActiveVisitors(db, websiteId),
    ]);

    return c.json({
        pageviews,
        visitors,
        timestamp: now,
    });
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
            
            if (!path.includes('.')) {
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
