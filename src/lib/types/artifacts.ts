export type HomeArtifactType = 'study' | 'fragment' | 'signal' | 'meta';

export type HomeArtifactMode = 'MAP' | 'LAB' | 'COM';

interface HomeArtifactBase {
	slug: string;
	title: string;
	description: string;
	date: string;
	isConfidential: boolean;
}

export interface HomeStudyArtifactRow extends HomeArtifactBase {
	type: 'study';
	client: string | undefined;
	mode: HomeArtifactMode | undefined;
	thumbnails: string[];
}

export interface HomeWritingArtifactRow extends HomeArtifactBase {
	type: 'fragment';
	excerpt: string | undefined;
}

export interface HomeOtherArtifactRow extends HomeArtifactBase {
	type: Exclude<HomeArtifactType, 'study' | 'fragment'>;
}

export interface HomeArtifactGroups {
	studies: HomeStudyArtifactRow[];
	fragments: HomeWritingArtifactRow[];
	other: HomeOtherArtifactRow[];
}
