import type { ClipStore } from '../store';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function gcHandlers(store: ClipStore, defaultTtlDays: number) {
	async function manualGc(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const days = parseInt(url.searchParams.get('days') || String(defaultTtlDays), 10);
		const result = await store.gc(days);
		return json({ ok: true, ...result });
	}

	async function scheduledGc(): Promise<void> {
		await store.gc(defaultTtlDays);
	}

	return { manualGc, scheduledGc };
}
