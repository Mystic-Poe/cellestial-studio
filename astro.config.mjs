// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Astro downloads and self-hosts these at build time, so no request ever
	// leaves the visitor's browser for a font CDN. Plex Mono is OFL, which is
	// the licence policy's first preference.
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'IBM Plex Mono',
			cssVariable: '--font-plex-mono',
			weights: [400, 500, 600],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-monospace', 'monospace'],
		},
		{
			provider: fontProviders.google(),
			name: 'Instrument Serif',
			cssVariable: '--font-instrument-serif',
			weights: [400],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			fallbacks: ['Georgia', 'serif'],
		},
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
