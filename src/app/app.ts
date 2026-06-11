import { device, getDeviceProfile } from './device/device';
import { lines } from './lines/lines';
import { logo } from './logo/logo';
import { media } from './media/media';
import { motion } from './motion/motion';
import { preview } from './preview/preview';
import { initAstroRouteAdapter } from './route/astro';
import { getRouteState, route } from './route/route';
import { startRuntime } from './runtime/loop';
import { scroll } from './scroll/scroll';

initAstroRouteAdapter();

startRuntime([device, route, scroll, motion, lines, media, preview, logo], {
	getProfile: getDeviceProfile,
	getRoute: getRouteState,
});
