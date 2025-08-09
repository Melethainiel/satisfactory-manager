import { getContext, setContext } from 'svelte';

export interface GameSummary {
  id: string;
  name: string;
}

export interface GameState {
  games: GameSummary[];
  selectedGameId: string | null;
  isLoading: boolean;
  error: string | null;
  loadGames: (userEmail: string) => Promise<void>;
  selectGame: (id: string) => void;
  createGame: (userEmail: string, name: string) => Promise<void>;
  clearError: () => void;
}

class GameStateClass implements GameState {
  games = $state<GameSummary[]>([]);
  selectedGameId = $state<string | null>(null);
  isLoading = $state<boolean>(false);
  error = $state<string | null>(null);

  async loadGames(userEmail: string) {
    if (!userEmail) {
      this.error = 'Missing user email';
      return;
    }
    this.isLoading = true;
    this.error = null;
    try {
      const res = await fetch(`/api/games?email=${encodeURIComponent(userEmail)}`);
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
    this.isLoading = true;
    this.error = null;
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: userEmail, name })
      });
      if (!res.ok) throw new Error(`Failed to create game (${res.status})`);
      const created = (await res.json()) as GameSummary;
      this.games = [...this.games, created].sort((a,b)=>a.name.localeCompare(b.name));
      this.selectedGameId = created.id;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to create game';
    } finally {
      this.isLoading = false;
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
