import '../styles/index.scss';

import SEO from '../components/_seo';
import Preload from '../components/_preload';

import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
	const setVH = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);

	useEffect(() => {
		setVH();
		window.addEventListener('resize', () => {
			setVH();
		});
	}, []);

	return (
		<>
			<SEO />
			<Preload />
			<Component {...pageProps} />
		</>
	);
}
