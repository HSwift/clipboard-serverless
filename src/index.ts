import { Router } from './router';
import { verifyAuth, unauthorizedResponse } from './auth';
import { createStore } from './store';
import { clipHandlers } from './handlers/clip';
import { shareHandlers } from './handlers/share';
import { gcHandlers } from './handlers/gc';
import type { AppEnv } from './types';

function buildRouter(env: AppEnv, url: URL): Router {
	const store = createStore(env);
	const clip = clipHandlers(store);
	const share = shareHandlers(store, url.origin);
	const ttlDays = parseInt(env.DEFAULT_TTL_DAYS, 10) || 30;
	const gc = gcHandlers(store, ttlDays);

	const router = new Router();

	// Private clip endpoints
	router.post('/api/clip', (req) => clip.push(req));
	router.get('/api/clip', (req) => clip.list(req));
	router.get('/api/clip/latest', (req) => clip.latest(req));
	router.get('/api/clip/:id', (req, p) => clip.getById(req, p));
	router.get('/api/clip/:id/raw', (req, p) => clip.getRaw(req, p));
	router.delete('/api/clip/:id', (req, p) => clip.remove(req, p));

	// Private share creation
	router.get('/api/clip/latest/share', (req) => share.createLatestShare(req));
	router.post('/api/clip/:id/share', (req, p) => share.createShare(req, p));

	// Private GC
	router.post('/api/gc', (req) => gc.manualGc(req));

	// Public share access
	router.get('/s/:shareId', (req, p) => share.getShared(req, p));

	return router;
}

const PUBLIC_PATHS = ['/s/'];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default {
	async fetch(request: Request, env: AppEnv, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Device, X-Filename',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		if (!isPublicPath(url.pathname) && !verifyAuth(request, env.AUTH_TOKEN)) {
			return unauthorizedResponse();
		}

		const router = buildRouter(env, url);
		const match = router.match(request.method, url.pathname);

		if (!match) {
			return new Response(JSON.stringify({ error: 'Not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		try {
			const response = await match.handler(request, match.params);
			response.headers.set('Access-Control-Allow-Origin', '*');
			return response;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Internal error';
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async scheduled(_event: ScheduledEvent, env: AppEnv, _ctx: ExecutionContext): Promise<void> {
		const store = createStore(env);
		const ttlDays = parseInt(env.DEFAULT_TTL_DAYS, 10) || 30;
		const gc = gcHandlers(store, ttlDays);
		await gc.scheduledGc();
	},
} satisfies ExportedHandler<AppEnv>;
