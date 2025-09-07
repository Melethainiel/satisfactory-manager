/**
 * Component testing setup file
 * 
 * This file configures the testing environment for Svelte components,
 * including DOM matchers, global mocks, and testing utilities.
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Global setup for DOM testing environment
beforeEach(() => {
	// Mock window.matchMedia for tests that might use responsive components
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation(query => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // deprecated
			removeListener: vi.fn(), // deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});

	// Mock IntersectionObserver if needed for components with lazy loading
	Object.defineProperty(window, 'IntersectionObserver', {
		writable: true,
		value: vi.fn().mockImplementation(() => ({
			disconnect: vi.fn(),
			observe: vi.fn(),
			unobserve: vi.fn(),
		})),
	});

	// Mock ResizeObserver for responsive components
	Object.defineProperty(window, 'ResizeObserver', {
		writable: true,
		value: vi.fn().mockImplementation(() => ({
			disconnect: vi.fn(),
			observe: vi.fn(),
			unobserve: vi.fn(),
		})),
	});
});

// Mock CSS modules and Svelte component imports
vi.mock('$app/environment', () => ({
	browser: false,
	dev: true,
	building: false,
	version: 'test'
}));

// Mock SvelteKit navigation functions for component tests
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn(),
	pushState: vi.fn(),
	replaceState: vi.fn()
}));

// Mock stores for components that might use them
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn(() => vi.fn()),
	},
	navigating: {
		subscribe: vi.fn(() => vi.fn()),
	},
	updated: {
		subscribe: vi.fn(() => vi.fn()),
	}
}));

// Global test utilities
export const mockComponent = (name: string, props: Record<string, any> = {}) => {
	return {
		$$prop_def: props,
		$$render: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn(),
		$set: vi.fn(),
	};
};

// Helper for testing Svelte 5 runes
export const mockRune = (initialValue: any) => {
	let value = initialValue;
	const rune = {
		get value() { return value; },
		set value(newValue) { value = newValue; }
	};
	return rune;
};

// Azure B2C / MSAL Browser mocks for authentication-dependent components
import { msalBrowserMock } from './auth-mocks';
vi.mock('@azure/msal-browser', () => msalBrowserMock);

// Console configuration for tests
const originalConsoleError = console.error;
beforeEach(() => {
	// Suppress known harmless warnings in tests
	console.error = (...args: any[]) => {
		if (
			typeof args[0] === 'string' &&
			(args[0].includes('Warning: ReactDOM.render') ||
			args[0].includes('Warning: componentWillReceiveProps'))
		) {
			return;
		}
		originalConsoleError.call(console, ...args);
	};
});

afterEach(() => {
	console.error = originalConsoleError;
});