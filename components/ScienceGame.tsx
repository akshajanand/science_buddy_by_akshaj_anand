import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';

const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const SPEED = 5;

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
}

const ScienceGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  
  // Game Refs to avoid stale closures in loop
  const playerRef = useRef({ x: 50, y: 200, width: 30, height: 30, dy: 0, grounded: false });
  const obstaclesRef = useRef<{x: number, y: number, w: number, h: number, type: 'BAD'}[]>([]);
  const collectiblesRef = useRef<{x: number, y: number, w: number, h: number, active: boolean}[]>([]);
  const scoreRef = useRef(0);
  const frameRef = useRef(0);

  const resetGame = () => {
    playerRef.current = { x: 50, y: 200, width: 30, height: 30, dy: 0, grounded: false };
    obstaclesRef.current = [];
    collectiblesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setGameState('PLAYING');
  };

  const jump = () => {
    if (gameState === 'PLAYING' && playerRef.current.grounded) {
      playerRef.current.dy = JUMP_FORCE;
      playerRef.current.grounded = false;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      if (gameState !== 'PLAYING') return;

      const player = playerRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Physics
      player.dy += GRAVITY;
      player.y += player.dy;

      // Ground Collision
      if (player.y + player.height > height - 20) {
        player.y = height - 20 - player.height;
        player.dy = 0;
        player.grounded = true;
      } else {
        player.grounded = false;
      }

      // Spawning
      if (Math.random() < 0.015) {
        obstaclesRef.current.push({
          x: width,
          y: height - 50, // Grounded obstacle
          w: 30,
          h: 30,
          type: 'BAD'
        });
      }
      
      if (Math.random() < 0.01) {
          collectiblesRef.current.push({
              x: width,
              y: height - 100 - Math.random() * 50, // Floating atom
              w: 20,
              h: 20,
              active: true
          });
      }

      // Draw Player (A Beaker)
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.roundRect(player.x, player.y, player.width, player.height, 5);
      ctx.fill();
      // Bubbles
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(player.x + 10, player.y + 10, 3, 0, Math.PI * 2);
      ctx.fill();

      // Manage Obstacles
      obstaclesRef.current.forEach((obs, index) => {
        obs.x -= SPEED;
        ctx.fillStyle = '#ef4444'; // Red block
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Label it "Wrong" or simple X
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText('X', obs.x + 8, obs.y + 20);

        // Collision
        if (
          player.x < obs.x + obs.w &&
          player.x + player.width > obs.x &&
          player.y < obs.y + obs.h &&
          player.y + player.height > obs.y
        ) {
          setGameState('GAME_OVER');
        }
      });
      
      // Manage Collectibles (Atoms)
      collectiblesRef.current.forEach((col) => {
          if (!col.active) return;
          col.x -= SPEED;
          
          // Draw Atom
          ctx.beginPath();
          ctx.fillStyle = '#22c55e';
          ctx.arc(col.x + 10, col.y + 10, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Collision
          if (
            player.x < col.x + col.w &&
            player.x + player.width > col.x &&
            player.y < col.y + col.h &&
            player.y + player.height > col.y
          ) {
              col.active = false;
              scoreRef.current += 10;
              setScore(scoreRef.current);
          }
      });

      // Cleanup offscreen
      obstaclesRef.current = obstaclesRef.current.filter(o => o.x > -50);
      collectiblesRef.current = collectiblesRef.current.filter(c => c.x > -50 && c.active);

      // Floor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, height - 20, width, 20);

      animationId = requestAnimationFrame(gameLoop);
    };

    if (gameState === 'PLAYING') {
      animationId = requestAnimationFrame(gameLoop);
    }

    return () => cancelAnimationFrame(animationId);
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' || e.code === 'ArrowUp') {
              jump();
          }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="flex flex-col items-center justify-center h-full glass-panel rounded-2xl p-6 relative overflow-hidden">
      <h2 className="text-3xl font-bold mb-4">Atom Jumper</h2>
      <div className="absolute top-6 right-6 text-2xl font-bold text-yellow-300">
          Score: {score}
      </div>

      <div className="relative border-4 border-white/20 rounded-lg overflow-hidden bg-slate-900/50 backdrop-blur-sm">
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={300}
          className="block"
          onClick={jump}
        />
        
        {gameState === 'START' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <p className="mb-4 text-lg">Jump over errors, collect atoms!</p>
                <button onClick={resetGame} className="glass-button px-8 py-3 rounded-full text-xl font-bold flex items-center gap-2">
                    <Play fill="white" /> Start Game
                </button>
            </div>
        )}

        {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80">
                <p className="text-2xl font-bold mb-2">Game Over!</p>
                <p className="mb-4 text-lg">Final Score: {score}</p>
                <button onClick={resetGame} className="glass-button px-8 py-3 rounded-full text-xl font-bold flex items-center gap-2">
                    <RotateCcw /> Try Again
                </button>
            </div>
        )}
      </div>
      <p className="mt-4 opacity-70">Press SPACE, UP ARROW, or CLICK to jump.</p>
    </div>
  );
};

export default ScienceGame;
