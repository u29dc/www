# Dependency patches

## Astro 7.3.5

`astro@7.3.5.patch` removes the obsolete `"use astro:head-inject"` directive from generated content asset wrappers. Rolldown warns when bundling this unknown directive.

In this Astro version, `dist/vite-plugin-head/index.js` discovers propagation through the `astroPropagatedAssets` module flag and component metadata, while CSS propagation uses the same module boundary. Nothing reads the old directive. The patch preserves the wrapper, dynamic import, metadata, and collected assets; it does not filter warnings or disable bundler checks.

Bun applies the version-specific patch through `patchedDependencies` during installation. `scripts/astro.test.ts` builds a real MDX collection whose only component owns scoped CSS and a browser script, then checks that both assets reach the generated page without warnings.

When upgrading Astro, inspect its propagation implementation and remove this patch once upstream no longer emits the obsolete directive. Run the regression test and the full clean quality gate before removing it.
