// The inline script in the loader's markup (components/scenes/Loader.astro),
// run here as it is written there, against a stand-in page. It is the only
// part of the loader that is on the page before the page's script: what it
// does in that second or two on a slow line is what round 3, piece 3 was
// about. (An inline script cannot import anything, so it is read out of the
// component's source; if the component's markup changes shape this says so.)
//
// What must hold:
//   - the unlit C is kept unseen until its file is whole and decoded, and the
//     frame it is first shown in is noted for the loader's clock;
//   - the other three pictures are asked for when the unlit C is in, not before;
//   - a tap or a key made before the loader is live is written down, handed
//     over once, and the listening stops; nothing is kept where the page's
//     script never arrives, nothing is listened for where no loader plays.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { anySkip, type Early } from './loader/skip.ts';

const source = readFileSync(new URL('../components/scenes/Loader.astro', import.meta.url), 'utf8');
const found = /<script is:inline>([\s\S]*?)<\/script>/.exec(source);
if (!found) throw new Error('Loader.astro has no inline script');
const INLINE = found[1];

type Listener = (event: { type: string; key?: string }) => void;

interface Options {
	scene?: string;
	/** sessionStorage says the loader has been seen this session. */
	returning?: boolean;
	/** sessionStorage throws. */
	blocked?: boolean;
	/** The picture is in before the script runs (from the cache). */
	cached?: boolean;
	/** The picture cannot be decoded. */
	undecodable?: boolean;
}

/** A page with the loader's markup in it, and the inline script run once. */
function page(opts: Options = {}) {
	const classes = new Set<string>();
	const heard = new Map<string, Set<Listener>>();
	const frames: ((now: number) => void)[] = [];
	const links: { rel?: string; as?: string; href?: string; fetchPriority?: string }[] = [];
	const onImage = new Map<string, () => void>();
	const img = {
		complete: opts.cached === true,
		naturalWidth: opts.cached === true ? 1400 : 0,
		addEventListener: (type: string, fn: () => void) => onImage.set(type, fn),
		decode: () => (opts.undecodable ? Promise.reject(new Error('no')) : Promise.resolve()),
	};
	const loader = {
		classList: { add: (name: string) => classes.add(name) },
		dataset: { pictures: '/c-lit.webp /wordmark.webp /wordmark-matte.webp' },
		matches: (selector: string) =>
			selector.split(',').some((one) => classes.has(one.trim().replace(/^\./, ''))),
		querySelector: () => img,
	};
	const document = {
		getElementById: (id: string) => (id === 'loader' ? loader : null),
		documentElement: { dataset: { scene: opts.scene ?? 'loading' } },
		createElement: () => ({}),
		head: { append: (link: object) => links.push(link) },
	};
	const window: { __loaderEarly?: Early } = {};
	const sessionStorage = {
		getItem: () => {
			if (opts.blocked) throw new Error('blocked');
			return opts.returning ? '1' : null;
		},
	};
	const addEventListener = (type: string, fn: Listener) => {
		if (!heard.has(type)) heard.set(type, new Set());
		heard.get(type)?.add(fn);
	};
	const removeEventListener = (type: string, fn: Listener) => heard.get(type)?.delete(fn);
	new Function(
		'window',
		'document',
		'sessionStorage',
		'requestAnimationFrame',
		'addEventListener',
		'removeEventListener',
		INLINE,
	)(
		window,
		document,
		sessionStorage,
		(fn: (now: number) => void) => frames.push(fn),
		addEventListener,
		removeEventListener,
	);
	return {
		classes,
		links,
		early: () => window.__loaderEarly,
		listening: (type: string) => heard.get(type)?.size ?? 0,
		fire(type: string, key?: string) {
			for (const fn of [...(heard.get(type) ?? [])]) fn({ type, key });
		},
		/** The picture's last byte arrives. */
		arrive() {
			img.complete = true;
			img.naturalWidth = 1400;
			onImage.get('load')?.();
		},
		/** The browser draws a frame. */
		frame(now: number) {
			for (const fn of frames.splice(0)) fn(now);
		},
	};
}
/** Let the promises settle. */
const settle = () => new Promise<void>((done) => setImmediate(done));

