<script lang="ts">
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
	import AtomicBrandLogo from "$lib/components/atomic/AtomicBrandLogo.svelte";
	import { theme } from "$lib/theme.svelte";

	type Props = {
		compact?: boolean;
	};

	let { compact = false }: Props = $props();

	let isMobile = $state(false);
	let newsletterEmail = $state("");
	let newsletterMessage = $state(
		"Occasional notes when there is something worth sending.",
	);
	let newsletterState = $state<
		"idle" | "submitting" | "success" | "error"
	>("idle");
	let newsletterInvalid = $state(false);

	const sourcePath = $derived(page.url.pathname || "/");
	const isNewsletterSubmitting = $derived(
		newsletterState === "submitting",
	);
	const newsletterButtonLabel = $derived(
		isNewsletterSubmitting ? "Signing up..." : "Sign up",
	);
	const newsletterStatusId = "newsletter-status";

	interface NewsletterResponse {
		ok: boolean;
		code:
			| "SUBSCRIBED"
			| "INVALID_EMAIL"
			| "UNAVAILABLE"
			| "SERVER_ERROR";
		message: string;
	}

	onMount(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	});

	const resetNewsletterFeedback = (): void => {
		if (
			newsletterState === "success" ||
			newsletterState === "error" ||
			newsletterInvalid
		) {
			newsletterState = "idle";
			newsletterInvalid = false;
			newsletterMessage =
				"Occasional notes when there is something worth sending.";
		}
	};

	const handleNewsletterInput = (): void => {
		resetNewsletterFeedback();
	};

	const handleNewsletterSubmit = async (
		event: SubmitEvent,
	): Promise<void> => {
		const form =
			event.currentTarget instanceof HTMLFormElement
				? event.currentTarget
				: null;

		if (!form) return;

		event.preventDefault();

		const emailField = form.elements.namedItem("email");

		if (!(emailField instanceof HTMLInputElement)) return;

		if (!emailField.reportValidity()) {
			newsletterState = "error";
			newsletterInvalid = true;
			newsletterMessage = "Enter a valid email address.";
			return;
		}

		newsletterState = "submitting";
		newsletterInvalid = false;
		newsletterMessage = "Submitting...";

		try {
			const response = await fetch(form.action, {
				method: "POST",
				body: new FormData(form),
				headers: {
					accept: "application/json",
				},
			});

			const payload = (await response
				.json()
				.catch(() => null)) as NewsletterResponse | null;

			if (!response.ok || payload?.ok !== true) {
				newsletterState = "error";
				newsletterInvalid = payload?.code === "INVALID_EMAIL";
				newsletterMessage =
					payload?.message ?? "Signup failed. Try again in a minute.";

				if (newsletterInvalid) {
					emailField.focus();
				}

				return;
			}

			newsletterState = "success";
			newsletterInvalid = false;
			newsletterMessage = payload.message;
			newsletterEmail = "";
			form.reset();
		} catch {
			newsletterState = "error";
			newsletterInvalid = false;
			newsletterMessage = "Signup failed. Try again in a minute.";
		}
	};

	interface FooterLink {
		title: string;
		description: string;
		href: string;
		note?: string;
	}

	const links: FooterLink[] = [
		{
			title: "Calendar",
			description: "Let's meet",
			href: "https://cal.com/u29dc/hey",
			note: "Always open to conversations that question premises, not just solve within them",
		},
		{
			title: "Email",
			description: "han@u29dc.com",
			href: "mailto:han@u29dc.com",
			note: "Response time: 48 hours",
		},
		{
			title: "Instagram",
			description: "@u29dc",
			href: "https://instagram.com/u29dc",
		},
		{
			title: "LinkedIn",
			description: "u29dc",
			href: "https://linkedin.com/in/u29dc",
		},
	];
</script>

<footer
	id="threshold"
	class="grid-section-full min-h-screen-safe -mx-[var(--grid-margin)] rounded-sm px-[var(--grid-margin)] md:-mx-[var(--grid-margin-md)] md:px-[var(--grid-margin-md)] lg:mx-0 lg:px-0 [background-color:var(--surface-subtle)]"
	class:mt-96={!compact}
	class:mt-40={compact}
