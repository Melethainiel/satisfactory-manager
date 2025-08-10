<script lang="ts">
  import { getGameState } from '$lib/states/gameState.svelte';
  import type { AddUserDialogHandle } from './AddUserDialogHandle';

  const gameState = getGameState();

  let dialogEl: HTMLDialogElement | null = null;
  let emailsText = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  function parseEmails(input: string): string[] {
    return input
      .split(/[,\n;\s]+/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
      .filter(e => /.+@.+\..+/.test(e));
  }

  async function submit(e?: Event) {
    e?.preventDefault();
    const gameId = gameState.selectedGameId;
    if (!gameId) return;
    const emails = parseEmails(emailsText);
    if (emails.length === 0) { error = 'Enter at least one valid email'; return; }
    isSubmitting = true;
    error = null;
    try {
      const res = await fetch(`/api/games/${gameId}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emails })
      });
      if (!res.ok) throw new Error('Failed to add users');
      const data = await res.json();
      // refresh local users list
      await gameState.loadGameUsers(gameId);
      emailsText = '';
      dialogEl?.close();
    } catch (e: any) {
      error = e?.message ?? 'Failed to add users';
    } finally {
      isSubmitting = false;
    }
  }

  export const open: AddUserDialogHandle['open'] = () => {
    dialogEl?.showModal();
  };
</script>

<dialog bind:this={dialogEl} class="modal" id="add_user_modal">
  <div class="modal-box max-w-lg">
    <h3 class="mb-2 text-lg font-bold">Add Users</h3>
    <form onsubmit={submit} class="flex flex-col gap-4">
      <textarea
        class="textarea textarea-bordered h-32"
        placeholder="Enter one or more email addresses separated by commas, spaces or new lines"
        bind:value={emailsText}
        required></textarea>
      <p class="text-xs opacity-70">Example: user1@example.com, user2@example.com</p>
      {#if error}
        <div class="alert alert-error py-2 text-sm flex justify-between">
          <span>{error}</span>
          <button class="btn btn-xs" onclick={() => (error = null)} type="button">Clear</button>
        </div>
      {/if}
      <div class="modal-action">
        <button type="button" class="btn" onclick={() => dialogEl?.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
          {#if isSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Add
        </button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label="Close add users modal">close</button></form>
</dialog>

<style>
  dialog:not([open]) { display:none; }
</style>
