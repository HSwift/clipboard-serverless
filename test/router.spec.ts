import { describe, expect, it } from 'vitest';
import { Router } from '../src/router';

describe('Router', () => {
	it('prefers a static route over a parameter route regardless of registration order', async () => {
		const router = new Router();

		router.get('/api/clip/:id', (_req, params) => new Response(`id:${params.id}`));
		router.get('/api/clip/latest', () => new Response('latest'));

		const match = router.match('GET', '/api/clip/latest');
		expect(match).not.toBeNull();

		const response = await match!.handler(new Request('https://example.com/api/clip/latest'), match!.params);
		expect(await response.text()).toBe('latest');
	});
});
