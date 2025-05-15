// modules/pglite-assets.ts
import type { Plugin, ResolvedConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import fs from 'fs-extra'; // Use fs-extra for reliable copying

export function copyPgliteAssets(): Plugin {
  let viteConfig: ResolvedConfig;
  const assetsToCopy = [
    { src: 'pglite.wasm', dest: 'pglite.wasm' },
    { src: 'pglite.data', dest: 'pglite.data' },
    { src: 'vector.tar.gz', dest: 'vector/vector.tar.gz' },
    { src: 'vector.tar.gz', dest: 'vector.tar.gz' },
  ];

  return {
    name: 'vite-plugin-copy-pglite-assets',

    // Get Vite's resolved config
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    // Copy files after the bundle is written
    async writeBundle() {
      if (!viteConfig) return;
      const logger = viteConfig.logger;
      logger.info('Executing vite-plugin-copy-pglite-assets...');

      // Adjust path to find node_modules relative to the project root from viteConfig
      const pgliteDir = resolve(viteConfig.root, 'node_modules/@electric-sql/pglite/dist');
      const outDir = viteConfig.build.outDir; // Use Vite's output directory

      for (const asset of assetsToCopy) {
        const sourcePath = resolve(pgliteDir, asset.src);
        const destPath = resolve(outDir, asset.dest);

        try {
          // Ensure the destination directory exists before copying
          await fs.ensureDir(dirname(destPath));
          if (await fs.pathExists(sourcePath)) {
            await fs.copy(sourcePath, destPath);
            logger.info(`Copied PGlite asset: ${asset.src} -> ${destPath}`);
          } else {
            logger.warn(`PGlite asset not found, skipping: ${sourcePath}`);
          }
        } catch (error: any) {
          logger.error(`Error copying PGlite asset ${asset.src}: ${error.message}`);
        }
      }
    }
  };
}