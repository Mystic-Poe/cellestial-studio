// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Astro downloads and self-hosts this at build time, so no request ever
	// leaves the visitor's browser for a font CDN. Quicksand is OFL, which is
	// the licence policy's first preference, and it is the rounded monoline
	// face closest to the A4 wordmark. One variable file carries every weight
	// the site uses (400 to 700).
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Quicksand',
			cssVariable: '--font-quicksand',
			weights: ['400 700'],
			styles: ['normal'],
			subsets: ['latin'],
			fallbacks: ['ui-rounded', 'system-ui', 'sans-serif'],
		},
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