>
	<div
		class="col-content flex flex-col justify-between gap-16 pb-16"
		class:pt-64={!compact}
		class:pt-40={compact}
	>
		<!-- Top: Headline + Pricing + Grid Links -->
		<div class="w-full mt-4">
			<h2 class="font-serif font-2xl font-bold">
				<span class="block sm:inline"
					>Stories that hold aren't written.</span
				>
				<span class="block sm:inline">They're built.</span>
			</h2>

			<p class="mt-8 font-mono text-muted">
				£3,000 · 48 hours · Three routes, one recommendation.
			</p>

			<!-- Grid Links aligned to parent content tracks -->
			<div class="mt-12 grid-content-tracks gap-y-4">
				{#each links as link}
					<a
						href={link.href}
						target={link.href.startsWith("mailto:")
							? undefined
							: "_blank"}
						rel={link.href.startsWith("mailto:")
							? undefined
							: "noopener noreferrer"}
						class="col-span-full group flex flex-row justify-between gap-2 border-b border-edge px-3 py-6 transition duration-200 hover-bg-contrast focus-ring external-link-feedback md:col-span-3 lg:col-span-2 4xl:col-span-1"
					>
						<div>
							<div class="uppercase">{link.title}</div>
							<div class="hover-contrast-secondary">
								{link.description}
							</div>
							{#if link.note}
								<div class="mt-2 font-mono hover-contrast-secondary">
									[ {link.note} ]
								</div>
							{/if}
						</div>
						<div class="transition-transform duration-200 group-hover:-translate-x-2">
							<ArrowUpRight size={16} />
						</div>
					</a>
				{/each}

				<div class="col-span-full border-b border-edge px-3 py-6">
					<div class="flex flex-col gap-4">
						<div>
							<div class="uppercase">News</div>
							<p
								id={newsletterStatusId}
								role="status"
								aria-live="polite"
								class="mt-2 font-mono"
								class:text-foreground={newsletterState ===
									"success"}
								class:text-muted={newsletterState !== "success"}
							>
								{newsletterMessage}
							</p>
						</div>

						<form
							method="POST"
							action="/api/newsletter"
							onsubmit={handleNewsletterSubmit}
							class="flex flex-col gap-3 md:flex-row md:items-start"
						>
							<label class="sr-only" for="newsletter-email">
								Email address
							</label>
							<input
								id="newsletter-email"
								bind:value={newsletterEmail}
								type="email"
								name="email"
								required
								autocomplete="email"
								inputmode="email"
								autocapitalize="none"
								autocorrect="off"
								spellcheck="false"
								placeholder="you@company.com"
								aria-describedby={newsletterStatusId}
								aria-invalid={newsletterInvalid
									? "true"
									: undefined}
								oninput={handleNewsletterInput}
								class="min-h-[44px] w-full rounded-md border border-edge bg-transparent px-4 py-0 [font-family:var(--font-mono)] text-[1.6rem] font-normal tracking-[0.03em] text-foreground placeholder:font-normal placeholder:tracking-[0.03em] placeholder:text-muted/70 focus-ring touch-manipulation md:text-[1.3rem]"
							/>
							<input
								type="hidden"
								name="source"
								value={sourcePath}
							/>
							<div class="sr-only" aria-hidden="true">
								<label for="newsletter-website">
									Leave this field empty
								</label>
								<input
									id="newsletter-website"
									type="text"
									name="website"
									tabindex="-1"
									autocomplete="off"
								/>
							</div>
							<button
								type="submit"
								disabled={isNewsletterSubmitting}
								class="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md bg-subtle px-6 font-mono font-xs text-foreground transition-colors duration-200 focus-ring pressed-state action-chip-hover touch-manipulation whitespace-nowrap md:px-7 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{newsletterButtonLabel}
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>

		<!-- Middle: Large Logo -->
		<AtomicBrandLogo
			width={isMobile ? 250 : 400}
			theme={theme.resolved}
			noiseIntensity={0.1}
			noiseScale={0.5}
			defaultBlurIntensity={0.25}
			blurStart={1.5}
			mouseBlurIntensity={isMobile ? 0.2 : 0.25}
			mouseBlurSize={isMobile ? 0.2 : 0.4}
		/>

		<!-- Bottom: Handwritten Signature -->
		<div class="relative -top-20 font-handwritten sm:-top-24">
			After all, isn't true infinity always incomplete?
		</div>
	</div>
</footer>
