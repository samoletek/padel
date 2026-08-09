import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            localApiPlugin(env),
        ],
        server: {
            port: 3000,
            host: true,
        },
    };
});

/**
 * Serves /api/* from the local `api/` directory during development.
 * In production Vercel routes these to serverless functions automatically.
 */
function localApiPlugin(env) {
    return {
        name: 'local-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url?.startsWith('/api/')) return next();

                Object.assign(process.env, env);

                const routePath = req.url.split('?')[0];
                const modulePath = `.${routePath}.js`;

                try {
                    const mod = await server.ssrLoadModule(modulePath);
                    const handler = mod.default;

                    if (req.method === 'POST') {
                        const chunks = [];
                        for await (const chunk of req) chunks.push(chunk);
                        const raw = Buffer.concat(chunks).toString();
                        req.body = raw ? JSON.parse(raw) : {};
                    }

                    const vercelRes = {
                        statusCode: 200,
                        _headers: { 'Content-Type': 'application/json' },
                        setHeader(name, value) { this._headers[name] = value; return this; },
                        status(code) { this.statusCode = code; return this; },
                        json(data) {
                            res.writeHead(this.statusCode, this._headers);
                            res.end(JSON.stringify(data));
                        },
                        end() {
                            res.writeHead(this.statusCode, this._headers);
                            res.end();
                        },
                    };

                    await handler(req, vercelRes);
                } catch (err) {
                    console.error('Local API error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        },
    };
}
