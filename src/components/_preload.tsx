import Head from 'next/head';

export default function Preload() {
	return (
		<>
			<Head>
				<link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
				<link rel="preconnect" href="https://cdn.jsdelivr.net" />

				<link rel="preload" as="image" type="image/png" href="/apple-touch-icon.png" />
				<link rel="preload" as="image" type="image/png" href="/favicon-16x16.png" />
				<link rel="preload" as="image" type="image/png" href="/favicon-32x32.png" />

				<link rel="preload" crossOrigin="anonymous" as="font" type="font/woff2" href="https://cdn.jsdelivr.net/npm/inter-ui/Inter%20(web)/Inter.var.woff2" />
				<link rel="preload" crossOrigin="anonymous" as="font" type="font/woff2" href="https://cdn.jsdelivr.net/npm/inter-ui/Inter%20(web)/Inter-roman.var.woff2" />
				<link rel="preload" crossOrigin="anonymous" as="font" type="font/woff2" href="https://cdn.jsdelivr.net/npm/inter-ui/Inter%20(web)/Inter-italic.var.woff2" />
			</Head>
		</>
	);
}
