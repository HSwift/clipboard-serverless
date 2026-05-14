export function verifyAuth(request: Request, authToken: string): boolean {
	const header = request.headers.get('Authorization');
	if (header) {
		const [scheme, token] = header.split(' ', 2);
		if (scheme === 'Bearer' && token === authToken) return true;
	}
	const url = new URL(request.url);
	const queryToken = url.searchParams.get('token');
	if (queryToken === authToken) return true;

	return false;
}

export function unauthorizedResponse(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' },
	});
}
