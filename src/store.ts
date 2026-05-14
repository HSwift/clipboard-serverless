import type { ClipMeta, ClipIndex, ShareEntry, AppEnv } from './types';

const INDEX_KEY = 'index';
const SHARE_PREFIX = 'share:';

export class ClipStore {
	constructor(
		private kv: KVNamespace,
		private r2: R2Bucket,
		private maxClips: number,
	) {}

	async getIndex(): Promise<ClipMeta[]> {
		const data = await this.kv.get<ClipIndex>(INDEX_KEY, 'json');
		return data?.clips ?? [];
	}

	private async saveIndex(clips: ClipMeta[]): Promise<void> {
		const index: ClipIndex = { clips };
		await this.kv.put(INDEX_KEY, JSON.stringify(index));
	}

	async addClip(meta: ClipMeta, content: ReadableStream | ArrayBuffer | string): Promise<void> {
		await this.r2.put(meta.id, content, {
			httpMetadata: { contentType: meta.type },
			customMetadata: {
				device: meta.device,
				filename: meta.filename ?? '',
			},
		});

		const clips = await this.getIndex();
		clips.unshift(meta);
		if (clips.length > this.maxClips) {
			const removed = clips.splice(this.maxClips);
			await Promise.all(removed.map((c) => this.r2.delete(c.id)));
		}
		await this.saveIndex(clips);
	}

	async getClipMeta(id: string): Promise<ClipMeta | null> {
		const clips = await this.getIndex();
		return clips.find((c) => c.id === id) ?? null;
	}

	async getClipContent(id: string): Promise<R2ObjectBody | null> {
		return await this.r2.get(id);
	}

	async deleteClip(id: string): Promise<boolean> {
		const clips = await this.getIndex();
		const idx = clips.findIndex((c) => c.id === id);
		if (idx === -1) return false;
		clips.splice(idx, 1);
		await Promise.all([this.saveIndex(clips), this.r2.delete(id)]);
		return true;
	}

	async createShare(shareId: string, clipId: string, ttlSeconds: number): Promise<ShareEntry> {
		const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
		const entry: ShareEntry = { clipId, expiresAt };
		await this.kv.put(`${SHARE_PREFIX}${shareId}`, JSON.stringify(entry), {
			expiration: expiresAt,
		});
		return entry;
	}

	async getShare(shareId: string): Promise<ShareEntry | null> {
		return await this.kv.get<ShareEntry>(`${SHARE_PREFIX}${shareId}`, 'json');
	}

	async gc(maxAgeDays: number): Promise<{ removed: number }> {
		const cutoff = Date.now() - maxAgeDays * 86400_000;
		const clips = await this.getIndex();
		const keep: ClipMeta[] = [];
		const toDelete: string[] = [];

		for (const clip of clips) {
			if (clip.createdAt < cutoff) {
				toDelete.push(clip.id);
			} else {
				keep.push(clip);
			}
		}

		if (toDelete.length > 0) {
			await Promise.all([this.saveIndex(keep), ...toDelete.map((id) => this.r2.delete(id))]);
		}

		return { removed: toDelete.length };
	}
}

export function createStore(env: AppEnv): ClipStore {
	const maxClips = parseInt(env.MAX_CLIPS, 10) || 500;
	return new ClipStore(env.CLIPBOARD, env.CLIPBOARD_BUCKET, maxClips);
}
