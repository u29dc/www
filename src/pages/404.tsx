import Head from 'next/head';

export default function NotFound() {
	return (
		<>
			<Head>
				<meta httpEquiv="refresh" content="0; url=/" />
			</Head>
		</>
	);
}
