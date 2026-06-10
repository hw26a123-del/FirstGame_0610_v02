/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, SkinId, Skin, HighScore } from './types';
import Lobby from './components/Lobby';
import GameCanvas from './components/GameCanvas';
import { sound } from './components/SoundManager';
import { Trophy, Award, Landmark, RotateCcw, Home, Skull, ArrowRight, CornerDownLeft, Volume2, VolumeX } from 'lucide-react';

const SKINS_PRESETS: Skin[] = [
  { id: 'blue', name: 'ブルースター (Celestial)', color: '#0284c7', accent: '#0c4a6e', cost: 0 },
  { id: 'green', name: 'サイバースライム (Neon)', color: '#22c55e', accent: '#14532d', cost: 15 },
  { id: 'red', name: 'ファイアメック (Flame)', color: '#ef4444', accent: '#7f1d1d', cost: 30 },
  { id: 'purple', name: 'ヴォイドウォーカー (Void)', color: '#7c3aed', accent: '#4c1d95', cost: 50 },
  { id: 'gold', name: 'キングジャンパー (Crown)', color: '#fbbf24', accent: '#78350f', cost: 100 },
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.Lobby);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Persistence triggers
  const [selectedSkinId, setSelectedSkinId] = useState<SkinId>('blue');
  const [unlockedSkins, setUnlockedSkins] = useState<SkinId[]>(['blue']);
  const [totalCoins, setTotalCoins] = useState<number>(0);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [muted, setMuted] = useState<boolean>(false);

  // Active game indicators
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [currentAltitude, setCurrentAltitude] = useState<number>(0);
  const [currentCoinsCollected, setCurrentCoinsCollected] = useState<number>(0);

  // New highscore name registration state
  const [scoreOwnerName, setScoreOwnerName] = useState<string>('');
  const [highScoreRegistered, setHighScoreRegistered] = useState<boolean>(false);

  // Initial Boot loader
  useEffect(() => {
    // Coins
    const savedCoins = localStorage.getItem('vjc_coins');
    if (savedCoins) setTotalCoins(parseInt(savedCoins, 10));

    // Skins
    const savedSkins = localStorage.getItem('vjc_skins');
    if (savedSkins) {
      try {
        setUnlockedSkins(JSON.parse(savedSkins));
      } catch (e) {
        setUnlockedSkins(['blue']);
      }
    }

    // Active skin
    const savedActiveSkin = localStorage.getItem('vjc_active_skin');
    if (savedActiveSkin) setSelectedSkinId(savedActiveSkin as SkinId);

    // Muted
    const savedMuted = localStorage.getItem('vjc_muted');
    if (savedMuted) {
      const isMuted = savedMuted === 'true';
      setMuted(isMuted);
      sound.setMuted(isMuted);
    }

    // High Scores
    const savedScores = localStorage.getItem('vjc_high_scores');
    if (savedScores) {
      try {
        setHighScores(JSON.parse(savedScores));
      } catch (e) {
        // Fallback default mock leaderboard list to look nice right away
        const defaultScores: HighScore[] = [
          { id: '1', name: 'SkyMaster', score: 12500, altitude: 250, date: '2026/06/01' },
          { id: '2', name: 'GravityDefier', score: 8200, altitude: 164, date: '2026/06/05' },
          { id: '3', name: 'ChippyBot', score: 4500, altitude: 90, date: '2026/06/08' },
        ];
        setHighScores(defaultScores);
      }
    } else {
      // Seed nice values
      const defaultScores: HighScore[] = [
        { id: '1', name: 'SkyMaster', score: 12500, altitude: 250, date: '2026/05/20' },
        { id: '2', name: 'GravityDefier', score: 8200, altitude: 164, date: '2026/06/01' },
        { id: '3', name: 'JumpBot', score: 4500, altitude: 90, date: '2026/06/08' },
      ];
      setHighScores(defaultScores);
      localStorage.setItem('vjc_high_scores', JSON.stringify(defaultScores));
    }
  }, []);

  // Sync mute
  const handleToggleMute = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    sound.setMuted(nextMute);
    localStorage.setItem('vjc_muted', String(nextMute));
  };

  // Selection
  const handleSelectSkin = (id: SkinId) => {
    setSelectedSkinId(id);
    localStorage.setItem('vjc_active_skin', id);
  };

  // Skin Unlock logic
  const handleUnlockSkin = (id: SkinId, cost: number) => {
    if (totalCoins >= cost && !unlockedSkins.includes(id)) {
      const nextCoins = totalCoins - cost;
      const nextSkins = [...unlockedSkins, id];

      setTotalCoins(nextCoins);
      setUnlockedSkins(nextSkins);

      localStorage.setItem('vjc_coins', String(nextCoins));
      localStorage.setItem('vjc_skins', JSON.stringify(nextSkins));

      sound.playPowerUp();
    }
  };

  // Clear Leaderboards
  const handleClearScores = () => {
    if (window.confirm('ハイスコア記録をすべて消去しますか？')) {
      setHighScores([]);
      localStorage.removeItem('vjc_high_scores');
    }
  };

  // Canvas callbacks for updating active stats
  const handleStateChange = (score: number, altitude: number, coins: number) => {
    setCurrentScore(score);
    setCurrentAltitude(altitude);
    setCurrentCoinsCollected(coins);
  };

  // Game Over trigger
  const handleGameOver = (score: number, altitude: number, coinsCollected: number) => {
    setGameState(GameState.GameOver);
    setIsPaused(false);
    setCurrentScore(score);
    setCurrentAltitude(altitude);
    setCurrentCoinsCollected(coinsCollected);

    // Save newly collected coins
    const nextTotalCoins = totalCoins + coinsCollected;
    setTotalCoins(nextTotalCoins);
    localStorage.setItem('vjc_coins', String(nextTotalCoins));

    setHighScoreRegistered(false);
    setScoreOwnerName('');
  };

  // Game Won / Stage Clear trigger
  const handleGameWon = (score: number, altitude: number, coinsCollected: number) => {
    setGameState(GameState.GameWon);
    setIsPaused(false);
    setCurrentScore(score);
    setCurrentAltitude(altitude);
    setCurrentCoinsCollected(coinsCollected);

    // Save newly collected coins
    const nextTotalCoins = totalCoins + coinsCollected;
    setTotalCoins(nextTotalCoins);
    localStorage.setItem('vjc_coins', String(nextTotalCoins));

    setHighScoreRegistered(false);
    setScoreOwnerName('');
  };

  // Start active game run
  const handleStartGame = () => {
    setCurrentScore(0);
    setCurrentAltitude(0);
    setCurrentCoinsCollected(0);
    setIsPaused(false);
    setGameState(GameState.Playing);
  };

  // Submit new highscore
  const handleSaveHighScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreOwnerName.trim()) return;

    sound.playCoin();

    const newRecord: HighScore = {
      id: String(Date.now()),
      name: scoreOwnerName.trim().substring(0, 14),
      score: currentScore,
      altitude: currentAltitude,
      date: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    };

    const nextScores = [...highScores, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Keep top 8 scores

    setHighScores(nextScores);
    localStorage.setItem('vjc_high_scores', JSON.stringify(nextScores));
    setHighScoreRegistered(true);
  };

  // Check if current run is a new top high score
  const isNewHighScore = () => {
    if (currentScore <= 0) return false;
    if (highScores.length < 8) return true;
    return currentScore > highScores[highScores.length - 1].score;
  };

  // Retro Sound helper for selection
  const handleMenuClick = () => {
    sound.playJump();
  };

  return (
    <div className="h-screen max-h-screen bg-slate-950 flex flex-col items-center justify-center p-2 selection:bg-cyan-500/30 selection:text-white relative overflow-hidden">
      
      {/* Sleek Theme Grid */}
      <div className="sleek-grid" />

      {/* Outer Aesthetic Halo Backdrop */}
      <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-900/10 blur-3xl saturate-150 pointer-events-none z-0"></div>
      <div className="fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-900/10 blur-3xl saturate-150 pointer-events-none z-0"></div>

      <main className="w-full relative z-10 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          
          {/* LOBBY STATE */}
          {gameState === GameState.Lobby && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full flex justify-center"
            >
              <Lobby
                skins={SKINS_PRESETS}
                unlockedSkins={unlockedSkins}
                selectedSkinId={selectedSkinId}
                totalCoins={totalCoins}
                highScores={highScores}
                muted={muted}
                onSelectSkin={handleSelectSkin}
                onUnlockSkin={handleUnlockSkin}
                onStartGame={handleStartGame}
                onToggleMute={handleToggleMute}
                onClearScores={handleClearScores}
              />
            </motion.div>
          )}

          {/* ACTIVE PLAYING STATE */}
          {gameState === GameState.Playing && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full relative"
            >
              <GameCanvas
                skinId={selectedSkinId}
                muted={muted}
                onGameOver={handleGameOver}
                onGameWon={handleGameWon}
                onStateChange={handleStateChange}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
              />

              {/* Pause Overlay Layout */}
              <AnimatePresence>
                {isPaused && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 rounded-3xl"
                  >
                    <div className="text-center p-8 bg-slate-900 border-2 border-slate-700/80 rounded-2xl max-w-xs shadow-2xl flex flex-col items-center select-none font-sans">
                      <Trophy className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
                      <h2 className="text-xl font-extrabold text-white uppercase tracking-wider mb-1">一時停止中</h2>
                      <p className="text-[11px] text-slate-400 mb-6">スコア: <strong className="text-white text-xs font-mono">{currentScore.toLocaleString()}</strong></p>

                      <div className="w-full flex flex-col gap-2.5">
                        <button
                          onClick={() => {
                            sound.playJump();
                            setIsPaused(false);
                          }}
                          className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all cursor-pointer"
                        >
                          ゲームに戻る
                        </button>

                        <button
                          onClick={() => {
                            sound.playSpring();
                            handleStartGame();
                          }}
                          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4 text-cyan-400" />
                          最初からやり直す
                        </button>

                        <button
                          onClick={() => {
                            sound.playGameOver();
                            setGameState(GameState.Lobby);
                          }}
                          className="w-full py-3 bg-slate-900 hover:bg-red-950/50 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-900/45 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Home className="w-4 h-4" />
                          ロビーへ戻る
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* GAME OVER STATE */}
          {gameState === GameState.GameOver && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md hud-panel-sleek hud-panel-glow-pink rounded-3xl p-6 shadow-2xl flex flex-col relative z-20"
            >
              {/* Game Over header */}
              <div className="text-center py-4 mb-4 select-none">
                <div className="w-14 h-14 bg-red-950/40 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500 text-2xl animate-spin-slow">
                  💀
                </div>
                <h1 className="text-3xl font-black text-rose-500 tracking-tight">GAME OVER</h1>
                <p className="text-xs text-slate-400 mt-1">足場を踏み外して落ちてしまった！</p>
              </div>

              {/* Stats card */}
              <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 mb-5 text-center flex flex-col items-center justify-center font-sans">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider">到達高度</span>
                  <span className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{currentAltitude}m</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    handleMenuClick();
                    handleStartGame();
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-teal-300/20 shadow-lg shadow-teal-950/30"
                  id="btn-retry"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  もう一度チャレンジ！
                </button>

                <button
                  onClick={() => {
                    handleMenuClick();
                    setGameState(GameState.Lobby);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  id="btn-back-lobby"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  ロビー・キャラクター選択に戻る
                </button>
              </div>
            </motion.div>
          )}

          {/* GAME WON / VICTORY STATE */}
          {gameState === GameState.GameWon && (
            <motion.div
              key="gamewon"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md hud-panel-sleek hud-panel-glow-amber rounded-3xl p-6 shadow-2xl flex flex-col relative z-20"
            >
              {/* Victory Header */}
              <div className="text-center py-4 mb-4 select-none">
                <div className="w-14 h-14 bg-amber-950/40 border border-yellow-500/50 rounded-full mx-auto mb-3 text-yellow-400 text-3xl animate-bounce flex items-center justify-center">
                  👑
                </div>
                <h1 className="text-3xl font-black text-amber-400 tracking-tight">STAGE CLEAR!!</h1>
                <p className="text-xs text-slate-300 mt-1">1000mの宇宙の果てに到達した！</p>
              </div>

              {/* Stats card */}
              <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80 mb-5 text-center flex flex-col items-center justify-center font-sans">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider">到達高度</span>
                  <span className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{currentAltitude}m</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    handleMenuClick();
                    handleStartGame();
                  }}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-yellow-300/20 shadow-lg shadow-yellow-950/30"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  もう一度遊ぶ！
                </button>

                <button
                  onClick={() => {
                    handleMenuClick();
                    setGameState(GameState.Lobby);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  ロビーに戻る
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating global utility controls */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 font-semibold font-mono select-none">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-md">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
          <span>SANDBOX MODE ACTIVE</span>
        </div>
        <button
          onClick={handleToggleMute}
          className="hover:text-slate-300 flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-md cursor-pointer"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 text-red-500" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-500" />}
          {muted ? 'SOUND: OFF' : 'SOUND: ON'}
        </button>
      </div>

    </div>
  );
}
