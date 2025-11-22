#!/usr/bin/env node
/**
 * Creates symlinks for local development.
 * These symlinks are gitignored and only exist locally.
 */
import { existsSync, symlinkSync, unlinkSync, lstatSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, '..');

const symlinks = [
    { link: 'public/data', target: '../test-fixtures/data' },
    { link: 'public/config', target: '../test-fixtures/config' },
];

for (const { link, target } of symlinks) {
    const linkPath = join(dashboardRoot, link);

    // Remove existing symlink/file if it exists
    try {
        const stat = lstatSync(linkPath);
        if (stat.isSymbolicLink() || stat.isFile() || stat.isDirectory()) {
            unlinkSync(linkPath);
        }
    } catch {
        // Path doesn't exist, which is fine
    }

    // Create symlink
    try {
        symlinkSync(target, linkPath);
        console.log(`✓ Created symlink: ${link} -> ${target}`);
    } catch (err) {
        if (err.code === 'EEXIST') {
            console.log(`✓ Symlink exists: ${link}`);
        } else {
            console.error(`✗ Failed to create symlink ${link}:`, err.message);
        }
    }
}

console.log('Dev symlinks ready.');
