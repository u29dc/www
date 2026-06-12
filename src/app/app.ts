import { App } from './core/app';
import { device, getDeviceProfile } from './systems/device';
import { motion } from './systems/motion';
import { getRouteState, route } from './systems/route';
import { scroll } from './systems/scroll';
import { lines } from './ui/lines';
import { logo } from './ui/logo';
import { media } from './ui/media';
import { preview } from './ui/preview';

const systems = [device, route, scroll, motion] as const;
const ui = [lines, media, preview, logo] as const;

new App([...systems, ...ui], {
	getProfile: getDeviceProfile,
	getRoute: getRouteState,
}).start();
