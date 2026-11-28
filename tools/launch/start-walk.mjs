// Walks the live /start page as far as it goes without a real client link:
// no code, then a made-up TEST code. Creates nothing. Run: node tools/launch/start-walk.mjs
import { launch } from '../roots/lib.mjs';
const b = await launch();
for (const [label, url] of [
	['no code', 'https://cellestialstudio.com/start/'],
	['TEST code', 'https://cellestialstudio.com/start/#TEST-not-a-real-link-0000000000'],
]) {
	const p = await b.newPage({ viewport: { width: 390, height: 844 } });
	const errors = [];
	const api = [];
	p.on('pageerror', (e) => errors.push(String(e)));
	p.on('response', (r) => r.url().includes('/api/') && api.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`));
	await p.goto(url, { waitUntil: 'load' });
	await p.waitForTimeout(4000);
	const text = (await p.textContent('[data-flow]')).replace(/\s+/g, ' ').trim();
	await p.screenshot({ path: `refs/verification/launch-start-${label.replace(' ', '-')}.png` });
	console.log(`${label}: "${text.slice(0, 200)}" | api: ${api.join(', ') || 'none'} | errors: ${errors.length ? errors : 'none'}`);
	await p.close();
}
await b.close();
