import app from './worker/index';

export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        return app.fetch(request, env, ctx);
    },
};
