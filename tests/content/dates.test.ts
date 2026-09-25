import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getModifiedDate, latestModifiedDate } from '../../src/lib/seo';

test('an older article edit advances the aggregate date without changing publication order', () => {
	const newer = { date: new Date('2026-04-13T00:00:00Z') };
	const older = { date: new Date('2022-10-01T00:00:00Z'), updatedAt: new Date('2026-09-25T00:00:00Z') };
	const fallback = new Date('2026-07-04T00:00:00Z');
	assert.equal(latestModifiedDate([newer, older], fallback).toISOString(), '2026-09-25T00:00:00.000Z');
	assert.equal(older.date.toISOString(), '2022-10-01T00:00:00.000Z');
});

test('unmodified articles retain their publication date', () => {
	const entry = { date: new Date('2026-03-02T00:00:00Z') };
	assert.equal(getModifiedDate(entry).toISOString(), '2026-03-02T00:00:00.000Z');
});

test('site changes advance aggregate surfaces even with no newer article changes', () => {
	const fallback = new Date('2026-09-25T00:00:00Z');
	assert.equal(latestModifiedDate([], fallback).toISOString(), fallback.toISOString());
	assert.equal(latestModifiedDate([{ date: new Date('2026-03-02T00:00:00Z') }], fallback).toISOString(), fallback.toISOString());
});
