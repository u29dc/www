import { SITE } from '$lib/constants';
import { getHomeOgSource, renderOgCard } from '$lib/server/og';

export const prerender = true;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
};

export async function GET() {
	const png = await renderOgCard({
		id: 'home',
		title: SITE.title,
		source: getHomeOgSource(),
		textTone: 'auto',
	});

	return new Response(toArrayBuffer(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
		},
	});
}
