type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

interface Route {
	method: string;
	pattern: RegExp;
	paramNames: string[];
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
		for (const route of this.routes) {
			if (route.method !== method) continue;
			const m = pathname.match(route.pattern);
			if (!m) continue;
			const params: Record<string, string> = {};
			route.paramNames.forEach((name, i) => {
				params[name] = m[i + 1];
			});
			return { handler: route.handler, params };
		}
		return null;
	}
}
