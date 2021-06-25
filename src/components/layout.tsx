import Header from './header';
import Footer from './footer';

export default function Layout({ children, ...props }) {
	return (
		<>
			<div id="layout">
				<Header />
				<main>{children}</main>
				<Footer />
			</div>
		</>
	);
}
