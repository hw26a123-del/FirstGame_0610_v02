/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SkinId, Skin, HighScore } from '../types';
import { Play } from 'lucide-react';

interface LobbyProps {
  skins: Skin[];
  unlockedSkins: SkinId[];
  selectedSkinId: SkinId;
  totalCoins: number;
  highScores: HighScore[];
  muted: boolean;
  onSelectSkin: (id: SkinId) => void;
  onUnlockSkin: (id: SkinId, cost: number) => void;
  onStartGame: () => void;
  onToggleMute: () => void;
  onClearScores: () => void;
}

export default function Lobby(props: LobbyProps) {
  const { onStartGame } = props;

  return (
    <div className="w-full max-w-md mx-auto hud-panel-sleek hud-panel-glow-cyan text-slate-100 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans relative z-10 transition-all duration-300">
      {/* Title Header Hero Banner */}
      <div className="relative bg-gradient-to-b from-sky-950/40 via-slate-950/80 to-slate-950 p-5 pt-8 text-center border-b border-cyan-500/10 select-none overflow-hidden">
        {/* Parallax elements inside Header Card */}
        <div className="absolute top-4 left-6 w-2 h-2 bg-yellow-400 rounded-full opacity-35 animate-ping"></div>
        <div className="absolute top-12 right-8 w-1 h-3 bg-cyan-400 rounded-full opacity-40 transform rotate-12 animate-pulse"></div>
        <div className="absolute top-24 left-10 w-3 h-1 bg-violet-400 rounded-full opacity-35"></div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-3 py-1 bg-cyan-950/50 border border-cyan-400/20 text-[9px] uppercase font-bold tracking-widest text-cyan-300 rounded-full shadow-inner mb-4 font-mono">
            SYSTEM ENGINE SECURE • v1.0.4
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 py-1 drop-shadow-md font-display">
            Jump Climber
          </h1>
        </motion.div>
      </div>

      {/* Main Tab Content view */}
      <div className="p-6 flex-1 min-h-[160px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key="play-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col items-center justify-center py-6 px-2"
          >
            <button
              onClick={onStartGame}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xl py-5 rounded-2xl shadow-xl shadow-teal-950/30 flex items-center justify-center gap-2 transform active:scale-98 hover:scale-102 transition-all cursor-pointer border border-teal-300/20"
              id="btn-play-game"
            >
              <Play className="w-7 h-7 fill-current" />
              Start
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rules overlay footer credit */}
      <div className="bg-slate-950 p-4 border-t border-slate-800 text-center select-none">
        <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase">
          © 2026 VERTICAL JUMP CLIMBER • LOCAL SANDBOX SYSTEM
        </span>
      </div>
    </div>
  );
}
