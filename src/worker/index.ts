import { Hono } from 'hono';

interface Env {
    DB?: D1Database;
    KV?: KVNamespace;
    ASSETS?: Fetcher;
    ENVIRONMENT?: string;
    APP_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
    await next();
});

app.get('/', async (c) => {
    const env = c.env;
    
    const status = {
        name: 'Umami Analytics',
        version: '1.0.0',
        platform: 'Cloudflare Workers',
        config: {
            hasDB: !!env.DB,
            hasKV: !!env.KV,
            hasAssets: !!env.ASSETS,
            hasSecret: !!env.APP_SECRET,
            environment: env.ENVIRONMENT || 'not set'
        }
    };
    
    if (!env.DB || !env.APP_SECRET) {
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
        .status { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="error">
        <h1>⚠️ Setup Required</h1>
        <div class="status">
            <strong>Current Status:</strong><br>
            D1 Database: ${env.DB ? '✅ Bound' : '❌ Not bound'}<br>
            APP_SECRET: ${env.APP_SECRET ? '✅ Set' : '❌ Not set'}<br>
            KV Namespace: ${env.KV ? '✅ Bound' : '❌ Not bound'}<br>
            Assets: ${env.ASSETS ? '✅ Bound' : '❌ Not bound'}
        </div>
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
    
    return c.json(status);
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

app.notFound((c) => {
    return c.json({ error: 'Not found', path: c.req.path }, 404);
});

export default app;
