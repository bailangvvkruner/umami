import app from './worker/index';

export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        try {
            return await app.fetch(request, env, ctx);
        } catch (err: any) {
            console.error('Worker fetch error:', err);
            return new Response(JSON.stringify({
                error: err?.message || 'Internal Server Error',
                stack: err?.stack,
                hint: 'Check if D1 database and APP_SECRET are configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },
};
