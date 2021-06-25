import Layout from '../components/layout';
import Link from 'next/link';

export default function Index() {
	return (
		<>
			<Layout>
				<section className="section--title">U29DC</section>
				<section className="section--subtitle">A speculative, multifaceted practice pursuing digital lucid dreams, realized by form and light in a foreverbox</section>
				<section className="section--links">
					<Link href="mailto:han@iinf.in">
						<a className="link">han@iinf.in</a>
					</Link>
					<Link href="https://twitter.com/u29dc">
						<a className="link">twitter</a>
					</Link>
					<Link href="https://vimeo.com/u29dc">
						<a className="link">vimeo</a>
					</Link>
					<Link href="https://instagram.com/u29dc">
						<a className="link">instagram</a>
					</Link>
					<Link href="https://github.com/u29dc">
						<a className="link">github</a>
					</Link>
				</section>
			</Layout>
		</>
	);
}
