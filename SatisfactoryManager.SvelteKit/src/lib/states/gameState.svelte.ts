import { getContext, setContext } from 'svelte';

export interface GameSummary {
  id: string;
  name: string;
}

export interface GameUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface GameState {
  games: GameSummary[];
  selectedGameId: string | null;
  isLoading: boolean;
  error: string | null;
  loadGames: (userEmail: string) => Promise<void>;
  selectGame: (id: string) => void;
  createGame: (userEmail: string, name: string) => Promise<void>;
  updateGame: (id: string, name: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  loadGameUsers: (gameId: string) => Promise<void>;
  addGameUser: (gameId: string, users: string[]) => Promise<void>;
  gameUsers: GameUser[];
  clearError: () => void;
  attachAuth: (apiFetch: AuthFetchFn) => void;
}

// Narrow helper type so we don't import full AuthState here.
type AuthFetchFn = <T = any>(input: string | URL | Request, init?: RequestInit & { autoJson?: boolean }) => Promise<T | Response>;

class GameStateClass implements GameState {
  // Function injected from auth state to fetch API token
  private apiFetch: AuthFetchFn | null = null;

  attachAuth(apiFetch: AuthFetchFn) {
    this.apiFetch = apiFetch;
  }
  async deleteGame(id: string) {
    if (!id) { this.error = 'Game id required'; return; }
    if (!this.apiFetch) return;

    this.isLoading = true;
    this.error = null;
    try {
      const res = await this.apiFetch(`/api/games/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete game (${res.status})`);
      // Remove from local state
      this.games = this.games.filter(g => g.id !== id);
      if (this.selectedGameId === id) this.selectedGameId = null;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to delete game';
    } finally {
      this.isLoading = false;
    }
  }
  games = $state<GameSummary[]>([]);
  selectedGameId = $state<string | null>(null);
  isLoading = $state<boolean>(false);
  error = $state<string | null>(null);
  gameUsers = $state<GameUser[]>([]);

  async loadGames(userEmail: string) {
    if (!userEmail) {
      this.error = 'Missing user email';
      return;
    }
    if (!this.apiFetch) return;

    this.isLoading = true;
    this.error = null;
    try {
      const res = await this.apiFetch(`/api/games?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error(`Failed to load games (${res.status})`);
      const data = (await res.json()) as GameSummary[];
      this.games = data;
      // Auto-select if only one
      if (data.length === 1) this.selectedGameId = data[0].id;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to load games';
    } finally {
      this.isLoading = false;
    }
  }

  selectGame(id: string) {
    this.selectedGameId = id;
  }

  async createGame(userEmail: string, name: string) {
    if (!userEmail) { this.error = 'Missing user email'; return; }
    if (!name) { this.error = 'Game name required'; return; }
    if (!this.apiFetch) return;

    this.isLoading = true;
    this.error = null;
    try {
      const res = await this.apiFetch('/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: userEmail, name }) });
      if (!res.ok) throw new Error(`Failed to create game (${res.status})`);
      const created = (await res.json()) as GameSummary;
      this.games = [...this.games, created].sort((a, b) => a.name.localeCompare(b.name));
      this.selectedGameId = created.id;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to create game';
    } finally {
      this.isLoading = false;
    }
  }

  async updateGame(id: string, name: string) {
    if (!id) { this.error = 'Game id required'; return; }
    if (!name) { this.error = 'Game name required'; return; }
    if (!this.apiFetch) return;

    this.isLoading = true;
    this.error = null;
    try {
      const res = await this.apiFetch(`/api/games/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error(`Failed to update game (${res.status})`);
      const updated = (await res.json()) as GameSummary;
      this.games = this.games.map(g => g.id === id ? updated : g).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to update game';
    } finally {
      this.isLoading = false;
    }
  }

  async loadGameUsers(gameId: string) {
    if (!gameId || !this.apiFetch) return;
    try {
      const res = await this.apiFetch(`/api/games/${gameId}/users`);
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = (await res.json()) as GameUser[];
      this.gameUsers = data.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to load game users';
    }
  }

  async addGameUser(gameId: string, users: string[]) {
    if (!gameId || !this.apiFetch) return;
    try {
      const res = await this.apiFetch(`/api/games/${gameId}/users`, {
         method: 'POST',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify({ emails: users })
      });
      if (!res.ok) throw new Error(`Failed to add users (${res.status})`);
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to add game users';
    }
  }

  clearError() { this.error = null; }
}

const DEFAULT_GAME_STATE_KEY = '$_game_state';

export const getGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => getContext<GameState>(key);
export const setGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => {
  const gs = new GameStateClass();
  return setContext(key, gs);
};
