<script lang="ts">
	import { SITE } from '$lib/constants';

	let { status }: { status: number } = $props();

	const headline = $derived(status === 404 ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{status} - {SITE.title}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="padding-standard min-h-screen-safe flex flex-col justify-center">
	<p class="font-mono text-muted">Status {status}</p>
	<h1 class="mt-4">{headline}</h1>
	<a href="/" class="mt-8 underline">Return home</a>
</main>
