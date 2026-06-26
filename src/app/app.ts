import { App } from './core/app';
import { device, getDeviceProfile } from './systems/device';
import { flushInputFrame, getInputState, input } from './systems/input';
import { motion } from './systems/motion';
import { getRouteState, onRouteAfterSwap, onRouteLoad, route } from './systems/route';
import { getScrollState, scroll } from './systems/scroll';
import { getThemeState, theme } from './systems/theme';
import { lines } from './ui/lines';
import { logo } from './ui/logo';
import { media } from './ui/media';
import { preview } from './ui/preview';

const systems = [device, theme, route, input, scroll, motion] as const;
const ui = [lines, media, preview, logo] as const;

const app = new App([...systems, ...ui], {
	getProfile: getDeviceProfile,
	getRoute: getRouteState,
	getInput: getInputState,
	getScroll: getScrollState,
	getTheme: getThemeState,
	afterFrame: flushInputFrame,
});

app.start();
onRouteAfterSwap(() => app.refreshPage('route:after-swap'));
onRouteLoad(() => app.refreshPage('route:load'));
