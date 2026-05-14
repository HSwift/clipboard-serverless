import { generateClipId } from '../id';
import type { ClipMeta } from '../types';
import type { ClipStore } from '../store';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function clipHandlers(store: ClipStore) {
	async function push(req: Request): Promise<Response> {
		const device = req.headers.get('X-Device') || 'unknown';
		const rawContentType = req.headers.get('Content-Type') || 'application/octet-stream';
		const contentType =
			rawContentType.startsWith('text/') && !rawContentType.includes('charset')
				? rawContentType + '; charset=utf-8'
				: rawContentType;
		const filename = req.headers.get('X-Filename') || null;

		if (!req.body) {
			return json({ error: 'Empty body' }, 400);
		}

		const body = await req.arrayBuffer();
		if (body.byteLength === 0) {
			return json({ error: 'Empty body' }, 400);
		}

		const id = generateClipId(device);
		const meta: ClipMeta = {
			id,
			device,
			type: contentType,
			size: body.byteLength,
			filename,
			createdAt: Date.now(),
		};

		await store.addClip(meta, body);
		return json(meta, 201);
	}

	async function list(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
		const before = url.searchParams.get('before');

		let clips = await store.getIndex();

		if (before) {
			const idx = clips.findIndex((c) => c.id === before);
			if (idx !== -1) clips = clips.slice(idx + 1);
		}

		clips = clips.slice(0, limit);
		return json({ clips, count: clips.length });
	}

	async function latest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const metaOnly = url.searchParams.get('meta') === 'true';

		const clips = await store.getIndex();
		if (clips.length === 0) {
			return json({ error: 'No clips' }, 404);
		}

		const clip = clips[0];
		if (metaOnly) return json(clip);

		const obj = await store.getClipContent(clip.id);
		if (!obj) return json({ error: 'Content not found' }, 404);

		return new Response(obj.body, {
			headers: {
				'Content-Type': clip.type,
				'X-Clip-Id': clip.id,
				'X-Clip-Device': clip.device,
				...(clip.filename ? { 'Content-Disposition': `inline; filename="${clip.filename}"` } : {}),
			},
		});
	}

	async function getById(_req: Request, params: Record<string, string>): Promise<Response> {
		const meta = await store.getClipMeta(params.id);
		if (!meta) return json({ error: 'Not found' }, 404);
		return json(meta);
	}

	async function getRaw(_req: Request, params: Record<string, string>): Promise<Response> {
		const meta = await store.getClipMeta(params.id);
		if (!meta) return json({ error: 'Not found' }, 404);

		const obj = await store.getClipContent(params.id);
		if (!obj) return json({ error: 'Content not found' }, 404);

		return new Response(obj.body, {
			headers: {
				'Content-Type': meta.type,
				'X-Clip-Id': meta.id,
				'X-Clip-Device': meta.device,
				...(meta.filename ? { 'Content-Disposition': `inline; filename="${meta.filename}"` } : {}),
			},
		});
	}

	async function remove(_req: Request, params: Record<string, string>): Promise<Response> {
		const deleted = await store.deleteClip(params.id);
		if (!deleted) return json({ error: 'Not found' }, 404);
		return json({ ok: true });
	}

	return { push, list, latest, getById, getRaw, remove };
}
