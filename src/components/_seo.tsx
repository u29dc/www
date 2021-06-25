import Head from 'next/head';
import { NextSeo, SocialProfileJsonLd } from 'next-seo';

export default function SEO() {
	return (
		<>
			<NextSeo
				title="iinfin (@u29dc)"
				canonical="https://iinf.in"
				description="iinfin @u29dc"
				openGraph={{
					description: 'iinfin @u29dc',
					title: 'iinfin',
					type: 'website',
					url: 'https://iinf.in',
				}}
				twitter={{
					cardType: 'summary_large_image',
					handle: '@u29dc',
					site: '@u29dc',
				}}
			/>

			<Head>
				<link rel="amphtml" href="https://iinf.in/" />
				<link rel="canonical" href="https://iinf.in/" />
				<link rel="index" href="https://iinf.in/" />
				<link rel="shortlink" href="https://iinf.in/" />

				<meta name="author" content="u29dc" />
				<meta name="copyright" content="Public Domain" />
				<link rel="license" href="https://creativecommons.org/publicdomain/zero/1.0" />

				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
				<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
				<link rel="manifest" href="/manifest.json" />

				<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="#000000" />
				<meta name="apple-mobile-web-app-title" content="iinfin (@u29dc)" />
				<meta name="application-name" content="iinfin (@u29dc)" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="msapplication-config" content="/browserconfig.xml" />
				<meta name="msapplication-navbutton-color" content="#000000" />
				<meta name="msapplication-starturl" content="https://iinf.in/" />
				<meta name="msapplication-tilecolor" content="#000000" />
				<meta name="msapplication-tileimage" content="/mstile-144x144.png" />
				<meta name="msapplication-tooltip" content="iinfin (@u29dc)" />
				<meta name="theme-color" content="#000000" />
			</Head>

			{/* <SocialProfileJsonLd type="Person" name="iinfin" url="https://iinf.in" sameAs={['https://about.me/u29dc', 'https://angel.co/u29dc', 'https://artstation.com/u29dc', 'https://behance.net/u29dc', 'https://dribbble.com/u29dc', 'https://ello.co/u29dc', 'https://flickr.com/u29dc', 'https://github.com/u29dc', 'https://gitlab.com/u29dc', 'https://goodreads.com/u29dc', 'https://instagram.com/u29dc', 'https://linkedin.com/company/u29dc', 'https://linkedin.com/in/u29dc', 'https://medium.com/u29dc', 'https://pinterest.com/u29dc', 'https://reddit.com/u/u29dc', 'https://soundcloud.com/u29dc', 'https://twitch.tv/u29dc', 'https://twitter.com/u29dc', 'https://u29dc.bandcamp.com', 'https://vimeo.com/u29dc']} /> */}
		</>
	);
}
