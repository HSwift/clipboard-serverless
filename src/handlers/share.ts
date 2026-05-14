import type { ClipStore } from '../store';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function generateShareId(): string {
	const bytes = new Uint8Array(9);
	crypto.getRandomValues(bytes);
	let result = '';
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (const b of bytes) {
		result += chars[b % chars.length];
	}
	return result;
}

const MAX_TTL = 7 * 86400;
const DEFAULT_TTL = 86400;

export function shareHandlers(store: ClipStore, baseUrl: string) {
	async function createLatestShare(req: Request): Promise<Response> {
		const clips = await store.getIndex();
		if (clips.length === 0) {
			return json({ error: 'No clips' }, 404);
		}

		const clip = clips[0];
		const clipId = clip.id;

		let ttl = DEFAULT_TTL;

		const shareId = generateShareId();
		const entry = await store.createShare(shareId, clipId, ttl);

		return json(
			{
				shareId,
				url: `${baseUrl}/s/${shareId}`,
				expiresAt: entry.expiresAt,
			},
			201,
		);
	}

	async function createShare(req: Request, params: Record<string, string>): Promise<Response> {
		const clipId = params.id;
		const meta = await store.getClipMeta(clipId);
		if (!meta) return json({ error: 'Clip not found' }, 404);

		let ttl = DEFAULT_TTL;
		const ct = req.headers.get('Content-Type') || '';
		if (ct.includes('application/json')) {
			try {
				const body = await req.json<{ ttl?: number }>();
				if (body.ttl && body.ttl > 0) {
					ttl = Math.min(body.ttl, MAX_TTL);
				}
			} catch {
				// use default ttl
			}
		}

		const shareId = generateShareId();
		const entry = await store.createShare(shareId, clipId, ttl);

		return json(
			{
				shareId,
				url: `${baseUrl}/s/${shareId}`,
				expiresAt: entry.expiresAt,
			},
			201,
		);
	}

	async function getShared(_req: Request, params: Record<string, string>): Promise<Response> {
		const entry = await store.getShare(params.shareId);
		if (!entry) {
			return json({ error: 'Share link not found or expired' }, 404);
		}

		if (entry.expiresAt < Math.floor(Date.now() / 1000)) {
			return json({ error: 'Share link expired' }, 410);
		}

		const meta = await store.getClipMeta(entry.clipId);
		if (!meta) return json({ error: 'Clip no longer exists' }, 404);

		const obj = await store.getClipContent(entry.clipId);
		if (!obj) return json({ error: 'Content not found' }, 404);

		const contentType = meta.type.startsWith('text/') && !meta.type.includes('charset')
		? `${meta.type}; charset=utf-8`
		: meta.type;

		return new Response(obj.body, {
			headers: {
				'Content-Type': contentType,
				...(meta.filename ? { 'Content-Disposition': `inline; filename="${meta.filename}"` } : {}),
			},
		});
	}

	return { createLatestShare, createShare, getShared };
}
