/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { SkinId, Player, Platform, Coin, PowerUp, Enemy, Particle } from '../types';
import { sound } from './SoundManager';
import { Zap, Shield, ArrowLeft, ArrowRight, Play, RotateCcw } from 'lucide-react';

interface GameCanvasProps {
  skinId: SkinId;
  muted: boolean;
  onGameOver: (score: number, altitude: number, coinsCollected: number) => void;
  onGameWon: (score: number, altitude: number, coinsCollected: number) => void;
  onStateChange: (score: number, altitude: number, coinsCollected: number) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 650;
const GRAVITY = 0.38;
const TERMINAL_VELOCITY = 12;
const JUMP_VELOCITY = -10.5;
const SPRING_VELOCITY = -19;
const ROCKET_FORCE = -1.2;

export default function GameCanvas({
  skinId,
  muted,
  onGameOver,
  onGameWon,
  onStateChange,
  isPaused,
  setIsPaused,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchLeftRef = useRef<boolean>(false);
  const touchRightRef = useRef<boolean>(false);
  const jumpTriggerRef = useRef<(() => void) | null>(null);

  // States for live HUD tracking in React
  const [hudScore, setHudScore] = useState<number>(0);
  const [hudAltitude, setHudAltitude] = useState<number>(0);
  const [hudCoins, setHudCoins] = useState<number>(0);
  const [activePowerup, setActivePowerup] = useState<'shield' | 'rocket' | null>(null);
  const [powerupTimePct, setPowerupTimePct] = useState<number>(0);

  // Mute synchronizer
  useEffect(() => {
    sound.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let initialized = false;

    // Keys state
    const keys: { [key: string]: boolean } = {};

    // Game Objects
    let player: Player = {
      x: CANVAS_WIDTH / 2 - 18,
      y: CANVAS_HEIGHT - 120,
      vx: 0,
      vy: JUMP_VELOCITY,
      width: 36,
      height: 36,
      skinId: skinId,
      facingLeft: false,
      score: 0,
      coins: 0,
      altitude: 0,
      activePowerup: null,
      powerupTimer: 0,
    };

    let platforms: Platform[] = [];
    let coins: Coin[] = [];
    let powerUps: PowerUp[] = [];
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];

    let platformIdCounter = 0;
    let coinIdCounter = 0;
    let powerUpIdCounter = 0;
    let enemyIdCounter = 0;
    let consecutiveUnstable = 0;

    let cameraY = player.y - CANVAS_HEIGHT * 0.6;
    let highestReachedY = player.y;
    let altitudeOffset = 0;
    let isGameWonTriggered = false;
    let gameWonDelayCounter = 0;
    const GAME_WON_DELAY_FRAMES = 120; // 2 seconds at 60fps

    // Controls setup
    const triggerManualJump = () => {
      if (isPaused) return;
      // Allow manual jumping if the player is grounded, standing on a platform, or near the base platform
      if (player.isGrounded || player.vy === 0 || player.y + player.height >= CANVAS_HEIGHT - 65) {
        player.vy = JUMP_VELOCITY;
        player.isGrounded = false;
        player.standingOnPlatformId = undefined;
        sound.playJump();
        createExplosion(player.x + player.width / 2, player.y + player.height, '#38bdf8', 10);
      }
    };

    // Expose trigger for UI buttons
    jumpTriggerRef.current = triggerManualJump;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
      keys[e.key] = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        player.facingLeft = false;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        player.facingLeft = true;
      }
      if (['ArrowUp', 'w', 'W', ' ', 'Spacebar'].includes(e.key)) {
        triggerManualJump();
      }
      // Pause trigger via escape/p
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        setIsPaused(!isPaused);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
      keys[e.key] = false;
    };

    const handleCanvasClick = (e: MouseEvent | TouchEvent) => {
      if (e.type === 'touchstart') {
        e.preventDefault();
      }
      triggerManualJump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    if (canvas) {
      canvas.addEventListener('mousedown', handleCanvasClick);
      canvas.addEventListener('touchstart', handleCanvasClick, { passive: false });
    }

    // Initial platforms creation: starter stairs
    const generateInitialWorld = () => {
      platforms = [];
      coins = [];
      powerUps = [];
      enemies = [];
      particles = [];
      highestReachedY = player.y;
      altitudeOffset = 0;
      consecutiveUnstable = 0;

      // Solid starting platform directly underneath player
      platforms.push({
        id: platformIdCounter++,
        x: CANVAS_WIDTH / 2 - 50,
        y: CANVAS_HEIGHT - 60,
        width: 100,
        height: 15,
        type: 'normal',
        visited: true,
      });

      // Generate first couple screens of starter platforms
      let nextY = CANVAS_HEIGHT - 150;
      while (nextY > -500) {
        const pWidth = 80;
        const pX = Math.random() * (CANVAS_WIDTH - pWidth - 20) + 10;
        
        let type: Platform['type'] = 'normal';
        if (consecutiveUnstable >= 1) {
          type = Math.random() < 0.15 ? 'moving' : 'normal';
          consecutiveUnstable = 0;
        } else {
          const rand = Math.random();
          if (rand < 0.15) {
            type = 'moving';
            consecutiveUnstable = 0;
          } else if (rand < 0.30) {
            type = 'breakable';
            consecutiveUnstable = 1;
          }
        }

        platforms.push({
          id: platformIdCounter++,
          x: pX,
          y: nextY,
          width: pWidth,
          height: 14,
          type,
          vx: type === 'moving' ? (Math.random() > 0.5 ? 1 : -1) * 1.5 : 0,
          disappearProgress: 1,
          disappearDirection: -1,
        });

        nextY -= (Math.random() * 35 + 95); // Space out platforms safely
      }
    };

    // Spawn more dynamic platforms as player climbs
    const spawnUpperObjects = (topBoundY: number) => {
      // Find current highest platform Y
      let highestPlatformY = player.y;
      if (platforms.length > 0) {
        highestPlatformY = platforms[0].y;
        for (const p of platforms) {
          if (p.y < highestPlatformY) {
            highestPlatformY = p.y;
          }
        }
      }

      // Fill in everything up to topBoundY
      while (highestPlatformY > topBoundY) {
        // Guaranteed always physically jumpable: step distance is capped at 125px.
        // Math.random() * 20 + stepDistance - 10 yields a vertical spacing between 115px and 135px.
        const stepDistance = Math.min(105 + Math.abs(altitudeOffset) * 0.005, 125);
        const pY = highestPlatformY - (Math.random() * 20 + stepDistance - 10);

        // Ensure no platforms are generated at or above/behind the final goal (Y = -4920)
        if (pY <= -4920) {
          break;
        }

        const pWidth = Math.max(65, 80 - Math.floor(Math.abs(altitudeOffset) * 0.003));
        const pX = Math.random() * (CANVAS_WIDTH - pWidth - 20) + 10;

        // Platform type weights based on altitude
        const altFactor = Math.min(Math.abs(altitudeOffset) / 1000, 1.0); // 0.0 to 1.0 at 1000m+
        
        let type: Platform['type'] = 'normal';
        if (consecutiveUnstable >= 1) {
          // Force a stable landing platform to cure potential deadlock softlocks
          type = Math.random() < 0.25 ? 'moving' : 'normal';
          consecutiveUnstable = 0;
        } else {
          const rand = Math.random();
          if (rand < 0.25 * altFactor) {
            type = 'moving';
            consecutiveUnstable = 0;
          } else if (rand < 0.55 * altFactor) {
            type = 'breakable';
            consecutiveUnstable = 1;
          } else {
            type = 'normal';
            consecutiveUnstable = 0;
          }
        }

        const newPlatform: Platform = {
          id: platformIdCounter++,
          x: pX,
          y: pY,
          width: pWidth,
          height: 14,
          type,
          vx: type === 'moving' ? (Math.random() > 0.5 ? 1 : -1) * (1.2 + altFactor * 1.5) : 0,
          disappearProgress: 1,
          disappearDirection: -1,
        };
        platforms.push(newPlatform);

        // Danger spawn: Obstacles / Monsters are disabled per user request


        highestPlatformY = pY;
      }
    };

    // Spawn burst of small particles
    const createExplosion = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3 + 2,
          color,
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 30 + 20,
        });
      }
    };

    // Spawn visual spark path trailing behind player
    const spawnPlayerTrail = () => {
      let color = '#38bdf8'; // Default blue
      if (player.skinId === 'green') color = '#4ade80';
      if (player.skinId === 'red') color = '#f87171';
      if (player.skinId === 'purple') color = '#c084fc';
      if (player.skinId === 'gold') color = '#fbbf24';

      if (player.activePowerup === 'rocket') {
        // Blazing exhaust fire
        particles.push({
          x: player.x + player.width / 2 + (Math.random() * 8 - 4),
          y: player.y + player.height - 2,
          vx: Math.random() * 2 - 1,
          vy: Math.random() * 3 + 4,
          radius: Math.random() * 4 + 2,
          color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
          alpha: 1,
          life: 0,
          maxLife: 25,
        });
      } else if (player.activePowerup === 'shield') {
        // Soft glowing halo bubbles
        if (Math.random() < 0.4) {
          const angle = Math.random() * Math.PI * 2;
          const px = player.x + player.width / 2 + Math.cos(angle) * 25;
          const py = player.y + player.height / 2 + Math.sin(angle) * 25;
          particles.push({
            x: px,
            y: py,
            vx: Math.random() * 0.4 - 0.2,
            vy: Math.random() * 0.4 - 0.2,
            radius: Math.random() * 2 + 1.5,
            color: '#22d3ee',
            alpha: 0.8,
            life: 0,
            maxLife: 30,
          });
        }
      } else {
        // Standard motion sparks
        if (Math.random() < 0.25) {
          particles.push({
            x: player.x + Math.random() * player.width,
            y: player.y + player.height - 4,
            vx: Math.random() * 0.8 - 0.4,
            vy: Math.random() * 0.6 + 0.3,
            radius: Math.random() * 2.5 + 1.0,
            color,
            alpha: 0.7,
            life: 0,
            maxLife: 40,
          });
        }
      }
    };

    // Main Update Function
    const update = () => {
      if (isPaused) return;

      // 1. Keyboard Horizontal Speed & Touch Inputs
      let targetMove = 0;
      if (keys['ArrowRight'] || keys['d'] || keys['D'] || touchRightRef.current) {
        targetMove = 9.2; // Increased from 6.2 for maximum mid-air horizontal correction range
      } else if (keys['ArrowLeft'] || keys['a'] || keys['A'] || touchLeftRef.current) {
        targetMove = -9.2; // Increased from -6.2
      }

      // Smooth horizontal inertia
      player.vx += (targetMove - player.vx) * 0.24; // Increased responsiveness from 0.18 for sharp and instant air control
      player.x += player.vx;

      // Screen warp-around logic
      if (player.x + player.width < 0) {
        player.x = CANVAS_WIDTH;
      } else if (player.x > CANVAS_WIDTH) {
        player.x = -player.width;
      }

      // 2. Power-ups duration monitoring
      if (player.activePowerup) {
        player.powerupTimer--;
        setPowerupTimePct(Math.max(0, (player.powerupTimer / 380) * 100)); // 380 frames is powerup duration
        if (player.powerupTimer <= 0) {
          player.activePowerup = null;
          setActivePowerup(null);
        }
      }

      // 3. Rocket Mode vs Normal Physics
      if (player.activePowerup === 'rocket') {
        player.vy = JUMP_VELOCITY * 1.8; // Move upwards extremely fast
        player.isGrounded = false;
        player.standingOnPlatformId = undefined;
      } else if (!player.isGrounded) {
        // Regular gravity fall
        player.vy += GRAVITY;
        if (player.vy > TERMINAL_VELOCITY) {
          player.vy = TERMINAL_VELOCITY;
        }
      } else {
        // Grounded players don't fall, zero force
        player.vy = 0;
      }
      player.y += player.vy;

      // Trace players movement
      spawnPlayerTrail();

      // 4. Camera Auto-Scrolling & Follow Logic
      if (!isGameWonTriggered) {
        const autoScrollSpeed = 2.5; // Even faster scrolling speed for high intensity and pace

        cameraY -= autoScrollSpeed;
        altitudeOffset += autoScrollSpeed;

        // Restrict player from going above the top screen bounding box (cameraY)
        if (player.y < cameraY) {
          player.y = cameraY;
          if (player.vy < 0) {
            player.vy = 0;
          }
        }

        const rawAltitude = Math.round(altitudeOffset / 5);
        if (rawAltitude > player.altitude) {
          player.altitude = Math.min(rawAltitude, 1000); // Caps altitude display at 1000m
          // Increase score as altitude increases
          if (player.altitude * 10 > player.score) {
            player.score = player.altitude * 10;
          }
        }
      } else {
        // Clear celebration delay update
        gameWonDelayCounter++;

        // Smoothly snap camera to center the gold goal platform
        const targetCameraY = -4920 - CANVAS_HEIGHT * 0.4;
        cameraY += (targetCameraY - cameraY) * 0.08;

        // Fix altitude at 1000m
        player.altitude = 1000;

        // Constantly shoot celebratory fireworks and starry sparks around the screen
        if (Math.random() < 0.18) {
          const fx = Math.random() * CANVAS_WIDTH;
          const fy = -4920 - 120 - Math.random() * 150;
          const fColor = `hsl(${Math.random() * 360}, 100%, 65%)`;
          for (let j = 0; j < 25; j++) {
            const angle = (Math.PI * 2 / 25) * j + Math.random() * 0.2;
            const force = Math.random() * 4 + 2;
            particles.push({
              x: fx,
              y: fy,
              vx: Math.cos(angle) * force,
              vy: Math.sin(angle) * force,
              radius: Math.random() * 3.5 + 2,
              color: fColor,
              alpha: 1,
              life: 0,
              maxLife: Math.random() * 30 + 35,
            });
          }
        }

        // Add confetti-like falling stars
        if (Math.random() < 0.4) {
          particles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: cameraY - 20,
            vx: Math.random() * 2 - 1,
            vy: Math.random() * 3 + 2,
            radius: Math.random() * 3 + 1.5,
            color: `hsl(${Math.random() * 360}, 100%, 70%)`,
            alpha: 1,
            life: 0,
            maxLife: 150,
          });
        }

        if (gameWonDelayCounter >= GAME_WON_DELAY_FRAMES) {
          cancelAnimationFrame(animationId);
          cleanupEvents();
          onGameWon(player.score, 1000, player.coins);
          return;
        }
      }

      // Check for Victory / Stage Clear Goal - Replaced instant trigger with physical goal collision at Y = -4920 (1000m)
      const goalY = -4920;
      const goalWidth = 360;
      const goalX = (CANVAS_WIDTH - goalWidth) / 2;
      const goalHeight = 30;

      const collidesWithGoal =
        player.x + player.width > goalX &&
        player.x < goalX + goalWidth &&
        player.y + player.height >= goalY &&
        player.y <= goalY + goalHeight;

      if (collidesWithGoal && !isGameWonTriggered) {
        isGameWonTriggered = true;
        sound.playWin();

        // Joyful victory leap!
        player.vy = -12;
        player.isGrounded = false;
        player.standingOnPlatformId = undefined;

        // Giant initial blast of confetti
        for (let i = 0; i < 60; i++) {
          particles.push({
            x: player.x + player.width / 2 + (Math.random() * 120 - 60),
            y: goalY + (Math.random() * 30 - 15),
            vx: Math.random() * 8 - 4,
            vy: Math.random() * -10 - 4,
            radius: Math.random() * 4 + 2,
            color: `hsl(${Math.random() * 360}, 100%, 65%)`,
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 40 + 50,
          });
        }
      }

      // 5. Update platforms & dynamic states
      platforms.forEach((platform) => {
        // Horizontal screen bounds for moving platforms
        if (platform.type === 'moving' && platform.vx) {
          platform.x += platform.vx;
          if (platform.x <= 0 || platform.x + platform.width >= CANVAS_WIDTH) {
            platform.vx = -platform.vx;
          }
        }

        // Pulse disappear visibility for disappearing type
        if (platform.type === 'disappearing') {
          if (platform.disappearProgress !== undefined && platform.disappearDirection !== undefined) {
            platform.disappearProgress += platform.disappearDirection * 0.015;
            if (platform.disappearProgress <= 0.15) {
              platform.disappearProgress = 0.15;
              platform.disappearDirection = 1;
            } else if (platform.disappearProgress >= 1) {
              platform.disappearProgress = 1;
              platform.disappearDirection = -1;
            }
          }
        }

        // Handle break progress and respawn logic for breakable platforms
        if (platform.type === 'breakable') {
          if (platform.originalY === undefined) platform.originalY = platform.y;
          if (platform.originalX === undefined) platform.originalX = platform.x;

          if (platform.broken) {
            if (platform.breakProgress === undefined) platform.breakProgress = 1;
            platform.breakProgress = Math.max(0, platform.breakProgress - 0.12);
            platform.y += 3; // Crumbles down

            if (platform.respawnTime === undefined) {
              platform.respawnTime = 180; // Respawn after 3 seconds (~180 frames)
            }
            platform.respawnTime--;

            if (platform.respawnTime <= 0) {
              platform.broken = false;
              platform.breakProgress = 1;
              platform.y = platform.originalY;
              platform.x = platform.originalX;
              platform.respawnTime = undefined;

              // Regeneration energy sparks
              for (let i = 0; i < 8; i++) {
                particles.push({
                  x: platform.x + Math.random() * platform.width,
                  y: platform.y + Math.random() * platform.height,
                  vx: Math.random() * 1.6 - 0.8,
                  vy: Math.random() * -1.2 - 0.3,
                  radius: Math.random() * 2 + 1.2,
                  color: '#fbbf24',
                  alpha: 0.8,
                  life: 0,
                  maxLife: 30,
                });
              }
            }
          }
        }
      });

      // Maintain platform density at taller reaches dynamically
      spawnUpperObjects(cameraY - 600);

      // Clean up platforms, items, enemies below the camera (use originalY for breakable to avoid cleanup during crumbling)
      platforms = platforms.filter((p) => {
        const referenceY = p.originalY !== undefined ? p.originalY : p.y;
        return referenceY < cameraY + CANVAS_HEIGHT + 100;
      });
      coins = coins.filter((c) => c.y < cameraY + CANVAS_HEIGHT + 100 && !c.collected);
      powerUps = powerUps.filter((pw) => pw.y < cameraY + CANVAS_HEIGHT + 100 && !pw.collected);
      enemies = enemies.filter((e) => e.y < cameraY + CANVAS_HEIGHT + 100 && !e.destroyed);

      // 6. Collision Resolution (only when DESCENDING, or if propelled by rocket/shield override)
      const playerFeetY = player.y + player.height;

      // 6a. Check if player walked off or platform disappeared/broke
      if (player.isGrounded && player.standingOnPlatformId !== undefined) {
        if (player.standingOnPlatformId === 99999) {
          // Standing on gold goal platform
          const goalY = -4920;
          const goalWidth = 360;
          const goalX = (CANVAS_WIDTH - goalWidth) / 2;
          if (
            player.x + player.width - 6 > goalX &&
            player.x + 6 < goalX + goalWidth
          ) {
            player.vy = 0;
            player.y = goalY - player.height;
          } else {
            player.isGrounded = false;
            player.standingOnPlatformId = undefined;
          }
        } else {
          const currentP = platforms.find((p) => p.id === player.standingOnPlatformId);
          if (
            currentP &&
            !(currentP.type === 'breakable' && currentP.broken) &&
            !(currentP.type === 'disappearing' && currentP.disappearProgress !== undefined && currentP.disappearProgress < 0.4) &&
            player.x + player.width - 6 > currentP.x &&
            player.x + 6 < currentP.x + currentP.width
          ) {
            // Keep grounded! lock velocity and adjust y
            player.vy = 0;
            player.y = currentP.y - player.height;
            
            // Move with moving platform
            if (currentP.type === 'moving' && currentP.vx) {
              player.x += currentP.vx;
            }
          } else {
            // Walked off or platform broke/disappeared
            player.isGrounded = false;
            player.standingOnPlatformId = undefined;
          }
        }
      }

      // 6b. If not grounded, check if we land onto a new platform
      if (!player.isGrounded && player.vy >= 0 && player.activePowerup !== 'rocket') {
        const goalYVal = -4920;
        const goalWidthVal = 360;
        const goalXVal = (CANVAS_WIDTH - goalWidthVal) / 2;

        if (
          player.x + player.width - 6 > goalXVal &&
          player.x + 6 < goalXVal + goalWidthVal &&
          playerFeetY >= goalYVal &&
          playerFeetY - player.vy <= goalYVal + 30 + 4
        ) {
          // Land on gold goal platform
          player.vy = 0;
          player.y = goalYVal - player.height;
          player.isGrounded = true;
          player.standingOnPlatformId = 99999;
          sound.playJump();
          createExplosion(player.x + player.width / 2, player.y + player.height, '#facc15', 12);
        } else {
          for (const platform of platforms) {
            // Skip broken or faded platforms
            if (platform.type === 'breakable' && platform.broken) continue;
            if (platform.type === 'disappearing' && platform.disappearProgress !== undefined && platform.disappearProgress < 0.4) continue;

            // Hitbox criteria: check X bounds, and check if feet are stepping onto platform top
            if (
              player.x + player.width - 6 > platform.x &&
              player.x + 6 < platform.x + platform.width &&
              playerFeetY >= platform.y &&
              playerFeetY - player.vy <= platform.y + platform.height + 4
            ) {
              if (platform.type === 'spring') {
                // High velocity leaps on spring are automatic
                player.vy = SPRING_VELOCITY;
                sound.playSpring();
                createExplosion(platform.x + platform.width / 2, platform.y, '#facc15', 18);
              } else if (platform.type === 'breakable') {
                // Instantly snaps and breaks under you - triggers small snap jump automatically
                platform.broken = true;
                player.vy = JUMP_VELOCITY;
                sound.playBreak();
                createExplosion(platform.x + platform.width / 2, platform.y + platform.height / 2, '#ca8a04', 12);
              } else {
                // Standard, Moving or Disappearing: Auto-jump!
                player.vy = JUMP_VELOCITY;
                player.y = platform.y - player.height;
                player.isGrounded = false;
                player.standingOnPlatformId = undefined;
                sound.playJump();
                createExplosion(player.x + player.width / 2, player.y + player.height, '#38bdf8', 10);
              }

              // Award direct points for launching on new high heights
              if (!platform.visited) {
                platform.visited = true;
                player.score += 50;
              }

              break; // Stop evaluating more platform collisions inside single frame
            }
          }
        }
      }

      // 7. Coin Collisions
      for (const coin of coins) {
        if (!coin.collected) {
          const coinCenterX = coin.x;
          const coinCenterY = coin.y;
          const playerCenterX = player.x + player.width / 2;
          const playerCenterY = player.y + player.height / 2;

          // Basic radius collision check
          const dist = Math.hypot(coinCenterX - playerCenterX, coinCenterY - playerCenterY);
          if (dist < coin.radius + player.width / 2 + 3) {
            coin.collected = true;
            player.coins += 1;
            player.score += 200; // Big point bonuses
            sound.playCoin();
            createExplosion(coin.x, coin.y, '#f59e0b', 8);
          }
        }
      }

      // 8. Powerup Collisions
      for (const pw of powerUps) {
        if (!pw.collected) {
          if (
            player.x + player.width > pw.x &&
            player.x < pw.x + pw.width &&
            player.y + player.height > pw.y &&
            player.y < pw.y + pw.height
          ) {
            pw.collected = true;
            player.activePowerup = pw.type;
            player.powerupTimer = 380; // duration in frames (approx ~6-7 seconds)
            setActivePowerup(pw.type);
            sound.playPowerUp();
            createExplosion(pw.x + pw.width / 2, pw.y + pw.height / 2, pw.type === 'rocket' ? '#f97316' : '#22d3ee', 24);
          }
        }
      }

      // 9. Enemies Movement & Collisions
      enemies.forEach((enemy) => {
        if (enemy.destroyed) return;

        // Horizonal hover
        if (enemy.type === 'floater') {
          enemy.phase += 0.04;
          enemy.x += enemy.vx;
          // Wave movement pattern
          enemy.y += Math.sin(enemy.phase) * 0.8;

          if (enemy.x <= 15 || enemy.x + enemy.width >= CANVAS_WIDTH - 15) {
            enemy.vx = -enemy.vx;
          }
        } else {
          // Vortex spin/float
          enemy.phase += 0.02;
          enemy.x += Math.sin(enemy.phase) * 0.5;
        }

        // Hit Detection
        if (
          player.x + player.width - 5 > enemy.x &&
          player.x + 5 < enemy.x + enemy.width &&
          player.y + player.height - 5 > enemy.y &&
          player.y + 5 < enemy.y + enemy.height
        ) {
          // If rocket is active, or shield is active of course we blast them
          if (player.activePowerup === 'shield' || player.activePowerup === 'rocket') {
            enemy.destroyed = true;
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ec0022', 16);
            player.score += 500; // Monster hunter bonus
          } else {
            // Normal state check: if player hits them from the top with falling velocity, bounce and kill the monster
            if (player.vy > 1 && playerFeetY - player.vy <= enemy.y + 10) {
              enemy.destroyed = true;
              player.vy = JUMP_VELOCITY * 1.25; // bounce climb super launch
              player.isGrounded = false;
              player.standingOnPlatformId = undefined;
              createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#a855f7', 16);
              player.score += 500;
            } else {
              // Otherwise, game over (no collision sounds or game over sound played on enemy hit)
              cancelAnimationFrame(animationId);
              cleanupEvents();
              onGameOver(player.score, player.altitude, player.coins);
            }
          }
        }
      });

      // 10. Update floating particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;
      });
      particles = particles.filter((p) => p.life < p.maxLife);

      // 11. Falling Off Death Gate
      if (player.y - cameraY > CANVAS_HEIGHT + 100 && !isGameWonTriggered) {
        sound.playGameOver();
        cancelAnimationFrame(animationId);
        cleanupEvents();
        onGameOver(player.score, player.altitude, player.coins);
        return;
      }

      // Sync variables to dashboard UI
      setHudScore(player.score);
      setHudAltitude(player.altitude);
      setHudCoins(player.coins);
      onStateChange(player.score, player.altitude, player.coins);

      // 12. DRAW EVERY OBJECT TO CANVAS
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Beautiful Parallax Sky/Orbit background (dynamically changes tone based on altitude)
      // Transition from Green hill-horizon/Sky blue to Midnight navy, ending in Cosmic void space space.
      const skyFactor = Math.min(Math.abs(altitudeOffset) / 8000, 1.0); // complete transition by 8000 altitude
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);

      // Start color transitions
      // Low: Soft sky light (#bae6fd to #e0f2fe)
      // Mid: Twilight space blue (#1e293b to #475569)
      // High: Deep cosmos gradient (#030712 to #111827)
      let colorTop = '#38bdf8'; // Sky
      let colorBottom = '#bae6fd'; // Light sky

      if (skyFactor > 0.1 && skyFactor <= 0.6) {
        // Twilight blend
        colorTop = '#1e3a8a';
        colorBottom = '#0284c7';
      } else if (skyFactor > 0.6) {
        // Deep Cosmos
        colorTop = '#090514';
        colorBottom = '#1e113a';
      }

      skyGrad.addColorStop(0, colorTop);
      skyGrad.addColorStop(1, colorBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw faint stars if climbing high in the space stage
      if (skyFactor > 0.4) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 40; i++) {
          const starX = (Math.sin(i * 314.15) * 0.5 + 0.5) * CANVAS_WIDTH;
          // Offset star drawing using parallax scroll offset
          const starY = (((Math.cos(i * 721.43) * 0.5 + 0.5) * CANVAS_HEIGHT * 3.5) - (cameraY * 0.12)) % CANVAS_HEIGHT;
          const r = Math.random() < 0.15 ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.arc(starX, starY, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw horizontal atmospheric clouds in low altitude
      if (skyFactor < 0.6) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let i = 0; i < 4; i++) {
          const cloudY = (i * 240 - (cameraY * 0.25)) % (CANVAS_HEIGHT + 200) - 100;
          const cloudX = (Math.sin(i + 1.2) * 50) + 120 * i;
          ctx.beginPath();
          ctx.arc(cloudX, cloudY, 35, 0, Math.PI * 2);
          ctx.arc(cloudX + 30, cloudY - 10, 25, 0, Math.PI * 2);
          ctx.arc(cloudX - 25, cloudY + 5, 20, 0, Math.PI * 2);
          ctx.arc(cloudX + 55, cloudY + 5, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Platforms
      platforms.forEach((p) => {
        const renderY = p.y - cameraY;
        if (renderY < -50 || renderY > CANVAS_HEIGHT + 50) return;

        ctx.save();
        if (p.type === 'spring') {
          // Render highly tactile yellow spring coils
          ctx.fillStyle = '#eab308';
          ctx.strokeStyle = '#cab014';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(p.x, renderY + 8, p.width, 6, 3);
          ctx.fill();
          ctx.stroke();

          // Coil wire frame
          ctx.strokeStyle = '#854d0e';
          ctx.beginPath();
          ctx.moveTo(p.x + 4, renderY + 8);
          ctx.lineTo(p.x + p.width - 4, renderY + 1);
          ctx.lineTo(p.x + 8, renderY - 4);
          ctx.lineTo(p.x + p.width - 8, renderY - 8);
          ctx.stroke();
        } else {
          // Smooth custom rounded corners
          let gradient = ctx.createLinearGradient(p.x, renderY, p.x, renderY + p.height);

          switch (p.type) {
            case 'breakable':
              ctx.globalAlpha = p.breakProgress !== undefined ? p.breakProgress : 1;
              gradient.addColorStop(0, '#f97316');
              gradient.addColorStop(1, '#9a3412');
              ctx.strokeStyle = '#431407';
              break;
            case 'moving':
              gradient.addColorStop(0, '#a855f7');
              gradient.addColorStop(1, '#6b21a8');
              ctx.strokeStyle = '#3b0764';
              break;
            case 'disappearing':
              {
                const isSolid = p.disappearProgress !== undefined && p.disappearProgress >= 0.4;
                ctx.globalAlpha = p.disappearProgress !== undefined ? Math.max(0.18, p.disappearProgress) : 1;
                if (isSolid) {
                  // Active jump-on state: Light neon glowing cyan and sky blue
                  gradient.addColorStop(0, '#06b6d4');
                  gradient.addColorStop(1, '#0891b2');
                  ctx.strokeStyle = '#22d3ee';
                  ctx.shadowColor = '#06b6d4';
                  ctx.shadowBlur = 8;
                } else {
                  // Faded state: Ghost slate background with glowing warning-red dashed boundary to clearly indicate non-solid phase
                  gradient.addColorStop(0, 'rgba(30, 41, 59, 0.4)');
                  gradient.addColorStop(1, 'rgba(15, 23, 42, 0.4)');
                  ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
                  ctx.setLineDash([4, 4]); // Dashed line to show it's intangible
                  ctx.shadowColor = 'rgba(239, 68, 68, 0.3)';
                  ctx.shadowBlur = 4;
                }
              }
              break;
            case 'normal':
            default:
              gradient.addColorStop(0, '#22c55e');
              gradient.addColorStop(1, '#15803d');
              ctx.strokeStyle = '#052e16';
              break;
          }

          ctx.fillStyle = gradient;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(p.x, renderY, p.width, p.height, 6);
          ctx.fill();
          ctx.stroke();

          // Draw platform cracks on breakable ones to make them stand out
          if (p.type === 'breakable') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + 15, renderY);
            ctx.lineTo(p.x + 25, renderY + 8);
            ctx.lineTo(p.x + p.width - 32, renderY + 3);
            ctx.lineTo(p.x + p.width - 20, renderY + p.height);
            ctx.stroke();
          }
        }
        ctx.restore();
      });

      // Draw Coins (Stars spinning and glowing)
      coins.forEach((c) => {
        const renderY = c.y - cameraY;
        const bounce = Math.sin(Date.now() * 0.005 + c.pulseOffset) * 3;

        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;

        // Draw elegant spinning star/coin shape
        ctx.beginPath();
        const spinWidth = c.radius * (0.4 + Math.abs(Math.sin(Date.now() * 0.003)));
        ctx.ellipse(c.x, renderY + bounce, spinWidth, c.radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner core star detail
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(c.x - 1, renderY + bounce - 1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Power-ups
      powerUps.forEach((pw) => {
        const renderY = pw.y - cameraY;
        ctx.save();

        if (pw.type === 'shield') {
          // Radiant teal shield capsule
          ctx.strokeStyle = '#06b6d4';
          ctx.fillStyle = '#cbd5e1';
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;

          // Glass circular container
          ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
          ctx.beginPath();
          ctx.arc(pw.x + pw.width / 2, renderY + pw.height / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw shield symbol
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          const cx = pw.x + pw.width / 2;
          const cy = renderY + pw.height / 2;
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx + 6, cy - 5);
          ctx.lineTo(cx + 5, cy + 2);
          ctx.lineTo(cx, cy + 8);
          ctx.lineTo(cx - 5, cy + 2);
          ctx.lineTo(cx - 6, cy - 5);
          ctx.closePath();
          ctx.fill();
        } else {
          // Orange spacesuit Rocket
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 10;

          const cx = pw.x + pw.width / 2;
          const cy = renderY + pw.height / 2;

          // Rocket Body
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 7, 13, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rocket nose nose
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 3);
          ctx.quadraticCurveTo(cx, cy - 18, cx + 7, cy - 3);
          ctx.closePath();
          ctx.fill();

          // Rocket wings
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy + 5);
          ctx.lineTo(cx - 12, cy + 12);
          ctx.lineTo(cx - 7, cy + 10);
          ctx.moveTo(cx + 7, cy + 5);
          ctx.lineTo(cx + 12, cy + 12);
          ctx.lineTo(cx + 7, cy + 10);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      // Draw Obstacles / Flying Monsters
      enemies.forEach((enemy) => {
        if (enemy.destroyed) return;
        const renderY = enemy.y - cameraY;

        ctx.save();
        if (enemy.type === 'floater') {
          // Bouncing blob monster
          ctx.fillStyle = '#ec4899';
          ctx.strokeStyle = '#9d174d';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = 8;

          ctx.beginPath();
          const squish = Math.sin(Date.now() * 0.01) * 3;
          ctx.ellipse(enemy.x + enemy.width / 2, renderY + enemy.height / 2, enemy.width / 2 + squish, enemy.height / 2 - squish, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Angry glowing eyes
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(enemy.x + enemy.width / 2 - 6, renderY + enemy.height / 2 - 2, 4, 0, Math.PI * 2);
          ctx.arc(enemy.x + enemy.width / 2 + 6, renderY + enemy.height / 2 - 2, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(enemy.x + enemy.width / 2 - 5, renderY + enemy.height / 2 - 2, 1.8, 0, Math.PI * 2);
          ctx.arc(enemy.x + enemy.width / 2 + 7, renderY + enemy.height / 2 - 2, 1.8, 0, Math.PI * 2);
          ctx.fill();

          // Little horns
          ctx.fillStyle = '#be185d';
          ctx.beginPath();
          ctx.moveTo(enemy.x + 4, renderY + 2);
          ctx.lineTo(enemy.x + 8, renderY - 4);
          ctx.lineTo(enemy.x + 12, renderY + 3);
          ctx.moveTo(enemy.x + enemy.width - 4, renderY + 2);
          ctx.lineTo(enemy.x + enemy.width - 8, renderY - 4);
          ctx.lineTo(enemy.x + enemy.width - 12, renderY + 3);
          ctx.fill();
        } else {
          // Cosmic Black Hole Void hazard
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#6366f1';
          ctx.shadowBlur = 12;

          // Whirling shape
          const rotAngle = (Date.now() * 0.004) % (Math.PI * 2);
          ctx.translate(enemy.x + enemy.width / 2, renderY + enemy.height / 2);
          ctx.rotate(rotAngle);

          ctx.beginPath();
          ctx.arc(0, 0, enemy.width / 2 - 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Spiral arms details
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 1.2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 5, Math.PI, Math.PI * 2.2);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Draw Particles
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw 1000m Physics Goal Platform & Decoration
      const goalYVal = -4920;
      const renderGoalY = goalYVal - cameraY;

      if (renderGoalY > -200 && renderGoalY < CANVAS_HEIGHT + 200) {
        ctx.save();
        
        // 1. Draw glowing background or aura for the goal
        const auraGrad = ctx.createRadialGradient(
          CANVAS_WIDTH / 2, renderGoalY + 15, 10,
          CANVAS_WIDTH / 2, renderGoalY + 15, 180
        );
        auraGrad.addColorStop(0, 'rgba(234, 179, 8, 0.25)'); // Yellow/Amber glow
        auraGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.1)'); // Orange glow
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH / 2, renderGoalY + 15, 180, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw Golden Goal Platform Structure
        const platformWidth = 360;
        const platformX = (CANVAS_WIDTH - platformWidth) / 2; // 20
        const platformHeight = 30;

        const goldGrad = ctx.createLinearGradient(platformX, renderGoalY, platformX, renderGoalY + platformHeight);
        goldGrad.addColorStop(0, '#fef08a'); // Bright gold yellow
        goldGrad.addColorStop(0.3, '#facc15'); // Gold
        goldGrad.addColorStop(0.7, '#ca8a04'); // Darker gold
        goldGrad.addColorStop(1, '#854d0e');   // Shadow gold
        
        ctx.fillStyle = goldGrad;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.roundRect(platformX, renderGoalY, platformWidth, platformHeight, 10);
        ctx.fill();
        ctx.stroke();

        // Draw shining highlights on the platform
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(platformX + 15, renderGoalY + 5);
        ctx.lineTo(platformX + platformWidth - 15, renderGoalY + 5);
        ctx.stroke();

        // 3. Draw "GOAL" Glowing Text or Banner
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.font = '900 18px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏆 SPACE END - GOAL 🏆', CANVAS_WIDTH / 2, renderGoalY - 45);

        // Subtext
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#eab308';
        ctx.fillText('TOUCH TO CLEAR! (1000m)', CANVAS_WIDTH / 2, renderGoalY - 20);

        // 4. Draw Columns/Pillars on each side of the platform for a gateway feel
        ctx.fillStyle = goldGrad;
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        
        // Left pillar
        ctx.beginPath();
        ctx.roundRect(platformX + 5, renderGoalY - 50, 15, 50, 4);
        ctx.fill();
        ctx.stroke();
        // Left pillar light
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(platformX + 12.5, renderGoalY - 55, 6, 0, Math.PI * 2);
        ctx.fill();

        // Right pillar
        ctx.fillStyle = goldGrad;
        ctx.beginPath();
        ctx.roundRect(platformX + platformWidth - 20, renderGoalY - 50, 15, 50, 4);
        ctx.fill();
        ctx.stroke();
        // Right pillar light
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(platformX + platformWidth - 12.5, renderGoalY - 55, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Draw Player Jumper
      ctx.save();
      const pRenderY = player.y - cameraY;

      // Draw Glowing Shield Barrier Halo
      if (player.activePowerup === 'shield') {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, pRenderY + player.height / 2, 27, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Rocket Propulsion Pack attached to player's back
      if (player.activePowerup === 'rocket') {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        const rx = player.facingLeft ? player.x + player.width - 4 : player.x - 6;
        ctx.roundRect(rx, pRenderY + 8, 10, 22, 4);
        ctx.fill();
      }

      // Draw skin custom characters dynamically on canvas
      const px = player.x;
      const py = pRenderY;
      const w = player.width;
      const h = player.height;
      const cx = px + w / 2;
      const cy = py + h / 2;

      // Add bounce squatting deformation based on velocity
      const squishX = Math.max(0.82, Math.min(1.18, 1 + player.vy * 0.015));
      const squishY = Math.max(0.82, Math.min(1.18, 1 - player.vy * 0.015));

      ctx.translate(cx, cy);
      ctx.scale(squishX, squishY);

      if (player.skinId === 'blue') {
        // Celestial Star Explorer
        // Body
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Goggles
        ctx.fillStyle = '#bae6fd';
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const visorDir = player.facingLeft ? -4 : 4;
        ctx.roundRect(visorDir - 10, -5, 20, 10, 4);
        ctx.fill();
        ctx.stroke();

        // Yellow backpack boots
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(-10, w / 2 - 3, 5, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(10, w / 2 - 3, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (player.skinId === 'green') {
        // Hyper Cyber Alien Slime
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;

        // Slime body shape with flat bottom
        ctx.beginPath();
        ctx.moveTo(-w / 2, w / 2);
        ctx.quadraticCurveTo(-w / 2, -w / 2, 0, -w / 2 - 2);
        ctx.quadraticCurveTo(w / 2, -w / 2, w / 2, w / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Single giant express alien eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(player.facingLeft ? -4 : 4, -4, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.arc(player.facingLeft ? -5 : 5, -4, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Little antenna
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -w / 2);
        ctx.lineTo(player.facingLeft ? -5 : 5, -w / 2 - 8);
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(player.facingLeft ? -5 : 5, -w / 2 - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (player.skinId === 'red') {
        // Fire Mech Droid
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 2;

        // Structured square/round helmet
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.stroke();

        // Horizontal glowing mono visor
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 6;
        ctx.fillRect(-w / 2 + 3, -4, w - 6, 5);
        ctx.shadowBlur = 0; // reset

        // Red head antenna spikes
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(-10, -h / 2);
        ctx.lineTo(-10, -h / 2 - 6);
        ctx.lineTo(-6, -h / 2);
        ctx.moveTo(10, -h / 2);
        ctx.lineTo(10, -h / 2 - 6);
        ctx.lineTo(6, -h / 2);
        ctx.fill();
      } else if (player.skinId === 'purple') {
        // Void Space Wanderer
        ctx.fillStyle = '#7c3aed';
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 2;

        // Mysterious hooded wrap
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing white cat ears or wizard shape spikes
        ctx.fillStyle = '#4c1d95';
        ctx.beginPath();
        ctx.moveTo(-12, -h / 2 + 5);
        ctx.lineTo(-18, -h / 2 - 6);
        ctx.lineTo(-4, -h / 2 + 2);
        ctx.moveTo(12, -h / 2 + 5);
        ctx.lineTo(18, -h / 2 - 6);
        ctx.lineTo(4, -h / 2 + 2);
        ctx.fill();

        // Two cute yellow/golden glowing star eyes inside hood
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        const faceOfs = player.facingLeft ? -4 : 4;
        ctx.beginPath();
        ctx.arc(faceOfs - 5, -2, 3, 0, Math.PI * 2);
        ctx.arc(faceOfs + 5, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (player.skinId === 'gold') {
        // Royal Crown Jumper
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Elegant King Crown
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(-12, -h / 2 + 2);
        ctx.lineTo(-12, -h / 2 - 8);
        ctx.lineTo(-5, -h / 2 + 1);
        ctx.lineTo(0, -h / 2 - 12);
        ctx.lineTo(5, -h / 2 + 1);
        ctx.lineTo(12, -h / 2 - 8);
        ctx.lineTo(12, -h / 2 + 2);
        ctx.closePath();
        ctx.fill();

        // Blue emerald diamond on central crown crown peak
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -h / 2 - 12, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Elite smart spectacles
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        const specX = player.facingLeft ? -3 : 3;
        ctx.beginPath();
        ctx.arc(specX - 6, -2, 4, 0, Math.PI * 2);
        ctx.arc(specX + 4, -2, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(specX - 5, -2, 1.2, 0, Math.PI * 2);
        ctx.arc(specX + 5, -2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Next frame
      animationId = requestAnimationFrame(update);
    };

    const cleanupEvents = () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (canvas) {
        canvas.removeEventListener('mousedown', handleCanvasClick);
        canvas.removeEventListener('touchstart', handleCanvasClick);
      }
    };

    // Initialize Game Logic Run
    if (!initialized) {
      generateInitialWorld();
      initialized = true;
    }

    // Start Animation Loop
    animationId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationId);
      cleanupEvents();
    };
  }, [skinId, isPaused]);

  return (
    <div className="relative mx-auto flex flex-col items-center hud-panel-sleek hud-panel-glow-cyan rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(56,189,248,0.2)] max-w-full touch-none" style={{ width: CANVAS_WIDTH }}>
      {/* Dynamic Theme Banner / In-Game Live HUD */}
      <div className="absolute top-0 inset-x-0 h-14 bg-slate-950/80 [backdrop-filter:blur(8px)] flex items-center justify-center px-5 text-white border-b border-cyan-500/10 select-none z-10 font-mono">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ALTITUDE</span>
          <span className="text-base font-extrabold font-mono text-cyan-300">
            {hudAltitude}m
          </span>
        </div>
      </div>

      {/* Active Booster Active Timer HUD Overlay */}
      {activePowerup && (
        <div className="absolute top-16 left-4 right-4 z-10 bg-slate-900/90 border border-cyan-500/30 rounded-xl p-2 flex items-center gap-3 animate-pulse">
          {activePowerup === 'rocket' ? (
            <Zap className="w-5 h-5 text-orange-400 shrink-0" />
          ) : (
            <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-bold text-white mb-1">
              <span>{activePowerup === 'rocket' ? 'SUPER ROCKET!' : 'SHIELD DEFENSE ACTIVE'}</span>
              <span>{Math.round(powerupTimePct / 10)}s</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  activePowerup === 'rocket' ? 'bg-orange-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${powerupTimePct}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Main HTML5 Canvas Element */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block bg-sky-200"
        id="vertical-jump-game-canvas"
      />

      {/* Screen Instructions Hint (Toggled off in high elevations) */}
      {hudAltitude <= 15 && (
        <div className="absolute bottom-6 bg-slate-900/85 px-4 py-2 rounded-full border border-white/10 pointer-events-none animate-pulse text-[11px] text-slate-200 font-medium text-center">
          【A/D】or【◀/▶】で移動 • 【Space/W/▲/画面タップ】でジャンプ
        </div>
      )}
    </div>
  );
}
