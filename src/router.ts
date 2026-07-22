type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

interface Route {
	method: string;
	pattern: RegExp;
	paramNames: string[];
	staticSegmentCount: number;
	handler: Handler;
}

export class Router {
	private routes: Route[] = [];

	private add(method: string, path: string, handler: Handler) {
		const paramNames: string[] = [];
		const pattern = path.replace(/:([^/]+)/g, (_, name) => {
			paramNames.push(name);
			return '([^/]+)';
		});
		this.routes.push({
			method,
			pattern: new RegExp(`^${pattern}$`),
			paramNames,
			staticSegmentCount: path.split('/').filter((segment) => segment && !segment.startsWith(':')).length,
			handler,
		});
	}

	get(path: string, handler: Handler) {
		this.add('GET', path, handler);
	}
	post(path: string, handler: Handler) {
		this.add('POST', path, handler);
	}
	delete(path: string, handler: Handler) {
		this.add('DELETE', path, handler);
	}

	match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
		let bestMatch: { route: Route; match: RegExpMatchArray } | null = null;

		for (const route of this.routes) {
			if (route.method !== method) continue;
			const m = pathname.match(route.pattern);
			if (!m) continue;

			if (!bestMatch || route.staticSegmentCount > bestMatch.route.staticSegmentCount) {
				bestMatch = { route, match: m };
			}
		}

		if (!bestMatch) return null;

		const params: Record<string, string> = {};
		bestMatch.route.paramNames.forEach((name, i) => {
			params[name] = bestMatch.match[i + 1];
		});
		return { handler: bestMatch.route.handler, params };
	}
}
