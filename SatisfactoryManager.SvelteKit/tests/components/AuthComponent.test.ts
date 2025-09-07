/**
 * Tests for AuthComponent.svelte
 * 
 * This test suite covers the authentication component which handles
 * sign in/out functionality and displays different states based on
 * authentication status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import AuthComponent from '$lib/components/AuthComponent.svelte';
import { setupAuthSuccess, setupAuthFailure, resetAuthMocks, mockAccount } from '../setup/auth-mocks';

// Mock the auth state module
const mockAuthState = {
	isLoading: false,
	isAuthenticated: false,
	user: null,
	signIn: vi.fn().mockResolvedValue(undefined),
	signOut: vi.fn().mockResolvedValue(undefined)
};

vi.mock('$lib/states/authState.svelte', () => ({
	getAuthState: () => mockAuthState
}));

describe('AuthComponent', () => {
	beforeEach(() => {
		cleanup();
		resetAuthMocks();
		// Reset mock state
		mockAuthState.isLoading = false;
		mockAuthState.isAuthenticated = false;
		mockAuthState.user = null;
		mockAuthState.signIn.mockClear();
		mockAuthState.signOut.mockClear();
	});

	describe('Loading State', () => {
		it('should display loading spinner when authentication is initializing', () => {
			mockAuthState.isLoading = true;
			
			render(AuthComponent);
			
			expect(screen.getByText('Initializing authentication...')).toBeInTheDocument();
			expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
		});
	});

	describe('Unauthenticated State', () => {
		it('should display sign in prompt when user is not authenticated', () => {
			mockAuthState.isAuthenticated = false;
			
			render(AuthComponent);
			
			expect(screen.getByText('Sign In Required')).toBeInTheDocument();
			expect(screen.getByText('Please sign in to access your account.')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Sign In with Azure B2C' })).toBeInTheDocument();
		});

		it('should call signIn when sign in button is clicked', async () => {
			mockAuthState.isAuthenticated = false;
			
			render(AuthComponent);
			
			const signInButton = screen.getByRole('button', { name: 'Sign In with Azure B2C' });
			await fireEvent.click(signInButton);
			
			expect(mockAuthState.signIn).toHaveBeenCalledTimes(1);
		});

		it('should handle sign in error gracefully', async () => {
			mockAuthState.isAuthenticated = false;
			mockAuthState.signIn.mockRejectedValue(new Error('Sign in failed'));
			
			// Spy on console.error
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			
			render(AuthComponent);
			
			const signInButton = screen.getByRole('button', { name: 'Sign In with Azure B2C' });
			await fireEvent.click(signInButton);
			
			expect(mockAuthState.signIn).toHaveBeenCalledTimes(1);
			expect(consoleSpy).toHaveBeenCalledWith('Sign in failed:', expect.any(Error));
			
			consoleSpy.mockRestore();
		});
	});

	describe('Authenticated State', () => {
		beforeEach(() => {
			setupAuthSuccess();
			mockAuthState.isAuthenticated = true;
			mockAuthState.user = {
				id: 'test-user-id',
				displayName: 'Test User',
				email: 'test@example.com'
			};
		});

		it('should display user information when authenticated', () => {
			render(AuthComponent);
			
			expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
			expect(screen.getByText('Email:', { exact: false })).toBeInTheDocument();
			expect(screen.getByText('test@example.com')).toBeInTheDocument();
			expect(screen.getByText('Display Name:', { exact: false })).toBeInTheDocument();
			expect(screen.getByText('Test User')).toBeInTheDocument();
			expect(screen.getByText('User ID:', { exact: false })).toBeInTheDocument();
			expect(screen.getByText('test-user-id')).toBeInTheDocument();
		});

		it('should display sign out button when authenticated', () => {
			render(AuthComponent);
			
			expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
		});

		it('should call signOut when sign out button is clicked', async () => {
			render(AuthComponent);
			
			const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
			await fireEvent.click(signOutButton);
			
			expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
		});

		it('should handle sign out error gracefully', async () => {
			mockAuthState.signOut.mockRejectedValue(new Error('Sign out failed'));
			
			// Spy on console.error
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			
			render(AuthComponent);
			
			const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
			await fireEvent.click(signOutButton);
			
			expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);
			expect(consoleSpy).toHaveBeenCalledWith('Sign out failed:', expect.any(Error));
			
			consoleSpy.mockRestore();
		});

		it('should fallback to email in welcome message when displayName is not available', () => {
			mockAuthState.user = {
				id: 'test-user-id',
				displayName: null,
				email: 'test@example.com'
			};
			
			render(AuthComponent);
			
			expect(screen.getByText('Welcome, test@example.com!')).toBeInTheDocument();
		});

		it('should handle missing user details gracefully', () => {
			mockAuthState.user = {
				id: 'test-user-id',
				displayName: 'Test User',
				email: null
			};
			
			render(AuthComponent);
			
			expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
			expect(screen.queryByText('Email:', { exact: false })).not.toBeInTheDocument();
			expect(screen.getByText('Display Name:', { exact: false })).toBeInTheDocument();
			expect(screen.getByText('User ID:', { exact: false })).toBeInTheDocument();
		});
	});

	describe('Visual Structure', () => {
		it('should have proper CSS classes for styling', () => {
			render(AuthComponent);
			
			expect(document.querySelector('.auth-container')).toBeInTheDocument();
		});

		it('should display cards with proper DaisyUI classes', () => {
			render(AuthComponent);
			
			const card = document.querySelector('.card');
			expect(card).toBeInTheDocument();
			expect(card).toHaveClass('w-96', 'bg-base-100', 'shadow-xl');
		});

		it('should have proper button styling', () => {
			render(AuthComponent);
			
			const button = screen.getByRole('button');
			expect(button).toHaveClass('btn', 'btn-primary');
		});
	});

	describe('Accessibility', () => {
		it('should have proper heading structure', () => {
			render(AuthComponent);
			
			const heading = screen.getByRole('heading', { level: 2 });
			expect(heading).toBeInTheDocument();
		});

		it('should have accessible button labels', () => {
			mockAuthState.isAuthenticated = false;
			
			render(AuthComponent);
			
			const button = screen.getByRole('button');
			expect(button).toHaveAccessibleName('Sign In with Azure B2C');
		});

		it('should have accessible button labels when authenticated', () => {
			mockAuthState.isAuthenticated = true;
			mockAuthState.user = { id: '1', displayName: 'Test', email: 'test@example.com' };
			
			render(AuthComponent);
			
			const button = screen.getByRole('button');
			expect(button).toHaveAccessibleName('Sign Out');
		});
	});
});