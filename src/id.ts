function fnv1a16(str: string): number {
	let hash = 0x811c;
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = (hash * 0x0101) & 0xffff;
	}
	return hash;
}

let lastTimestamp = 0;
let sequence = 0;

export function generateClipId(device: string): string {
	const now = Date.now();
	if (now === lastTimestamp) {
		sequence = (sequence + 1) & 0xff;
	} else {
		lastTimestamp = now;
		sequence = 0;
	}

	const ts = now.toString(16).padStart(12, '0');
	const dev = fnv1a16(device).toString(16).padStart(4, '0');
	const seq = sequence.toString(16).padStart(2, '0');

	return `${ts}_${dev}_${seq}`;
}

export function extractTimestamp(id: string): number {
	const hex = id.split('_')[0];
	return parseInt(hex, 16);
}
