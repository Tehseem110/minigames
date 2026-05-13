'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';
import styles from './page.module.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const COLORS = [
  { name: 'red',    display: 'RED',    hex: '#ef4444' },
  { name: 'blue',   display: 'BLUE',   hex: '#3b82f6' },
  { name: 'green',  display: 'GREEN',  hex: '#22c55e' },
  { name: 'yellow', display: 'YELLOW', hex: '#eab308' },
  { name: 'purple', display: 'PURPLE', hex: '#a855f7' },
  { name: 'orange', display: 'ORANGE', hex: '#f97316' },
];

type Phase = 'lobby' | 'waiting' | 'countdown' | 'ready' | 'active' | 'result' | 'gameover';

export default function ColorDuelPage() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [name, setName]   = useState('');
  const [code, setCode]   = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [scores, setScores]           = useState<Record<string, number>>({});
  const [myId, setMyId]               = useState('');
  const [countdown, setCountdown]     = useState(3);
  const [currentColor, setCurrentColor] = useState<{ name: string; display: string; hex: string } | null>(null);
  const [round, setRound]             = useState(0);
  const [maxRounds]                   = useState(5);
  const [roundResult, setRoundResult] = useState<{ winner: string; color: { hex: string; display: string } } | null>(null);
  const [winner, setWinner]           = useState<string | null>(null);
  const [draw, setDraw]               = useState(false);
  const [wrongFlash, setWrongFlash]   = useState(false);

  useEffect(() => {
    const s = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('room_created', ({ roomCode: rc, playerId }) => {
      setRoomCode(rc); setMyId(playerId); setPhase('waiting');
    });
    s.on('player_joined', ({ playerNames: pn }) => { setPlayerNames(pn); });
    s.on('room_error', ({ message }) => setError(message));
    s.on('game_countdown', ({ count }) => { setPhase('countdown'); setCountdown(count); });
    s.on('game_started', () => setPhase('ready'));
    s.on('color_round_ready', ({ round: r }) => { setRound(r); setCurrentColor(null); setRoundResult(null); setPhase('ready'); });
    s.on('color_shown', ({ color, round: r }) => { setRound(r); setCurrentColor(color); setPhase('active'); });
    s.on('color_round_result', ({ winner: w, color: c, scores: sc, playerNames: pn }) => {
      setRoundResult({ winner: w, color: c }); setScores(sc); setPlayerNames(pn); setPhase('result');
    });
    s.on('score_update', ({ scores: sc }) => setScores(sc));
    s.on('wrong_color', () => { setWrongFlash(true); setTimeout(() => setWrongFlash(false), 400); });
    s.on('too_late', () => setError('Too slow! Round already claimed.'));
    s.on('game_over', ({ scores: sc, winner: w, playerNames: pn, draw: d }) => {
      setScores(sc); setWinner(w); setPlayerNames(pn); setDraw(d); setPhase('gameover');
    });
    s.on('player_left', ({ message }) => { setError(message); setPhase('lobby'); });

    return () => { s.disconnect(); };
  }, []);

  const createRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setError('');
    socketRef.current?.emit('create_room', { game: 'color-duel', playerName: name.trim() });
  };

  const joinRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter a room code'); return; }
    setError('');
    socketRef.current?.emit('join_room', { roomCode: code.trim().toUpperCase(), playerName: name.trim() });
  };

  const clickColor = useCallback((colorName: string) => {
    if (phase !== 'active') return;
    socketRef.current?.emit('color_click', { color: colorName });
  }, [phase]);

  const opponentName = Object.entries(playerNames).find(([id]) => id !== myId)?.[1] ?? 'Waiting...';
  const myName       = playerNames[myId] ?? name;
  const myScore      = scores[myId] ?? 0;
  const oppId        = Object.keys(playerNames).find(id => id !== myId) ?? '';
  const oppScore     = scores[oppId] ?? 0;

  // ── LOBBY ──────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>← Back</Link>
      <div className={styles.card + ' fade-in'}>
        <div className={styles.gameTitle}>
          <div className={styles.miniDots}>
            {COLORS.map(c => <span key={c.name} style={{ background: c.hex }} />)}
          </div>
          <h1>Color Reaction Duel</h1>
          <p>Hit the matching color button faster than your opponent!</p>
        </div>
        <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} maxLength={16} id="name-input" />
        <div className={styles.row}>
          <button className="btn btn-primary" onClick={createRoom} id="create-btn">Create Room</button>
        </div>
        <div className={styles.divider}><span>or join existing</span></div>
        <div className={styles.joinRow}>
          <input type="text" placeholder="Room code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} id="code-input" style={{ textTransform: 'uppercase', letterSpacing: '3px' }} />
          <button className="btn btn-ghost" onClick={joinRoom} id="join-btn">Join</button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );

  // ── WAITING ────────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <div className={styles.page}>
      <div className={styles.card + ' fade-in'}>
        <h2>Waiting for opponent…</h2>
        <div className={styles.roomCodeBox}>
          <p>Share this code</p>
          <div className={styles.bigCode}>{roomCode}</div>
          <button className="btn btn-ghost" style={{ fontSize:'0.85rem', padding:'8px 16px' }}
            onClick={() => navigator.clipboard.writeText(roomCode)}>
            📋 Copy Code
          </button>
        </div>
        <div className={styles.spinner} />
      </div>
    </div>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <div className={styles.page}>
      <div className={styles.centeredBig + ' pop'} style={{ color: '#a855f7' }}>{countdown}</div>
      <p style={{ color: 'rgba(240,240,255,0.5)', marginTop: 16 }}>Get Ready!</p>
    </div>
  );

  // ── GAME (ready / active / result) ────────────────────────────────────
  if (['ready', 'active', 'result'].includes(phase)) return (
    <div className={styles.page}>
      {/* Score bar */}
      <div className={styles.scorebar}>
        <div className={styles.playerScore}>
          <span className={styles.pname}>{myName}</span>
          <span className="score-badge">{myScore}</span>
        </div>
        <div className={styles.roundInfo}>Round {round}/{maxRounds}</div>
        <div className={styles.playerScore + ' ' + styles.right}>
          <span className="score-badge">{oppScore}</span>
          <span className={styles.pname}>{opponentName}</span>
        </div>
      </div>

      {/* Color display zone */}
      <div className={styles.colorZone}>
        {phase === 'ready' && (
          <div className={styles.readyText}>
            <div className={styles.spinner} />
            <p>Get ready…</p>
          </div>
        )}
        {phase === 'active' && currentColor && (
          <div className={styles.colorWord + ' pop'} style={{ color: currentColor.hex, textShadow: `0 0 40px ${currentColor.hex}88` }}>
            {currentColor.display}
          </div>
        )}
        {phase === 'result' && roundResult && (
          <div className={styles.roundResult + ' pop'}>
            {roundResult.winner === myId ? '🏆 You got it!' : `❌ ${playerNames[roundResult.winner] ?? 'Opponent'} was faster`}
          </div>
        )}
      </div>

      {/* Color buttons */}
      <div className={styles.colorGrid + (wrongFlash ? ' shake' : '')}>
        {COLORS.map(c => (
          <button
            key={c.name}
            id={`color-${c.name}`}
            className={styles.colorBtn}
            style={{ background: c.hex, boxShadow: phase === 'active' ? `0 0 24px ${c.hex}66` : 'none' }}
            onClick={() => clickColor(c.name)}
            disabled={phase !== 'active'}
          >
            {c.display}
          </button>
        ))}
      </div>

      {error && <p className={styles.error} style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );

  // ── GAME OVER ──────────────────────────────────────────────────────────
  if (phase === 'gameover') return (
    <div className={styles.page}>
      <div className={styles.card + ' fade-in'}>
        <div className={styles.gameoverTitle}>
          {draw ? '🤝 Draw!' : winner === myId ? '🏆 You Win!' : '💀 You Lost'}
        </div>
        <div className={styles.finalScores}>
          {Object.entries(scores).map(([id, sc]) => (
            <div key={id} className={styles.finalRow + (id === winner ? ' ' + styles.winnerRow : '')}>
              <span>{playerNames[id]}</span>
              <span className={styles.finalScore}>{sc}</span>
            </div>
          ))}
        </div>
        <div className={styles.row} style={{ gap: 12 }}>
          <button className="btn btn-primary" onClick={() => { setPhase('lobby'); setScores({}); setRound(0); }} id="play-again-btn">Play Again</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );

  return null;
}
