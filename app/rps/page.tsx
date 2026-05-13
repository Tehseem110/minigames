'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';
import styles from './page.module.css';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const CHOICES = [
  { name: 'rock',     emoji: '🪨', label: 'Rock' },
  { name: 'paper',    emoji: '📄', label: 'Paper' },
  { name: 'scissors', emoji: '✂️', label: 'Scissors' },
];

const BEATS: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

type Phase = 'lobby' | 'waiting' | 'countdown' | 'choosing' | 'result' | 'gameover';

export default function RPSPage() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase]       = useState<Phase>('lobby');
  const [name, setName]         = useState('');
  const [code, setCode]         = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError]       = useState('');
  const [myId, setMyId]         = useState('');
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [scores, setScores]           = useState<Record<string, number>>({});
  const [countdown, setCountdown]     = useState(3);
  const [round, setRound]             = useState(1);
  const [maxRounds]                   = useState(5);
  const [myChoice, setMyChoice]       = useState<string | null>(null);
  const [oppChose, setOppChose]       = useState(false);
  const [roundResult, setRoundResult] = useState<{
    choices: Record<string, string>;
    winner: string | null;
    draw: boolean;
  } | null>(null);
  const [winner, setWinner]   = useState<string | null>(null);
  const [draw, setDraw]       = useState(false);

  useEffect(() => {
    const s = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('room_created', ({ roomCode: rc, playerId }) => { setRoomCode(rc); setMyId(playerId); setPhase('waiting'); });
    s.on('player_joined', ({ playerNames: pn }) => setPlayerNames(pn));
    s.on('room_error', ({ message }) => setError(message));
    s.on('game_countdown', ({ count }) => { setPhase('countdown'); setCountdown(count); });
    s.on('game_started', () => {});
    s.on('rps_round_start', ({ round: r }) => {
      setRound(r); setMyChoice(null); setOppChose(false); setRoundResult(null); setPhase('choosing');
    });
    s.on('choice_confirmed', ({ choice }) => setMyChoice(choice));
    s.on('opponent_chose', () => setOppChose(true));
    s.on('rps_round_result', ({ choices, winner: w, scores: sc, playerNames: pn, draw: d }) => {
      setRoundResult({ choices, winner: w, draw: d }); setScores(sc); setPlayerNames(pn); setPhase('result');
    });
    s.on('game_over', ({ scores: sc, winner: w, playerNames: pn, draw: d }) => {
      setScores(sc); setWinner(w); setPlayerNames(pn); setDraw(d); setPhase('gameover');
    });
    s.on('player_left', ({ message }) => { setError(message); setPhase('lobby'); });

    return () => { s.disconnect(); };
  }, []);

  const createRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setError('');
    socketRef.current?.emit('create_room', { game: 'rps', playerName: name.trim() });
  };

  const joinRoom = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter a room code'); return; }
    setError('');
    socketRef.current?.emit('join_room', { roomCode: code.trim().toUpperCase(), playerName: name.trim() });
  };

  const makeChoice = useCallback((choice: string) => {
    if (phase !== 'choosing' || myChoice) return;
    socketRef.current?.emit('rps_choice', { choice });
  }, [phase, myChoice]);

  const myName    = playerNames[myId] ?? name;
  const myScore   = scores[myId] ?? 0;
  const oppId     = Object.keys(playerNames).find(id => id !== myId) ?? '';
  const oppName   = playerNames[oppId] ?? 'Waiting...';
  const oppScore  = scores[oppId] ?? 0;

  // Result emoji helpers
  const myChoiceEmoji  = CHOICES.find(c => c.name === myChoice)?.emoji ?? '';
  const oppChoiceEmoji = roundResult ? CHOICES.find(c => c.name === roundResult.choices[oppId])?.emoji ?? '' : '';

  // ── LOBBY ──────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>← Back</Link>
      <div className={styles.card + ' fade-in'}>
        <div className={styles.gameTitle}>
          <div style={{ fontSize: '3rem' }}>🪨📄✂️</div>
          <h1>Rock Paper Scissors</h1>
          <p>5 rounds of simultaneous RPS against a real opponent!</p>
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
        <h2 style={{ textAlign: 'center' }}>Waiting for opponent…</h2>
        <div className={styles.roomCodeBox}>
          <p>Share this code</p>
          <div className={styles.bigCode}>{roomCode}</div>
          <button className="btn btn-ghost" style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            onClick={() => navigator.clipboard.writeText(roomCode)}>📋 Copy Code</button>
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

  // ── CHOOSING ──────────────────────────────────────────────────────────
  if (phase === 'choosing') return (
    <div className={styles.page}>
      <div className={styles.scorebar}>
        <div className={styles.playerScore}><span className={styles.pname}>{myName}</span><span className="score-badge">{myScore}</span></div>
        <div className={styles.roundInfo}>Round {round}/{maxRounds}</div>
        <div className={styles.playerScore + ' ' + styles.right}><span className="score-badge">{oppScore}</span><span className={styles.pname}>{oppName}</span></div>
      </div>

      <div className={styles.statusRow}>
        <div className={styles.statusChip + (myChoice ? ' ' + styles.chosen : '')}>
          {myChoice ? `✅ You chose ${CHOICES.find(c => c.name === myChoice)?.label}` : '🤔 Make your choice…'}
        </div>
        <div className={styles.statusChip + (oppChose ? ' ' + styles.chosen : '')}>
          {oppChose ? '✅ Opponent chose!' : '⏳ Opponent thinking…'}
        </div>
      </div>

      <div className={styles.choiceGrid}>
        {CHOICES.map(c => (
          <button
            key={c.name}
            id={`choice-${c.name}`}
            className={styles.choiceBtn + (myChoice === c.name ? ' ' + styles.selectedChoice : '')}
            onClick={() => makeChoice(c.name)}
            disabled={!!myChoice}
          >
            <span className={styles.choiceEmoji}>{c.emoji}</span>
            <span className={styles.choiceLabel}>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────
  if (phase === 'result' && roundResult) {
    const iWon = roundResult.winner === myId;
    const isDraw = roundResult.draw;
    return (
      <div className={styles.page}>
        <div className={styles.scorebar}>
          <div className={styles.playerScore}><span className={styles.pname}>{myName}</span><span className="score-badge">{myScore}</span></div>
          <div className={styles.roundInfo}>Round {round}/{maxRounds}</div>
          <div className={styles.playerScore + ' ' + styles.right}><span className="score-badge">{oppScore}</span><span className={styles.pname}>{oppName}</span></div>
        </div>

        <div className={styles.resultCard + ' pop'}>
          <div className={styles.choicesReveal}>
            <div className={styles.reveal}><div className={styles.revealEmoji}>{myChoiceEmoji}</div><div className={styles.revealName}>{myName}</div></div>
            <div className={styles.vsText}>VS</div>
            <div className={styles.reveal}><div className={styles.revealEmoji}>{oppChoiceEmoji}</div><div className={styles.revealName}>{oppName}</div></div>
          </div>
          <div className={styles.roundVerdict + (iWon ? ' ' + styles.win : isDraw ? ' ' + styles.draw : ' ' + styles.lose)}>
            {isDraw ? "🤝 Draw!" : iWon ? "🏆 Round Win!" : "💀 Round Lost"}
          </div>
          <p className={styles.nextNote}>Next round starting…</p>
        </div>
      </div>
    );
  }

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
          <button className="btn btn-primary" onClick={() => { setPhase('lobby'); setScores({}); setRound(1); }} id="play-again-btn">Play Again</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );

  return null;
}
