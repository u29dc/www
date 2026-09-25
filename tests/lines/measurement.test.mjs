import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { measureLineReveal } from '../../src/app/ui/measure.ts';

const originals = new Map();
const replace = (name, value) => {
	if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
};
const rect = (top, width = 300) => ({ top, bottom: top + 20, left: 0, right: width, width, height: 20 });
let reads;
let id = 0;
class ElementDouble {
	dataset = {};
	childNodes = [];
	style = { position: '' };
	clientLeft = 0;
	clientTop = 0;
	scrollLeft = 0;
	scrollTop = 0;
	getBoundingClientRect() {
		return { ...rect(0), bottom: 40, height: 40 };
	}
	querySelectorAll() {
		return [];
	}
	matches() {
		return false;
	}
}
const targetWith = (text) => {
	const target = new ElementDouble();
	target.dataset = { lineReveal: 'body', lineRevealKey: `test-${++id}` };
	target.parentElement = new ElementDouble();
	target.textContent = text;
	target.childNodes = [{ nodeType: 3, data: text, length: text.length }];
	return target;
};
const options = {
	profile: 'full',
	durationMs: 500,
	staggerMs: 20,
	maxTotalMs: 1000,
	handoffMs: 50,
	completionBufferMs: 0,
	maxTokens: 200,
	maxLinesPerTarget: 20,
	measureBudgetMs: 100,
};

beforeEach(() => {
	reads = 0;
	replace('HTMLElement', ElementDouble);
	replace('Node', { TEXT_NODE: 3 });
	replace('window', { location: { pathname: '/test' }, devicePixelRatio: 1 });
	replace('document', {
		documentElement: { dataset: {} },
		fonts: { status: 'loaded' },
		createRange() {
			return {
				setStart() {},
				setEnd() {},
				getClientRects() {
					reads++;
					return [rect(0), rect(20)];
				},
			};
		},
	});
	replace('getComputedStyle', () => ({ position: 'static', font: '16px serif', lineHeight: '20px' }));
});

after(() => {
	for (const [name, descriptor] of originals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete globalThis[name];
	}
});

test('reads browser line fragments once per text node rather than once per word', () => {
	const measured = measureLineReveal(targetWith(Array(100).fill('word').join(' ')), options);
	assert.equal(measured.lineCount, 2);
	assert.equal(reads, 1);
	assert.deepEqual(
		measured.lines.map((line) => line.rect.top),
		[0, 20],
	);
});

test('rejects excessive content before any range geometry reads', () => {
	assert.throws(() => measureLineReveal(targetWith(Array(201).fill('word').join(' ')), options), /token-budget/);
	assert.equal(reads, 0);
});

test('a geometry cache hit does not repeat range reads', () => {
	const target = targetWith('a paragraph');
	measureLineReveal(target, options);
	measureLineReveal(target, options);
	assert.equal(reads, 1);
});

test('rejects an exhausted time budget before range reads', () => {
	assert.throws(() => measureLineReveal(targetWith('a paragraph'), { ...options, measureBudgetMs: -1 }), /measure-budget/);
	assert.equal(reads, 0);
});
