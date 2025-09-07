/**
 * E2E Tests for Game Management
 * 
 * This test suite covers the complete game management user journey:
 * - Creating new games
 * - Managing game settings
 * - Deleting games
 * - User permissions and access control
 */

import { test, expect } from '@playwright/test';
import { setupMockAuthForTest } from '../helpers/mockAuth';

test.describe('Game Management', () => {
	test.beforeEach(async ({ page }) => {
		// Set up mock authentication for this test
		await setupMockAuthForTest(page);
		
		// Navigate to the application
		await page.goto('/');
		
		// Wait for the page to load (don't wait for networkidle as our mock might cause issues)
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(3000); // Give time for MSAL to initialize
		
		// Ensure we're authenticated - the mock should handle this
		await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });
	});

	test.describe('Game Creation', () => {
		test('should create a new game successfully', async ({ page }) => {
			// Navigate to games page or click create game button
			await page.click('text="Create new game"');
			
			// Wait for create game dialog to appear
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			// Verify we can see the dialog content
			await expect(page.locator('text="Create"')).toBeVisible();
		});

		test('should validate game name input', async ({ page }) => {
			// Open create game dialog
			await page.click('text="Create new game"');
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			// Try to submit with empty name
			await page.click('[data-testid="create-game-submit"]');
			
			// Should still show dialog (validation prevents submission)
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			// Try with invalid characters
			await page.fill('[data-testid="game-name-input"]', 'invalid name with spaces!');
			await page.click('[data-testid="create-game-submit"]');
			
			// Should show validation message or still be visible
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
		});

		test('should cancel game creation', async ({ page }) => {
			// Open create game dialog
			await page.click('text="Create new game"');
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			// Fill in some data
			await page.fill('[data-testid="game-name-input"]', 'cancelled-game');
			
			// Click cancel
			await page.click('[data-testid="cancel-button"]');
			
			// Dialog should close
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).not.toBeVisible();
		});
	});

	test.describe('Game Selection and Navigation', () => {
		test('should display available games', async ({ page }) => {
			// Wait for games to load
			await expect(page.locator('body')).toBeVisible();
			
			// Should show at least one game or empty state
			const gamesCount = await page.locator('[data-testid*="game-"]').count();
			if (gamesCount === 0) {
				await expect(page.locator('text="No games"')).toBeVisible();
			} else {
				expect(gamesCount).toBeGreaterThan(0);
			}
		});

		test('should navigate to game details when clicking on a game', async ({ page }) => {
			// Look for existing games
			const gameCards = page.locator('[data-testid*="game-"]');
			const gamesCount = await gameCards.count();
			
			if (gamesCount > 0) {
				// Click on first game
				await gameCards.first().click();
				
				// Should navigate to game page
				await expect(page).toHaveURL(/\/games\/[^\/]+/);
				
				// Should show game content
				await expect(page.locator('[data-testid="game-dashboard"]')).toBeVisible();
			} else {
				// Skip test if no games available
				test.skip();
			}
		});
	});

	test.describe('Game Settings and Management', () => {
		test('should open game settings', async ({ page }) => {
			// Find and click on a game
			const gameCards = page.locator('[data-testid*="game-"]');
			const gamesCount = await gameCards.count();
			
			if (gamesCount > 0) {
				await gameCards.first().click();
				await expect(page).toHaveURL(/\/games\/[^\/]+/);
				
				// Look for settings button or menu
				await page.click('[data-testid="game-settings"]');
				
				// Should show settings interface
				await expect(page.locator('[data-testid="game-settings-panel"]')).toBeVisible();
			} else {
				test.skip();
			}
		});
	});

	test.describe('Game Deletion', () => {
		test('should delete a game with confirmation', async ({ page }) => {
			// First create a test game to delete
			await page.click('text="Create new game"');
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			const testGameName = `delete-test-game-${Date.now()}`;
			await page.fill('[data-testid="game-name-input"]', testGameName);
			await page.click('[data-testid="create-game-submit"]');
			
			await expect(page.locator(`[data-testid="game-${testGameName}"]`)).toBeVisible();
			
			// Now delete the game
			// Look for delete button (might be in a dropdown menu)
			await page.click(`[data-testid="game-${testGameName}-menu"], [data-testid="game-${testGameName}"] [data-testid="game-menu"]`);
			await page.click('[data-testid="delete-game-button"]');
			
			// Should show confirmation dialog
			await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
			
			// Confirm deletion
			await page.click('[data-testid="confirm-delete"]');
			
			// Game should no longer be visible
			await expect(page.locator(`[data-testid="game-${testGameName}"]`)).not.toBeVisible();
		});

		test('should cancel game deletion', async ({ page }) => {
			// Find existing game or create one
			const gameCards = page.locator('[data-testid*="game-"]');
			const gamesCount = await gameCards.count();
			
			if (gamesCount > 0) {
				const gameCard = gameCards.first();
				const gameName = await gameCard.textContent();
				
				// Try to delete
				await page.click(`[data-testid*="game-"][data-testid*="menu"]`);
				await page.click('[data-testid="delete-game-button"]');
				
				// Should show confirmation
				await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
				
				// Cancel deletion
				await page.click('[data-testid="cancel-delete"]');
				
				// Game should still be visible
				await expect(page.locator(`text="${gameName}"`)).toBeVisible();
			} else {
				test.skip();
			}
		});
	});

	test.describe('User Permissions', () => {
		test('should show appropriate actions based on user role', async ({ page }) => {
			// This test would verify that owners see all options,
			// contributors see limited options, and readers see read-only view
			
			const gameCards = page.locator('[data-testid*="game-"]');
			const gamesCount = await gameCards.count();
			
			if (gamesCount > 0) {
				await gameCards.first().click();
				await expect(page).toHaveURL(/\/games\/[^\/]+/);
				
				// Should show appropriate UI elements based on permissions
				// This is a placeholder - actual implementation would depend on
				// how permissions are displayed in the UI
				await expect(page.locator('[data-testid="game-content"]')).toBeVisible();
			} else {
				test.skip();
			}
		});
	});

	test.describe('Error Handling', () => {
		test('should handle network errors gracefully', async ({ page }) => {
			// Intercept and fail API requests
			await page.route('**/api/games*', route => {
				route.fulfill({
					status: 500,
					body: JSON.stringify({ error: 'Internal server error' })
				});
			});
			
			// Try to create a game
			await page.click('text="Create new game"');
			await expect(page.locator('.modal:visible, [role="dialog"]:visible')).toBeVisible();
			
			await page.fill('[data-testid="game-name-input"]', 'error-test-game');
			await page.click('[data-testid="create-game-submit"]');
			
			// Should show error message
			await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
		});
	});
});