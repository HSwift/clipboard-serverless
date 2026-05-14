export interface ClipMeta {
	id: string;
	device: string;
	type: string;
	size: number;
	filename: string | null;
	createdAt: number;
}

export interface ShareEntry {
	clipId: string;
	expiresAt: number;
}

export interface ClipIndex {
	clips: ClipMeta[];
}

export interface AppEnv extends Env {
	AUTH_TOKEN: string;
}
