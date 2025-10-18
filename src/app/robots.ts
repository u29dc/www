/** Generate robots.txt at /robots.txt. */

export { generateRobots as default } from '@/lib/metadata';

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
