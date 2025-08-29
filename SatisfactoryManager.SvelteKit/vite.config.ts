import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(), 
		devtoolsJson()
		// Removed WebSocket plugin - causes HMR conflicts and architectural issues
	],

	server: {
		host: true,
		port: parseInt(process.env.PORT ?? '5173'),
		allowedHosts: ['5173.code.melenet.ovh']
	}
});
