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
	},

	build: {
		rollupOptions: {
			external: (id) => {
				// Don't externalize server-side WebSocket service - it should be bundled
				if (id.includes('websocketService')) {
					return false;
				}
				// Keep default behavior for other modules
				return false;
			}
		}
	},

	ssr: {
		// Ensure WebSocket-related modules can be bundled for SSR
		noExternal: ['ws', 'uuid']
	}
});
