export const json = (status: number, payload: unknown, cache = 'no-store') =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': cache },
	});

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		return typeof body === 'object' && body !== null && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export interface Ctx {
	waitUntil(p: Promise<unknown>): void;
}

export interface Limiter {
	limit(opts: { key: string }): Promise<{ success: boolean }>;
}
