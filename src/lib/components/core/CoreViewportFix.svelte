<script lang="ts">
	import { onMount } from "svelte";

	onMount(() => {
		let resizeTimeoutId: ReturnType<typeof setTimeout> | undefined;
		let scrollTimeoutId: ReturnType<typeof setTimeout> | undefined;

		const setVhVariable = () => {
			const height = window.visualViewport?.height ?? window.innerHeight;
			const vh = height * 0.01;
			document.documentElement.style.setProperty("--vh", `${vh}px`);
		};

		const setVhVariableThrottled = () => {
			if (resizeTimeoutId) {
				clearTimeout(resizeTimeoutId);
			}
			resizeTimeoutId = setTimeout(setVhVariable, 100);
		};

		setVhVariable();

		const events: Array<"resize" | "orientationchange"> = [
			"resize",
			"orientationchange",
		];

		if (window.visualViewport) {
			window.visualViewport.addEventListener(
				"resize",
				setVhVariableThrottled,
			);
		}

		for (const event of events) {
			window.addEventListener(event, setVhVariableThrottled);
		}

		const handleScroll = () => {
			if (scrollTimeoutId) {
				clearTimeout(scrollTimeoutId);
			}
			scrollTimeoutId = setTimeout(setVhVariable, 150);
		};

		const isMobileSafari =
			/iPhone|iPad|iPod/.test(navigator.userAgent) &&
			/Safari/.test(navigator.userAgent);
		if (isMobileSafari) {
			window.addEventListener("scroll", handleScroll, { passive: true });
		}

		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener(
					"resize",
					setVhVariableThrottled,
				);
			}

			for (const event of events) {
				window.removeEventListener(event, setVhVariableThrottled);
			}

			if (isMobileSafari) {
				window.removeEventListener("scroll", handleScroll);
			}

			if (resizeTimeoutId) {
				clearTimeout(resizeTimeoutId);
			}

			if (scrollTimeoutId) {
				clearTimeout(scrollTimeoutId);
			}
		};
	});
</script>
