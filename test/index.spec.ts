import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

const AUTH = { Authorization: 'Bearer test-secret-token' };

describe('clipboard-serverless', () => {
	describe('auth', () => {
		it('rejects unauthenticated requests', async () => {
			const res = await SELF.fetch('https://example.com/api/clip');
			expect(res.status).toBe(401);
		});

		it('allows token via query param', async () => {
			const res = await SELF.fetch('https://example.com/api/clip?token=test-secret-token');
			expect(res.status).toBe(200);
		});
	});

	describe('clip CRUD', () => {
		it('pushes text and retrieves it', async () => {
			const pushRes = await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain', 'X-Device': 'test-device' },
				body: 'hello clipboard',
			});
			expect(pushRes.status).toBe(201);
			const clip = await pushRes.json<{ id: string; device: string; type: string; size: number }>();
			expect(clip.id).toBeTruthy();
			expect(clip.device).toBe('test-device');
			expect(clip.type).toBe('text/plain');
			expect(clip.size).toBe(15);

			const rawRes = await SELF.fetch(`https://example.com/api/clip/${clip.id}/raw`, {
				headers: AUTH,
			});
			expect(rawRes.status).toBe(200);
			expect(await rawRes.text()).toBe('hello clipboard');
			expect(rawRes.headers.get('Content-Type')).toBe('text/plain');
		});

		it('lists clips', async () => {
			await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain' },
				body: 'list-test',
			});

			const listRes = await SELF.fetch('https://example.com/api/clip', { headers: AUTH });
			expect(listRes.status).toBe(200);
			const data = await listRes.json<{ clips: unknown[]; count: number }>();
			expect(data.clips.length).toBeGreaterThan(0);
			expect(data.count).toBeGreaterThan(0);
		});

		it('gets latest clip content', async () => {
			await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain', 'X-Device': 'dev-a' },
				body: 'latest-content',
			});

			const res = await SELF.fetch('https://example.com/api/clip/latest', { headers: AUTH });
			expect(res.status).toBe(200);
			expect(await res.text()).toBe('latest-content');
		});

		it('gets latest clip metadata with ?meta=true', async () => {
			await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain', 'X-Device': 'dev-meta' },
				body: 'meta-test',
			});

			const res = await SELF.fetch('https://example.com/api/clip/latest?meta=true', { headers: AUTH });
			expect(res.status).toBe(200);
			const meta = await res.json<{ id: string; device: string }>();
			expect(meta.id).toBeTruthy();
			expect(meta.device).toBe('dev-meta');
		});

		it('deletes a clip', async () => {
			const pushRes = await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain' },
				body: 'to-delete',
			});
			const { id } = await pushRes.json<{ id: string }>();

			const delRes = await SELF.fetch(`https://example.com/api/clip/${id}`, {
				method: 'DELETE',
				headers: AUTH,
			});
			expect(delRes.status).toBe(200);

			const getRes = await SELF.fetch(`https://example.com/api/clip/${id}`, { headers: AUTH });
			expect(getRes.status).toBe(404);
		});
	});

	describe('share', () => {
		it('creates a share link and accesses it publicly', async () => {
			const pushRes = await SELF.fetch('https://example.com/api/clip', {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'text/plain' },
				body: 'shared-text',
			});
			const { id } = await pushRes.json<{ id: string }>();

			const shareRes = await SELF.fetch(`https://example.com/api/clip/${id}/share`, {
				method: 'POST',
				headers: { ...AUTH, 'Content-Type': 'application/json' },
				body: JSON.stringify({ ttl: 3600 }),
			});
			expect(shareRes.status).toBe(201);
			const share = await shareRes.json<{ shareId: string; url: string; expiresAt: number }>();
			expect(share.url).toContain('/s/');
			expect(share.expiresAt).toBeGreaterThan(0);

			// Access without auth
			const publicRes = await SELF.fetch(share.url);
			expect(publicRes.status).toBe(200);
			expect(await publicRes.text()).toBe('shared-text');
		});
	});

	describe('gc', () => {
		it('runs manual gc', async () => {
			const res = await SELF.fetch('https://example.com/api/gc', {
				method: 'POST',
				headers: AUTH,
			});
			expect(res.status).toBe(200);
			const data = await res.json<{ ok: boolean; removed: number }>();
			expect(data.ok).toBe(true);
			expect(typeof data.removed).toBe('number');
		});
	});

	describe('CORS', () => {
		it('handles preflight OPTIONS', async () => {
			const res = await SELF.fetch('https://example.com/api/clip', {
				method: 'OPTIONS',
			});
			expect(res.status).toBe(200);
			expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});
	});
});
