<script lang="ts">
	import { page } from "$app/state";
	import MdxMedia from "$lib/components/mdx/MdxMedia.svelte";
	import MdxMediaEnhancer from "$lib/components/mdx/MdxMediaEnhancer.svelte";
	import Threshold from "$lib/components/sections/Threshold.svelte";
	import { SITE } from "$lib/constants";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const formatDate = (date: string): string =>
		new Intl.DateTimeFormat("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(new Date(date));

	const pageUrl = $derived(new URL(page.url.pathname, SITE.url).toString());
	const markdownPageUrl = $derived.by(() => {
		const markdownUrl = new URL(page.url.pathname, SITE.url);
		const normalizedPathname = markdownUrl.pathname.replace(/\/+$/, "");
		markdownUrl.pathname = normalizedPathname.endsWith(".md")
			? normalizedPathname
			: `${normalizedPathname}.md`;
		return markdownUrl.toString();
	});
	const markdownRelativePath = $derived.by(() => {
		const normalizedPathname = page.url.pathname.replace(/\/+$/, "");
		return normalizedPathname.endsWith(".md")
			? normalizedPathname
			: `${normalizedPathname}.md`;
	});
	const typeLabel = $derived(
		(
			{
				study: "study",
				fragment: "fragment",
				signal: "signal",
				meta: "meta",
			} as const
		)[data.frontmatter.type] ?? "artifact",
	);
	const llmPrompt = $derived(
		`This is "${data.frontmatter.title}" -- a ${typeLabel} from ${SITE.name},` +
			` a narrative architecture practice building decision-grade narratives for complex technology companies.` +
			`\n\nStudio context: ${SITE.url}/llms.md` +
			`\nArticle: ${markdownPageUrl}` +
			`\n\n1. Read the studio context first for positioning` +
			`\n2. Read the article` +
			`\n3. One tight paragraph summary + bulleted key arguments` +
			`\n4. Frame all claims within the practice's broader positioning -- assume zero prior context` +
			`\n5. Offer to go deeper on any thread` +
			`\n6. For related topics, search other artifacts: ${SITE.url}/sitemap.xml`,
	);
	const claudeUrl = $derived(
		`https://claude.ai/new?${new URLSearchParams({ q: llmPrompt }).toString()}`,
	);
	const chatGptUrl = $derived(
		`https://chatgpt.com/?${new URLSearchParams({ q: llmPrompt }).toString()}`,
	);

	const stripFrontmatter = (md: string): string =>
		md.replace(/^---\n[\s\S]*?\n---\n+/, "");

	const stripMediaLinks = (md: string): string =>
		md.replace(/^\[.*?\]\(https:\/\/storage\.u29dc\.com\/.*?\)\s*$/gm, "");

	const stripFooter = (md: string): string =>
		md.replace(/\n---\n\nFull sitemap:.*$/s, "");

	const cleanMarkdown = (md: string): string =>
		stripFooter(stripMediaLinks(stripFrontmatter(md)))
			.replace(/\n{3,}/g, "\n\n")
			.trim();

	const copyWithFallback = (value: string): void => {
		if (typeof document === "undefined") return;
		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "true");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.append(textarea);
		textarea.select();
		document.execCommand("copy");
		textarea.remove();
	};

	const writeToClipboard = async (value: string): Promise<void> => {
		if (
			typeof navigator !== "undefined" &&
			navigator.clipboard?.writeText
		) {
			try {
				await navigator.clipboard.writeText(value);
				return;
			} catch {
				// fall through to legacy copy path
			}
		}
		copyWithFallback(value);
	};

	const copyContent = async (): Promise<void> => {
		const response = await fetch(markdownRelativePath);
		if (!response.ok) return;
		const md = await response.text();
		const body = cleanMarkdown(md);
		const blocks = [
			data.frontmatter.title,
			data.frontmatter.description,
			formatDate(data.frontmatter.date),
			body,
			pageUrl,
			markdownPageUrl,
		].filter((v) => v.trim().length > 0);
		await writeToClipboard(blocks.join("\n\n"));
	};

	const copyLink = async (): Promise<void> => {
		await writeToClipboard(pageUrl);
	};
</script>

<svelte:head>
	<title>{SITE.name} | {data.frontmatter.title}</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<article class="grid-section-full pb-32 pt-52 md:pt-44">
	<header data-slug-hero class="col-content-wide mb-14 text-center">
		<h1 class="mx-auto font-serif font-bold text-balance">
			{data.frontmatter.title}
		</h1>
		{#if data.frontmatter.description}
			<p class="mx-auto mt-4 max-w-[56ch] text-muted">
				{data.frontmatter.description}
			</p>
		{/if}

		<div class="mt-8 flex flex-wrap justify-center gap-2">
				<a
					href={claudeUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex min-h-[30px] cursor-pointer select-none items-center justify-center rounded-md bg-black/5 px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
				>
					Read with Claude
				</a>
				<a
					href={chatGptUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex min-h-[30px] cursor-pointer select-none items-center justify-center rounded-md bg-black/5 px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
				>
					Read with ChatGPT
				</a>
				<button
					type="button"
					onclick={copyContent}
					class="inline-flex min-h-[30px] cursor-pointer select-none appearance-none items-center justify-center rounded-md border-0 bg-black/5 px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
				>
					Copy content
				</button>
				<button
					type="button"
					onclick={copyLink}
					class="inline-flex min-h-[30px] cursor-pointer select-none appearance-none items-center justify-center rounded-md border-0 bg-black/5 px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
				>
					Copy link
				</button>
		</div>
	</header>

	{#if data.firstMedia}
		<div class="col-content-wide mb-16">
			<MdxMedia src={data.firstMedia} />
		</div>
	{/if}

	<div class="col-content mb-10 text-left">
		<time
			class="block font-mono text-muted"
			datetime={data.frontmatter.date}
		>
			{formatDate(data.frontmatter.date)}
		</time>
	</div>

	<div
		class="article-flow col-full grid-section-full grid gap-y-12 [&>*:not(.mdx-quote)]:col-content [&_[data-footnotes]]:mt-[2.4rem] [&_[data-footnotes]]:border-t [&_[data-footnotes]]:border-black/10 [&_[data-footnotes]]:pt-[2rem] [&_[data-footnotes]_ol]:grid [&_[data-footnotes]_ol]:list-decimal [&_[data-footnotes]_ol]:gap-y-[1.2rem] [&_[data-footnotes]_ol]:ps-[2.2rem] [&_[data-footnotes]_li]:[font-family:var(--font-mono)] [&_[data-footnotes]_li]:text-[1.1rem] [&_[data-footnotes]_li]:font-normal [&_[data-footnotes]_li]:normal-case [&_[data-footnotes]_li]:leading-[1.5] [&_[data-footnotes]_li]:text-muted [&_[data-footnotes]_p]:inline [&_a[data-footnote-ref]]:font-mono [&_a[data-footnote-ref]]:text-[0.95rem] [&_a[data-footnote-ref]]:text-muted [&_a[data-footnote-ref]]:no-underline [&_a[data-footnote-backref]]:hidden"
	>
		{@html data.contentHtml}
	</div>

	<p class="col-content mt-16 font-handwritten text-muted">Han</p>

	<MdxMediaEnhancer />
</article>

<Threshold compact />
