import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: { port: 3000 },
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id): string | undefined => {
					// WebGL components: separate chunk for optional visual feature
					if (id.includes('AtomicBrandLogo') || id.includes('CoreGrainOverlay')) {
						return 'webgl';
					}
					// Lenis: smooth scroll library in its own chunk
					if (id.includes('lenis')) {
						return 'lenis';
					}
					return undefined;
				},
			},
		},
	},
});
