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
	const aiPrompt = $derived(`Read this and summarize: ${markdownPageUrl}`);
	const claudeUrl = $derived(
		`https://claude.ai/new?${new URLSearchParams({ q: aiPrompt }).toString()}`,
	);
	const chatGptUrl = $derived(
		`https://chatgpt.com/?${new URLSearchParams({ q: aiPrompt }).toString()}`,
	);

	const collapseWhitespace = (value: string): string =>
		value
			.replace(/\r/g, "")
			.replace(/[ \t]+\n/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim();

	const extractPlainTextFromHtml = (html: string): string => {
		if (typeof document === "undefined") return "";
		const wrapper = document.createElement("div");
		wrapper.innerHTML = html;

		for (const ref of wrapper.querySelectorAll<HTMLAnchorElement>(
			"a[data-footnote-ref]",
		)) {
			const marker = ref.textContent?.trim() ?? "";
			ref.textContent = marker.length > 0 ? `[${marker}]` : "";
		}

		for (const backRef of wrapper.querySelectorAll<HTMLElement>(
			"[data-footnote-backref]",
		)) {
			backRef.remove();
		}

		return collapseWhitespace(wrapper.textContent ?? "");
	};

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
		const plainText = extractPlainTextFromHtml(data.contentHtml);
		const blocks = [
			data.frontmatter.title,
			data.frontmatter.description,
			formatDate(data.frontmatter.date),
			plainText,
			pageUrl,
		].filter((value) => value.trim().length > 0);
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

<article class="grid-section-full pb-32 pt-52 md:pt-56">
	<header class="col-content-wide mb-14 text-center">
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
				class="action-button"
			>
				Read with Claude
			</a>
			<a
				href={chatGptUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="action-button"
			>
				Read with ChatGPT
			</a>
			<button type="button" onclick={copyContent} class="action-button">
				Copy content
			</button>
			<button type="button" onclick={copyLink} class="action-button">
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

	<div class="essay-flow">
		{@html data.contentHtml}
	</div>

	<p class="col-content mt-16 font-handwritten text-muted">Han</p>

	<MdxMediaEnhancer />
</article>

<Threshold compact />
