import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const WORKER_PATH = resolve(process.cwd(), '.svelte-kit', 'cloudflare', '_worker.js');

const HELPER_NEEDLE = 'var origin;\n';
const LOOKUP_NEEDLE = `    await initialized;
    let pragma = req.headers.get("cache-control") || "";
    let res = !pragma.includes("no-cache") && await r2(req);
    if (res) return res;
    let { pathname, search } = new URL(req.url);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
    }
`;
const SAVE_NEEDLE = `    pragma = res.headers.get("cache-control") || "";
    return pragma && res.status < 400 ? c(req, res, ctx) : res;
`;

const HELPER_BLOCK = `var origin;
// u29dc: protect the dynamic homepage from stale Worker cache entries.
function shouldBypassRootWorkerCache(req, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (pathname === "/") return true;
  if (!base_path) return false;
  return pathname === base_path || pathname === \`\${base_path}/\`;
}
function toWorkerCacheKey(req) {
  return new Request(req.url, { method: "GET" });
}
`;

const LOOKUP_BLOCK = `    await initialized;
    let { pathname, search } = new URL(req.url);
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
    }
    const bypass_root_worker_cache = shouldBypassRootWorkerCache(req, pathname);
    if (bypass_root_worker_cache) {
      ctx.waitUntil(s.delete(toWorkerCacheKey(req)));
    }
    let pragma = req.headers.get("cache-control") || "";
    let res = !bypass_root_worker_cache && !pragma.includes("no-cache") && await r2(req);
    if (res) return res;
`;

const SAVE_BLOCK = `    if (bypass_root_worker_cache) {
      res = new Response(res.body, res);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("CDN-Cache-Control", "no-store");
      res.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    }
    pragma = res.headers.get("cache-control") || "";
    return pragma && res.status < 400 ? c(req, res, ctx) : res;
`;

const patchWorker = async (): Promise<void> => {
	const source = await readFile(WORKER_PATH, 'utf8');

	if (source.includes('u29dc: protect the dynamic homepage from stale Worker cache entries.')) {
		process.stdout.write(`Worker already patched: ${WORKER_PATH}\n`);
		return;
	}

	if (!source.includes(HELPER_NEEDLE)) {
		throw new Error(`Unable to find helper insertion point in ${WORKER_PATH}`);
	}

	if (!source.includes(LOOKUP_NEEDLE)) {
		throw new Error(`Unable to find cache lookup block in ${WORKER_PATH}`);
	}

	if (!source.includes(SAVE_NEEDLE)) {
		throw new Error(`Unable to find cache save block in ${WORKER_PATH}`);
	}

	const patched = source.replace(HELPER_NEEDLE, HELPER_BLOCK).replace(LOOKUP_NEEDLE, LOOKUP_BLOCK).replace(SAVE_NEEDLE, SAVE_BLOCK);

	await writeFile(WORKER_PATH, patched);
	process.stdout.write(`Patched Cloudflare worker: ${WORKER_PATH}\n`);
};

await patchWorker();
