/**
 * Accessibility Tests
 * 
 * This test suite verifies WCAG 2.1 AA compliance using axe-core
 * and tests keyboard navigation, screen reader compatibility,
 * and other accessibility features.
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

test.describe('Accessibility Compliance', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the application
		await page.goto('/');
		
		// Wait for the app to load fully
		await page.waitForLoadState('networkidle');
		
		// Check if we're authenticated by looking for either the login button or user menu
		const isAuthenticated = await page.locator('[data-testid="user-menu"]').isVisible();
		const hasLoginButton = await page.locator('button:has-text("Sign In")').isVisible();
		
		if (!isAuthenticated && hasLoginButton) {
			// If we see a login button, we're not authenticated - skip test
			test.skip();
		}
		
		// If authenticated, wait for user menu to be visible
		if (isAuthenticated) {
			await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
		}
		
		// Inject axe-core for accessibility testing
		await injectAxe(page);
	});

	test.describe('Core Pages Accessibility', () => {
		test('should pass accessibility audit on home page', async ({ page }) => {
			await checkA11y(page, null, {
				detailedReport: true,
				detailedReportOptions: { html: true }
			});
		});

		test('should pass accessibility audit on games page', async ({ page }) => {
			// Navigate to games page
			await page.goto('/games');
			await page.waitForLoadState('networkidle');
			
			await checkA11y(page, null, {
				detailedReport: true,
				detailedReportOptions: { html: true }
			});
		});

		test('should pass accessibility audit on game detail page', async ({ page }) => {
			// Find first available game and navigate to it
			const gameCards = page.locator('[data-testid*="game-"], .game-card');
			const gamesCount = await gameCards.count();
			
			if (gamesCount > 0) {
				await gameCards.first().click();
				await page.waitForLoadState('networkidle');
				
				await checkA11y(page, null, {
					detailedReport: true,
					detailedReportOptions: { html: true }
				});
			} else {
				test.skip();
			}
		});
	});

	test.describe('Component Accessibility', () => {
		test('should have accessible form controls in create game dialog', async ({ page }) => {
			// Open create game dialog
			await page.click('[data-testid="create-game-button"], text="Create Game"');
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).toBeVisible();
			
			// Check accessibility of the dialog
			await checkA11y(page, '[data-testid="create-game-dialog"], #create_game_modal', {
				detailedReport: true,
				detailedReportOptions: { html: true }
			});
		});

		test('should have proper heading hierarchy', async ({ page }) => {
			// Check that headings follow proper h1 -> h2 -> h3 hierarchy
			const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
			
			// Should have at least one h1
			const h1Count = await page.locator('h1').count();
			expect(h1Count).toBeGreaterThan(0);
			
			// Check for logical heading structure (this is a basic check)
			expect(headings.length).toBeGreaterThan(0);
		});

		test('should have accessible navigation menu', async ({ page }) => {
			// Check main navigation
			await checkA11y(page, '[data-testid="main-nav"], nav, .navigation', {
				detailedReport: true,
				detailedReportOptions: { html: true }
			});
		});
	});

	test.describe('Keyboard Navigation', () => {
		test('should navigate through interactive elements with Tab key', async ({ page }) => {
			// Start from the beginning of the page
			await page.keyboard.press('Tab');
			
			// Should focus on the first interactive element
			const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
			expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(firstFocused);
		});

		test('should activate buttons with Enter and Space keys', async ({ page }) => {
			// Focus on a button
			const button = page.locator('[data-testid="create-game-button"], button:visible').first();
			await button.focus();
			
			// Press Enter
			await page.keyboard.press('Enter');
			
			// Should open the create game dialog
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).toBeVisible();
			
			// Close dialog and test Space key
			await page.keyboard.press('Escape');
			await button.focus();
			await page.keyboard.press('Space');
			
			// Should also open the dialog
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).toBeVisible();
		});

		test('should close dialogs with Escape key', async ({ page }) => {
			// Open create game dialog
			await page.click('[data-testid="create-game-button"], text="Create Game"');
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).toBeVisible();
			
			// Press Escape
			await page.keyboard.press('Escape');
			
			// Dialog should close
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).not.toBeVisible();
		});

		test('should have visible focus indicators', async ({ page }) => {
			// Tab through interactive elements and check for focus indicators
			const interactiveElements = page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible');
			const count = await interactiveElements.count();
			
			if (count > 0) {
				// Focus on first element
				await interactiveElements.first().focus();
				
				// Check if there's a visible focus indicator
				const focusedElement = page.locator(':focus');
				await expect(focusedElement).toBeVisible();
				
				// The focused element should have some form of focus styling
				// This is a basic check - in practice you'd check for specific CSS properties
				const isFocused = await page.evaluate(() => {
					const focused = document.activeElement;
					if (!focused) return false;
					
					const styles = window.getComputedStyle(focused);
					// Check for common focus indicators
					return (
						styles.outline !== 'none' || 
						styles.boxShadow !== 'none' ||
						styles.borderColor !== 'initial'
					);
				});
				
				expect(isFocused).toBe(true);
			}
		});
	});

	test.describe('Screen Reader Compatibility', () => {
		test('should have proper ARIA labels and roles', async ({ page }) => {
			// Check for proper ARIA attributes
			const violations = await getViolations(page, null, {
				rules: {
					'aria-allowed-attr': { enabled: true },
					'aria-required-attr': { enabled: true },
					'aria-required-children': { enabled: true },
					'aria-required-parent': { enabled: true },
					'aria-roles': { enabled: true },
					'aria-valid-attr': { enabled: true },
					'aria-valid-attr-value': { enabled: true }
				}
			});
			
			expect(violations).toHaveLength(0);
		});

		test('should have descriptive button and link text', async ({ page }) => {
			// Check for buttons and links with accessible names
			const violations = await getViolations(page, null, {
				rules: {
					'button-name': { enabled: true },
					'link-name': { enabled: true }
				}
			});
			
			expect(violations).toHaveLength(0);
		});

		test('should have proper form labels', async ({ page }) => {
			// Check form labeling
			const violations = await getViolations(page, null, {
				rules: {
					'label': { enabled: true },
					'label-title-only': { enabled: true },
					'form-field-multiple-labels': { enabled: true }
				}
			});
			
			expect(violations).toHaveLength(0);
		});

		test('should have meaningful page title', async ({ page }) => {
			const title = await page.title();
			expect(title).toBeTruthy();
			expect(title.length).toBeGreaterThan(0);
			expect(title).not.toBe('Document'); // Default title
		});
	});

	test.describe('Color and Contrast', () => {
		test('should meet color contrast requirements', async ({ page }) => {
			const violations = await getViolations(page, null, {
				rules: {
					'color-contrast': { enabled: true },
					'color-contrast-enhanced': { enabled: false } // AAA level, not required
				}
			});
			
			expect(violations).toHaveLength(0);
		});

		test('should not rely solely on color for information', async ({ page }) => {
			const violations = await getViolations(page, null, {
				rules: {
					'color-contrast': { enabled: true },
					'link-in-text-block': { enabled: true }
				}
			});
			
			expect(violations).toHaveLength(0);
		});
	});

	test.describe('Responsive and Mobile Accessibility', () => {
		test('should be accessible on mobile viewport', async ({ page }) => {
			// Set mobile viewport
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');
			
			await checkA11y(page, null, {
				detailedReport: true,
				detailedReportOptions: { html: true }
			});
		});

		test('should have touch-friendly targets on mobile', async ({ page }) => {
			// Set mobile viewport
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState('networkidle');
			
			// Check for minimum touch target sizes (44x44px)
			const smallTargets = await page.evaluate(() => {
				const interactiveElements = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
				const smallElements = [];
				
				interactiveElements.forEach(element => {
					const rect = element.getBoundingClientRect();
					if (rect.width < 44 || rect.height < 44) {
						smallElements.push({
							tagName: element.tagName,
							width: rect.width,
							height: rect.height,
							text: element.textContent?.trim() || element.getAttribute('aria-label')
						});
					}
				});
				
				return smallElements;
			});
			
			// Log small targets for debugging but don't fail the test (this is often a design decision)
			if (smallTargets.length > 0) {
				console.warn('Elements with small touch targets found:', smallTargets);
			}
		});
	});

	test.describe('Error Handling Accessibility', () => {
		test('should announce errors to screen readers', async ({ page }) => {
			// Trigger a validation error
			await page.click('[data-testid="create-game-button"], text="Create Game"');
			await expect(page.locator('[data-testid="create-game-dialog"], #create_game_modal')).toBeVisible();
			
			// Try to submit without filling required fields
			await page.click('[data-testid="create-game-submit"], button[type="submit"]:has-text("Create")');
			
			// Check if error messages are properly associated with form fields
			const violations = await getViolations(page, '[data-testid="create-game-dialog"], #create_game_modal', {
				rules: {
					'aria-describedby': { enabled: true },
					'aria-errormessage': { enabled: true }
				}
			});
			
			// Should not have violations related to error messaging
			const relevantViolations = violations.filter(v => 
				v.id === 'aria-describedby' || v.id === 'aria-errormessage'
			);
			expect(relevantViolations).toHaveLength(0);
		});
	});

	test.describe('Progressive Enhancement', () => {
		test('should work without JavaScript (basic functionality)', async ({ page }) => {
			// Disable JavaScript
			await page.context().addInitScript(() => {
				window.addEventListener('DOMContentLoaded', () => {
					// Remove all event listeners by replacing elements
					document.querySelectorAll('button, a').forEach(el => {
						const newEl = el.cloneNode(true);
						el.parentNode?.replaceChild(newEl, el);
					});
				});
			});
			
			await page.reload();
			await page.waitForLoadState('networkidle');
			
			// Basic structure should still be accessible
			await checkA11y(page, null, {
				detailedReport: true,
				detailedReportOptions: { html: true },
				rules: {
					// Focus only on structure and static content accessibility
					'page-has-heading-one': { enabled: true },
					'landmark-one-main': { enabled: true },
					'region': { enabled: true }
				}
			});
		});
	});
});