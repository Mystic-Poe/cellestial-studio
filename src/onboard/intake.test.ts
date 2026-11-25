import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	cleanIntake,
	editable,
	emptyIntake,
	type Intake,
	readyToSend,
	STAGE_TEXT,
	STAGES,
} from './intake.ts';

const ok = (raw: unknown): Intake => {
	const r = cleanIntake(raw);
	assert.ok(r.ok, JSON.stringify(r));
	return r.value;
};

test('nothing in gives an empty intake', () => {
	assert.deepEqual(ok({}), emptyIntake());
	assert.deepEqual(ok(null), emptyIntake());
});

test('text is trimmed and kept', () => {
	const i = ok({ about: '  We bake bread.  ', area: ' Springfield ', phone: '555 0100' });
	assert.equal(i.about, 'We bake bread.');
	assert.equal(i.area, 'Springfield');
	assert.equal(i.phone, '555 0100');
});

test('too long names its field', () => {
	const r = cleanIntake({ about: 'x'.repeat(1001) });
	assert.deepEqual(r.ok ? null : r.field, 'about');
	const r2 = cleanIntake({ hours: 'x'.repeat(121) });
	assert.deepEqual(r2.ok ? null : r2.field, 'hours');
});

test('non-text values are refused, not coerced', () => {
	const r = cleanIntake({ about: 42 });
	assert.equal(r.ok ? null : r.field, 'about');
});

test('pages keep only known ones, in the standard order, once each', () => {
	assert.deepEqual(ok({ pages: ['Gallery', 'Hack', 'Services', 'Gallery'] }).pages, [
		'Services',
		'Gallery',
	]);
	assert.equal(cleanIntake({ pages: 'Services' }).ok, false);
});

test('likes: up to 3 web addresses; bare domains get https', () => {
	assert.deepEqual(ok({ likes: ['example.com', ' https://a.example/x ', ''] }).likes, [
		'https://example.com',
		'https://a.example/x',
	]);
	const bad = cleanIntake({ likes: ['javascript:alert(1)'] });
	assert.equal(bad.ok ? null : bad.field, 'likes');
	const many = cleanIntake({ likes: ['a.com', 'b.com', 'c.com', 'd.com'] });
	assert.equal(many.ok ? null : many.field, 'likes');
});

test('domain only kept when they said they have one', () => {
	assert.equal(ok({ has_domain: 'no', domain: 'example.com' }).domain, '');
	assert.equal(ok({ has_domain: 'yes', domain: 'https://www.Example.com/' }).domain, 'example.com');
	assert.equal(ok({ has_domain: 'maybe' }).has_domain, '');
});

test('contact email, when given, must look like one', () => {
	assert.equal(ok({ contact_email: 'hi@example.com' }).contact_email, 'hi@example.com');
	const r = cleanIntake({ contact_email: 'nope' });
	assert.equal(r.ok ? null : r.field, 'contact_email');
});

test('ready to send needs a few words about the business', () => {
	assert.match(readyToSend(emptyIntake()) ?? '', /business/i);
	assert.equal(readyToSend({ ...emptyIntake(), about: 'Bakery' }), null);
});

test('stages, and when answers can still change', () => {
	assert.deepEqual([...STAGES], ['intake', 'design', 'building', 'review', 'live']);
	for (const s of STAGES) assert.ok(STAGE_TEXT[s].title && STAGE_TEXT[s].client);
	assert.deepEqual(
		STAGES.map((s) => editable(s)),
		[true, true, false, false, false],
	);
});
