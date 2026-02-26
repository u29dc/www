<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/state";
	import AtomicTextMorph from "$lib/components/atomic/AtomicTextMorph.svelte";
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
    const promptArticleContent = $derived(
        data.articleContent.replace(/\n{3,}/g, "\n\n").trim(),
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
            `\n6. For related topics, search other artifacts: ${SITE.url}/sitemap.xml` +
            `\n\nFull article content:\n"""\n${promptArticleContent}\n"""`,
    );
	const claudeUrl = $derived(
		`https://claude.ai/new?${new URLSearchParams({ q: llmPrompt }).toString()}`,
	);
	const chatGptUrl = $derived(
		`https://chatgpt.com/?${new URLSearchParams({ q: llmPrompt }).toString()}`,
	);
	const COPY_FEEDBACK_DURATION_MS = 1_000;

	let contentCopied = $state(false);
	let linkCopied = $state(false);
	let copyAnnouncement = $state("");
	let announcementFrame: number | null = null;
	let contentResetTimer: ReturnType<typeof setTimeout> | null = null;
	let linkResetTimer: ReturnType<typeof setTimeout> | null = null;
	let copyContentButton: HTMLButtonElement | null = $state(null);
	let copyLinkButton: HTMLButtonElement | null = $state(null);
	let copyContentButtonWidth = $state<string | undefined>(undefined);
	let copyLinkButtonWidth = $state<string | undefined>(undefined);

	const clearCopyTimers = (): void => {
		if (contentResetTimer !== null) {
			clearTimeout(contentResetTimer);
			contentResetTimer = null;
		}
		if (linkResetTimer !== null) {
			clearTimeout(linkResetTimer);
			linkResetTimer = null;
		}
	};

	const announceCopy = (message: string): void => {
		if (typeof window === "undefined") return;
		copyAnnouncement = "";
		if (announcementFrame !== null) {
			cancelAnimationFrame(announcementFrame);
		}
		announcementFrame = requestAnimationFrame(() => {
			copyAnnouncement = message;
			announcementFrame = null;
		});
	};

	const setCopyFeedback = (target: "content" | "link"): void => {
		if (target === "content") {
			contentCopied = true;
			if (contentResetTimer !== null) {
				clearTimeout(contentResetTimer);
			}
			contentResetTimer = setTimeout(() => {
				contentCopied = false;
				contentResetTimer = null;
			}, COPY_FEEDBACK_DURATION_MS);
			return;
		}

		linkCopied = true;
		if (linkResetTimer !== null) {
			clearTimeout(linkResetTimer);
		}
		linkResetTimer = setTimeout(() => {
			linkCopied = false;
			linkResetTimer = null;
		}, COPY_FEEDBACK_DURATION_MS);
	};

	const measureButtonWidth = (
		button: HTMLButtonElement | null,
	): string | undefined => {
		if (!button) return;
		return `${button.offsetWidth}px`;
	};

	const syncLockedButtonWidths = (): void => {
		const contentWidth = measureButtonWidth(copyContentButton);
		if (contentWidth) {
			copyContentButtonWidth = contentWidth;
		}
		const linkWidth = measureButtonWidth(copyLinkButton);
		if (linkWidth) {
			copyLinkButtonWidth = linkWidth;
		}
	};

	const copyWithFallback = (value: string): boolean => {
		if (typeof document === "undefined") return false;
		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "true");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.append(textarea);
		textarea.select();
		const copied = document.execCommand("copy");
		textarea.remove();
		return copied;
	};

	const writeToClipboard = async (value: string): Promise<boolean> => {
		if (
			typeof navigator !== "undefined" &&
			navigator.clipboard?.writeText
		) {
			try {
				await navigator.clipboard.writeText(value);
				return true;
			} catch {
				// fall through to legacy copy path
			}
		}
		return copyWithFallback(value);
	};

	const copyContent = async (): Promise<void> => {
		const blocks = [
			data.frontmatter.title,
			data.frontmatter.description,
			formatDate(data.frontmatter.date),
			promptArticleContent,
			pageUrl,
			markdownPageUrl,
		].filter((v) => v.trim().length > 0);
		const didCopy = await writeToClipboard(blocks.join("\n\n"));
		if (!didCopy) return;
		setCopyFeedback("content");
		announceCopy("Content copied to clipboard");
	};

	const copyLink = async (): Promise<void> => {
		const didCopy = await writeToClipboard(pageUrl);
		if (!didCopy) return;
		setCopyFeedback("link");
		announceCopy("Link copied to clipboard");
	};

	onMount(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncWidths = (): void => {
			if (!contentCopied && !linkCopied) {
				syncLockedButtonWidths();
			}
		};

		const syncWidthsDeferred = (): void => {
			requestAnimationFrame(syncWidths);
		};

		syncWidthsDeferred();

		window.addEventListener("resize", syncWidthsDeferred);
		const fontSet = document.fonts;
		const supportsFontEvents =
			typeof fontSet !== "undefined" &&
			typeof fontSet.addEventListener === "function";
		if (supportsFontEvents) {
			fontSet.addEventListener("loadingdone", syncWidthsDeferred);
		}

		return () => {
			window.removeEventListener("resize", syncWidthsDeferred);
			if (supportsFontEvents) {
				fontSet.removeEventListener("loadingdone", syncWidthsDeferred);
			}
		};
	});

	onDestroy(() => {
		clearCopyTimers();
		if (announcementFrame !== null) {
			cancelAnimationFrame(announcementFrame);
			announcementFrame = null;
		}
	});
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
				class="inline-flex min-h-[30px] cursor-pointer select-none items-center justify-center rounded-md bg-subtle px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
			>
				Read with Claude
			</a>
			<a
				href={chatGptUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-[30px] cursor-pointer select-none items-center justify-center rounded-md bg-subtle px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
			>
				Read with ChatGPT
			</a>
			<button
				bind:this={copyContentButton}
				type="button"
				onclick={copyContent}
				style:width={copyContentButtonWidth}
				class="inline-flex min-h-[30px] min-w-[12ch] cursor-pointer select-none appearance-none items-center justify-center rounded-md border-0 bg-subtle px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
			>
				<AtomicTextMorph
					text={contentCopied ? "Copied" : "Copy content"}
				/>
			</button>
			<button
				bind:this={copyLinkButton}
				type="button"
				onclick={copyLink}
				style:width={copyLinkButtonWidth}
				class="inline-flex min-h-[30px] min-w-[9ch] cursor-pointer select-none appearance-none items-center justify-center rounded-md border-0 bg-subtle px-3 font-mono font-xs text-foreground no-underline focus-ring pressed-state action-chip-hover"
			>
				<AtomicTextMorph text={linkCopied ? "Copied" : "Copy link"} />
			</button>
		</div>
		<p aria-live="polite" class="sr-only" role="status">
			{copyAnnouncement}
		</p>
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
		class="article-flow col-full grid-section-full grid gap-y-12 [&>*:not(.mdx-quote)]:col-content [&_[data-footnotes]]:mt-[2.4rem] [&_[data-footnotes]]:border-t [&_[data-footnotes]]:[border-color:var(--edge)] [&_[data-footnotes]]:pt-[2rem] [&_[data-footnotes]_ol]:grid [&_[data-footnotes]_ol]:list-decimal [&_[data-footnotes]_ol]:gap-y-[1.2rem] [&_[data-footnotes]_ol]:ps-[2.2rem] [&_[data-footnotes]_li]:[font-family:var(--font-mono)] [&_[data-footnotes]_li]:text-[1.1rem] [&_[data-footnotes]_li]:font-normal [&_[data-footnotes]_li]:normal-case [&_[data-footnotes]_li]:leading-[1.5] [&_[data-footnotes]_li]:text-muted [&_[data-footnotes]_p]:inline [&_a[data-footnote-ref]]:font-mono [&_a[data-footnote-ref]]:text-[0.95rem] [&_a[data-footnote-ref]]:text-muted [&_a[data-footnote-ref]]:no-underline [&_a[data-footnote-backref]]:hidden"
	>
		{@html data.contentHtml}
	</div>

	<p class="col-content mt-16 font-handwritten text-muted">Han</p>

	<MdxMediaEnhancer />
</article>

<Threshold compact />
