<script lang="ts">
	type SeoMeta = {
		browserTitle: string;
		description: string;
		canonical: string;
		openGraph: {
			type: "website" | "article";
			url: string;
			title: string;
			description: string;
			siteName: string;
			image: {
				url: string;
				width: number;
				height: number;
				alt: string;
			};
		};
		twitter: {
			card: "summary_large_image";
			title: string;
			description: string;
			image: {
				url: string;
				alt: string;
			};
		};
	};

	let { seo }: { seo: SeoMeta } = $props();
</script>

<svelte:head>
	<title>{seo.browserTitle}</title>
	<meta name="description" content={seo.description} />
	<link rel="canonical" href={seo.canonical} />

	<meta property="og:type" content={seo.openGraph.type} />
	<meta property="og:url" content={seo.openGraph.url} />
	<meta property="og:title" content={seo.openGraph.title} />
	<meta property="og:description" content={seo.openGraph.description} />
	<meta property="og:site_name" content={seo.openGraph.siteName} />
	<meta property="og:image" content={seo.openGraph.image.url} />
	<meta
		property="og:image:width"
		content={seo.openGraph.image.width.toString()}
	/>
	<meta
		property="og:image:height"
		content={seo.openGraph.image.height.toString()}
	/>
	<meta property="og:image:alt" content={seo.openGraph.image.alt} />

	<meta name="twitter:card" content={seo.twitter.card} />
	<meta name="twitter:title" content={seo.twitter.title} />
	<meta name="twitter:description" content={seo.twitter.description} />
	<meta name="twitter:image" content={seo.twitter.image.url} />
	<meta name="twitter:image:alt" content={seo.twitter.image.alt} />
</svelte:head>
