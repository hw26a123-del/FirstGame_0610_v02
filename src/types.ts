/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameState {
  Lobby = 'LOBBY',
  Playing = 'PLAYING',
  Paused = 'PAUSED',
  GameOver = 'GAME_OVER',
  GameWon = 'GAME_WON'
}

export type SkinId = 'blue' | 'green' | 'red' | 'purple' | 'gold';

export interface Skin {
  id: SkinId;
  name: string;
  color: string;
  accent: string;
  cost: number; // in coins
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  skinId: SkinId;
  facingLeft: boolean;
  score: number;
  coins: number;
  altitude: number;
  activePowerup: 'shield' | 'rocket' | null;
  powerupTimer: number; // ticks left
  isGrounded?: boolean;
  standingOnPlatformId?: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number;
  type: 'normal' | 'breakable' | 'moving' | 'spring' | 'disappearing';
  width: number;
  height: number;
  vx?: number; // for moving
  broken?: boolean;
  breakProgress?: number; // fade out animation when broken
  disappearProgress?: number; // dynamic visibility for disappearing platforms
  disappearDirection?: number; // 1 or -1
  visited?: boolean;
  originalY?: number;
  originalX?: number;
  respawnTime?: number;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulseOffset: number;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: 'shield' | 'rocket';
  width: number;
  height: number;
  collected: boolean;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  type: 'floater' | 'vortex';
  phase: number; // for wave movement
  destroyed?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface HighScore {
  name: string;
  score: number;
  altitude: number;
  date: string;
  id: string;
}
