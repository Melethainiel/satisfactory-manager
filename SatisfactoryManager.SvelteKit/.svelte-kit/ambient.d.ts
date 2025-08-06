
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const DATABASE_URL: string;
	export const VSCODE_CWD: string;
	export const OTEL_BSP_SCHEDULE_DELAY: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const VSCODE_NLS_CONFIG: string;
	export const USER: string;
	export const OTEL_EXPORTER_OTLP_HEADERS: string;
	export const LANGUAGE: string;
	export const npm_config_user_agent: string;
	export const OTEL_EXPORTER_OTLP_PROTOCOL: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const XDG_SESSION_TYPE: string;
	export const DEBUG: string;
	export const npm_node_execpath: string;
	export const SHLVL: string;
	export const npm_config_noproxy: string;
	export const HOME: string;
	export const OTEL_SERVICE_NAME: string;
	export const CHROME_DESKTOP: string;
	export const PORT: string;
	export const DOTNET_DASHBOARD_FRONTEND_BROWSERTOKEN: string;
	export const DESKTOP_SESSION: string;
	export const npm_package_json: string;
	export const ASPIRE_RESOURCE_SERVICE_ENDPOINT_URL: string;
	export const VSCODE_IPC_HOOK: string;
	export const GTK_MODULES: string;
	export const APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL: string;
	export const npm_config_userconfig: string;
	export const npm_config_local_prefix: string;
	export const OTEL_METRIC_EXPORT_INTERVAL: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const SYSTEMD_EXEC_PID: string;
	export const npm_config_engine_strict: string;
	export const COLORTERM: string;
	export const COLOR: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const npm_config_metrics_registry: string;
	export const OTEL_TRACES_SAMPLER: string;
	export const IM_CONFIG_PHASE: string;
	export const APPLICATION_INSIGHTS_NO_STATSBEAT: string;
	export const WAYLAND_DISPLAY: string;
	export const VSCODE_L10N_BUNDLE_LOCATION: string;
	export const LOGNAME: string;
	export const _: string;
	export const npm_config_prefix: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const XDG_SESSION_CLASS: string;
	export const APPLICATIONINSIGHTS_CONFIGURATION_CONTENT: string;
	export const TERM: string;
	export const DOTNET_DASHBOARD_URL: string;
	export const USERNAME: string;
	export const npm_config_cache: string;
	export const GNOME_DESKTOP_SESSION_ID: string;
	export const CommonPropertyBagWithConfigPath: string;
	export const OTEL_METRICS_EXEMPLAR_FILTER: string;
	export const npm_config_node_gyp: string;
	export const PATH: string;
	export const GDM_LANG: string;
	export const SESSION_MANAGER: string;
	export const DOTNET_MULTILEVEL_LOOKUP: string;
	export const NODE: string;
	export const npm_package_name: string;
	export const XDG_MENU_PREFIX: string;
	export const GNOME_SETUP_DISPLAY: string;
	export const GDK_BACKEND: string;
	export const GNOME_TERMINAL_SCREEN: string;
	export const XDG_RUNTIME_DIR: string;
	export const DISPLAY: string;
	export const CommonPropertyBagPath: string;
	export const LANG: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL: string;
	export const OTEL_EXPORTER_OTLP_ENDPOINT: string;
	export const XMODIFIERS: string;
	export const XAUTHORITY: string;
	export const LS_COLORS: string;
	export const XDG_SESSION_DESKTOP: string;
	export const GNOME_TERMINAL_SERVICE: string;
	export const npm_lifecycle_script: string;
	export const SSH_AUTH_SOCK: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const SHELL: string;
	export const VSCODE_DOTNET_INSTALL_TOOL_ORIGINAL_HOME: string;
	export const npm_package_version: string;
	export const npm_lifecycle_event: string;
	export const QT_ACCESSIBILITY: string;
	export const ELECTRON_RUN_AS_NODE: string;
	export const GDMSESSION: string;
	export const GPG_AGENT_INFO: string;
	export const QT_IM_MODULE: string;
	export const npm_config_globalconfig: string;
	export const npm_config_init_module: string;
	export const JAVA_HOME: string;
	export const PWD: string;
	export const OTEL_RESOURCE_ATTRIBUTES: string;
	export const VSCODE_CLI: string;
	export const npm_config_globalignorefile: string;
	export const npm_execpath: string;
	export const XDG_DATA_DIRS: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const ANDROID_HOME: string;
	export const npm_config_global_prefix: string;
	export const npm_command: string;
	export const OTEL_BLRP_SCHEDULE_DELAY: string;
	export const NODE_ENV: string;
	export const ELECTRON_NO_ATTACH_CONSOLE: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const VTE_VERSION: string;
	export const VSCODE_PID: string;
	export const INIT_CWD: string;
	export const EDITOR: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		DATABASE_URL: string;
		VSCODE_CWD: string;
		OTEL_BSP_SCHEDULE_DELAY: string;
		VSCODE_ESM_ENTRYPOINT: string;
		VSCODE_NLS_CONFIG: string;
		USER: string;
		OTEL_EXPORTER_OTLP_HEADERS: string;
		LANGUAGE: string;
		npm_config_user_agent: string;
		OTEL_EXPORTER_OTLP_PROTOCOL: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		XDG_SESSION_TYPE: string;
		DEBUG: string;
		npm_node_execpath: string;
		SHLVL: string;
		npm_config_noproxy: string;
		HOME: string;
		OTEL_SERVICE_NAME: string;
		CHROME_DESKTOP: string;
		PORT: string;
		DOTNET_DASHBOARD_FRONTEND_BROWSERTOKEN: string;
		DESKTOP_SESSION: string;
		npm_package_json: string;
		ASPIRE_RESOURCE_SERVICE_ENDPOINT_URL: string;
		VSCODE_IPC_HOOK: string;
		GTK_MODULES: string;
		APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL: string;
		npm_config_userconfig: string;
		npm_config_local_prefix: string;
		OTEL_METRIC_EXPORT_INTERVAL: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		SYSTEMD_EXEC_PID: string;
		npm_config_engine_strict: string;
		COLORTERM: string;
		COLOR: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		npm_config_metrics_registry: string;
		OTEL_TRACES_SAMPLER: string;
		IM_CONFIG_PHASE: string;
		APPLICATION_INSIGHTS_NO_STATSBEAT: string;
		WAYLAND_DISPLAY: string;
		VSCODE_L10N_BUNDLE_LOCATION: string;
		LOGNAME: string;
		_: string;
		npm_config_prefix: string;
		MEMORY_PRESSURE_WATCH: string;
		XDG_SESSION_CLASS: string;
		APPLICATIONINSIGHTS_CONFIGURATION_CONTENT: string;
		TERM: string;
		DOTNET_DASHBOARD_URL: string;
		USERNAME: string;
		npm_config_cache: string;
		GNOME_DESKTOP_SESSION_ID: string;
		CommonPropertyBagWithConfigPath: string;
		OTEL_METRICS_EXEMPLAR_FILTER: string;
		npm_config_node_gyp: string;
		PATH: string;
		GDM_LANG: string;
		SESSION_MANAGER: string;
		DOTNET_MULTILEVEL_LOOKUP: string;
		NODE: string;
		npm_package_name: string;
		XDG_MENU_PREFIX: string;
		GNOME_SETUP_DISPLAY: string;
		GDK_BACKEND: string;
		GNOME_TERMINAL_SCREEN: string;
		XDG_RUNTIME_DIR: string;
		DISPLAY: string;
		CommonPropertyBagPath: string;
		LANG: string;
		XDG_CURRENT_DESKTOP: string;
		ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL: string;
		OTEL_EXPORTER_OTLP_ENDPOINT: string;
		XMODIFIERS: string;
		XAUTHORITY: string;
		LS_COLORS: string;
		XDG_SESSION_DESKTOP: string;
		GNOME_TERMINAL_SERVICE: string;
		npm_lifecycle_script: string;
		SSH_AUTH_SOCK: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		SHELL: string;
		VSCODE_DOTNET_INSTALL_TOOL_ORIGINAL_HOME: string;
		npm_package_version: string;
		npm_lifecycle_event: string;
		QT_ACCESSIBILITY: string;
		ELECTRON_RUN_AS_NODE: string;
		GDMSESSION: string;
		GPG_AGENT_INFO: string;
		QT_IM_MODULE: string;
		npm_config_globalconfig: string;
		npm_config_init_module: string;
		JAVA_HOME: string;
		PWD: string;
		OTEL_RESOURCE_ATTRIBUTES: string;
		VSCODE_CLI: string;
		npm_config_globalignorefile: string;
		npm_execpath: string;
		XDG_DATA_DIRS: string;
		VSCODE_CODE_CACHE_PATH: string;
		ANDROID_HOME: string;
		npm_config_global_prefix: string;
		npm_command: string;
		OTEL_BLRP_SCHEDULE_DELAY: string;
		NODE_ENV: string;
		ELECTRON_NO_ATTACH_CONSOLE: string;
		MEMORY_PRESSURE_WRITE: string;
		VTE_VERSION: string;
		VSCODE_PID: string;
		INIT_CWD: string;
		EDITOR: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
