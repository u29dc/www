import { type CollectionEntry, getCollection } from 'astro:content';

export type ArtifactEntry = CollectionEntry<'artifacts'>;
export type StudyArtifact = ArtifactEntry & { data: ArtifactEntry['data'] & { type: 'study' } };
export type FragmentArtifact = ArtifactEntry & {
	data: ArtifactEntry['data'] & { type: 'fragment' };
};

const sortByDate = (a: ArtifactEntry, b: ArtifactEntry) => b.data.date.getTime() - a.data.date.getTime();

export async function getArtifacts(): Promise<ArtifactEntry[]> {
	return (await getCollection('artifacts')).toSorted(sortByDate);
}

export function isStudyArtifact(entry: ArtifactEntry): entry is StudyArtifact {
	return entry.data.type === 'study';
}

export function isFragmentArtifact(entry: ArtifactEntry): entry is FragmentArtifact {
	return entry.data.type === 'fragment';
}

export async function getStudies(): Promise<StudyArtifact[]> {
	return (await getArtifacts()).filter(isStudyArtifact);
}

export async function getFragments(): Promise<FragmentArtifact[]> {
	return (await getArtifacts()).filter(isFragmentArtifact);
}

export async function getArtifactBySlug(slug: string | undefined): Promise<ArtifactEntry> {
	const entry = (await getArtifacts()).find((item) => item.data.slug === slug);
	if (!entry) {
		throw new Error(`Unknown artifact slug: ${slug ?? 'missing'}`);
	}
	return entry;
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(date);
}
