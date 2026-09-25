import type { ImageMetadata } from 'astro';
import numbers from '../assets/cards/numbers_1a.webp';
import transect from '../assets/cards/transect_b2.webp';
import trap from '../assets/cards/trap_a1.webp';
import argument from '../assets/cards/argument_a1.webp';
import outernet from '../assets/cards/outernet_a1.webp';
import reciprocal from '../assets/cards/reciprocal_1a.webp';
import infrastructure from '../assets/cards/infrastructure_1a.webp';
import battersea from '../assets/cards/battersea_c1.webp';
import lotus from '../assets/cards/lotus_a1.webp';
import permit from '../assets/cards/permit_a1.webp';
import patterns from '../assets/cards/patterns_e1.webp';
import orphaned from '../assets/cards/orphaned_a1.webp';

export type SocialCard = { image: ImageMetadata; alt: string };

const cards: Record<string, SocialCard> = {
	'numbers_1a.webp': { image: numbers, alt: 'Three blurred birds in flight against a cloudy sky.' },
	'transect_b2.webp': { image: transect, alt: 'Delicate seed heads on thin stems against a pale background.' },
	'trap_a1.webp': { image: trap, alt: 'A dark rocky slope picked out by a narrow wash of light.' },
	'argument_a1.webp': { image: argument, alt: 'Soft pale reflections emerging from a dark background.' },
	'outernet_a1.webp': { image: outernet, alt: 'A cloud of particles above a rippling surface in the Porsche anniversary visual.' },
	'reciprocal_1a.webp': { image: reciprocal, alt: 'Broken curved walls with jagged edges in a pale landscape.' },
	'infrastructure_1a.webp': { image: infrastructure, alt: 'A pale leaf suspended against a light background.' },
	'battersea_c1.webp': { image: battersea, alt: 'A monochrome visualization of Battersea Power Station and its chimneys.' },
	'lotus_a1.webp': { image: lotus, alt: 'A Lotus sports car in profile at night.' },
	'permit_a1.webp': { image: permit, alt: 'A blurred open book with a bright band of light across its pages.' },
	'patterns_e1.webp': { image: patterns, alt: 'Groups of luminous dice faces on a black field.' },
	'orphaned_a1.webp': { image: orphaned, alt: 'A beam of light cutting through a cloud of smoke.' },
};

export const getSocialCard = (source: string | undefined): SocialCard | undefined => {
	if (!source) return undefined;
	const card = cards[source];
	if (!card) throw new Error(`Missing local social card: ${source}`);
	return card;
};
