<script lang="ts">
	import { mount, onMount, unmount } from "svelte";

	type MountedMedia = {
		node: HTMLElement;
		instance: ReturnType<typeof mount>;
	};

	const parseSources = (value: string | undefined): string[] => {
		if (!value) return [];
		try {
			const parsed = JSON.parse(value) as unknown;
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(item): item is string => typeof item === "string",
				);
			}
			if (typeof parsed === "string") {
				return [parsed];
			}
		} catch {
			// ignore malformed data
		}
		return [];
	};

	onMount(() => {
		const mounted: MountedMedia[] = [];

		(async () => {
			const nodes = Array.from(
				document.querySelectorAll<HTMLElement>("[data-mdx-media]"),
			).filter((node) => node.dataset["mdxMounted"] !== "true");
			if (nodes.length === 0) return;

			const { default: MdxMedia } =
				await import("$lib/components/mdx/MdxMedia.svelte");

			for (const node of nodes) {
				const sources = parseSources(node.dataset["mdxMedia"]);
				if (sources.length === 0) continue;
				const alt = node.dataset["mdxAlt"] ?? "";
				node.dataset["mdxMounted"] = "true";
				node.replaceChildren();
				const instance = mount(MdxMedia, {
					target: node,
					props: { src: sources, alt },
				});
				mounted.push({ node, instance });
			}
		})();

		return () => {
			for (const entry of mounted) {
				unmount(entry.instance);
				delete entry.node.dataset["mdxMounted"];
			}
		};
	});
</script>
