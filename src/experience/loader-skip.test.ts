// A skip made before the loader's script has arrived (round 3, piece 3). On
// slow 4G the unlit C stands a second before the loader is live, and a tap or
// a key in that second did nothing: the loader played through. The markup's
// script writes the presses down (loader-markup.test.ts); this is the rule
// they are judged by, which is the rule a key is judged by while the loader
// plays (loader/skip.ts: one rule).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anySkip, isSkip } from './loader/skip.ts';

test('a pointer going down is a skip; so is any key that says something', () => {
	assert.equal(isSkip(null), true);
	for (const key of ['a', ' ', 'Enter', 'Escape', 'ArrowDown', 'F5', '1', 'é']) {
		assert.equal(isSkip(key), true, key);
	}
});

test('moving focus and a modifier pressed alone are not a skip', () => {
	for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock']) {
		assert.equal(isSkip(key), false, key);
	}
	for (const key of ['NumLock', 'ScrollLock', 'Fn', 'Dead', 'Unidentified']) {
		assert.equal(isSkip(key), false, key);
	}
});

test('the presses made before the script arrived: nothing pressed, nothing done', () => {
	assert.equal(anySkip([]), false);
});

test('the presses made before the script arrived: the same keys that are not a skip now were not one then', () => {
	assert.equal(anySkip(['Tab']), false);
	assert.equal(anySkip(['Tab', 'Shift', 'Tab', 'Control', 'Meta']), false);
	// Shift held, then a letter: the letter is the wish.
	assert.equal(anySkip(['Shift', 'A']), true);
	assert.equal(anySkip(['Tab', null]), true);
	assert.equal(anySkip([null]), true);
	assert.equal(anySkip(['Enter']), true);
});