test('the unlit C is unseen until its file is whole, then shown, and the frame is noted', async () => {
	const p = page();
	await settle();
	p.frame(800);
	assert.equal(p.classes.has('has-poster'), false, 'shown before its file had arrived');
	assert.equal(p.early()?.seenAt, null);
	p.arrive();
	await settle();
	assert.equal(p.classes.has('has-poster'), true);
	assert.equal(p.early()?.seenAt, null, 'not seen until a frame has drawn it');
	p.frame(1234.5);
	assert.equal(p.early()?.seenAt, 1234.5);
});

test('the other three pictures are asked for when the unlit C is in, not before, and in their order', async () => {
	const p = page();
	await settle();
	assert.equal(p.links.length, 0, 'asked for while the unlit C was still on the line');
	p.arrive();
	assert.deepEqual(
		p.links.map((l) => [l.rel, l.as, l.href]),
		[
			['preload', 'image', '/c-lit.webp'],
			['preload', 'image', '/wordmark.webp'],
			['preload', 'image', '/wordmark-matte.webp'],
		],
	);
});

test('a picture that is already in (the cache) is shown and followed at once', async () => {
	const p = page({ cached: true });
	assert.equal(p.links.length, 3);
	await settle();
	assert.equal(p.classes.has('has-poster'), true);
});

test('a picture that will not decode is not waited for', async () => {
	const p = page({ undecodable: true });
	p.arrive();
	await settle();
	assert.equal(p.classes.has('has-poster'), true);
});

test('a return visit: the picture is taken away, never shown, and no frame is noted', async () => {
	const p = page({ returning: true, cached: true });
	assert.equal(p.classes.has('is-return'), true);
	await settle();
	p.frame(50);
	assert.equal(p.classes.has('has-poster'), false);
	assert.equal(p.early()?.seenAt, null);
	// The pictures are still asked for: the short version draws with them.
	assert.equal(p.links.length, 3);
});

test('the canvas drew first: the picture is not shown after it', async () => {
	const p = page();
	p.arrive();
	p.classes.add('is-drawn');
	await settle();
	p.frame(90);
	assert.equal(p.classes.has('has-poster'), false);
	assert.equal(p.early()?.seenAt, null);
});

test('a tap and a key made before the loader is live are written down, in order, and handed over once', () => {
	const p = page();
	assert.equal(p.listening('pointerdown'), 1);
	assert.equal(p.listening('keydown'), 1);
	p.fire('keydown', 'Tab');
	p.fire('pointerdown');
	p.fire('keydown', 'a');
	const taken = p.early()?.take() ?? [];
	assert.deepEqual(taken, ['Tab', null, 'a']);
	assert.equal(anySkip(taken), true);
	// The listening has stopped, and there is nothing to take twice.
	assert.equal(p.listening('pointerdown'), 0);
	assert.equal(p.listening('keydown'), 0);
	assert.deepEqual(p.early()?.take(), []);
});

test('Tab and a modifier before the loader is live are written down and are not a skip', () => {
	const p = page();
	p.fire('keydown', 'Tab');
	p.fire('keydown', 'Shift');
	const taken = p.early()?.take() ?? [];
	assert.deepEqual(taken, ['Tab', 'Shift']);
	assert.equal(anySkip(taken), false);
});

test('nothing pressed: nothing handed over', () => {
	const p = page();
	assert.deepEqual(p.early()?.take(), []);
});

test("the page's script never arrives: at DOMContentLoaded the listening stops and what was pressed is forgotten", () => {
	const p = page();
	p.fire('pointerdown');
	p.fire('DOMContentLoaded');
	assert.equal(p.listening('pointerdown'), 0);
	assert.equal(p.listening('keydown'), 0);
	assert.deepEqual(p.early()?.take(), []);
});

test('where no loader plays (reduced motion, the debug hooks) nothing is listened for, kept or asked for', async () => {
	for (const scene of ['sky', 'roots']) {
		const p = page({ scene, cached: true });
		await settle();
		assert.equal(p.early(), undefined);
		assert.equal(p.listening('pointerdown'), 0);
		assert.equal(p.listening('keydown'), 0);
		assert.equal(p.listening('DOMContentLoaded'), 0);
		assert.equal(p.links.length, 0);
		assert.equal(p.classes.has('has-poster'), false);
	}
});

test('storage that throws is a first visit', () => {
	const p = page({ blocked: true });
	assert.equal(p.classes.has('is-return'), false);
	assert.equal(p.listening('keydown'), 1);
});
