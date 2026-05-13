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

const PLAYER_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316'];

type Phase = 'lobby' | 'waiting' | 'countdown' | 'choosing' | 'result' | 'gameover';

export default function RPSPage() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase]       = useState<Phase>('lobby');
  const [name, setName]         = useState('');
  const [code, setCode]         = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError]       = useState('');
  const [myId, setMyId]         = useState('');
  const [hostId, setHostId]     = useState('');
  const [players, setPlayers]   = useState<string[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [scores, setScores]           = useState<Record<string, number>>({});
  const [countdown, setCountdown]     = useState(3);
  const [round, setRound]             = useState(1);
  const [maxRounds]                   = useState(5);
  const [myChoice, setMyChoice]       = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [submittedIds, setSubmittedIds]     = useState<string[]>([]);
  const [roundResult, setRoundResult] = useState<{
    choices: Record<string, string>;
    roundPoints: Record<string, number>;
  } | null>(null);
  const [winner, setWinner]   = useState<string | null>(null);
  const [draw, setDraw]       = useState(false);

  useEffect(() => {
    const s = io(BACKEND, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('room_created', ({ roomCode: rc, playerId, hostId: hid }) => {
      setRoomCode(rc); setMyId(playerId); setHostId(hid);
      setPlayers([playerId]);
      setPhase('waiting');
    });
    s.on('player_joined', ({ players: pl, playerNames: pn, hostId: hid }) => {
      setPlayers(pl); setPlayerNames(pn); setHostId(hid);
    });
    s.on('room_error', ({ message }) => setError(message));
    s.on('game_countdown', ({ count }) => { setPhase('countdown'); setCountdown(count); });
    s.on('game_started', () => {});
    s.on('rps_round_start', ({ round: r }) => {
      setRound(r);
      setMyChoice(null);
      setSubmittedCount(0);
      setSubmittedIds([]);
      setRoundResult(null);
      setPhase('choosing');
    });
    s.on('choice_confirmed', ({ choice }) => setMyChoice(choice));
    s.on('rps_submission_update', ({ submittedCount: sc, submittedIds: sids }) => {
      setSubmittedCount(sc);
      setSubmittedIds(sids);
    });
    s.on('rps_round_result', ({ choices, roundPoints, scores: sc, playerNames: pn }) => {
      setRoundResult({ choices, roundPoints });
      setScores(sc);
      setPlayerNames(pn);
      setPhase('result');
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

  const startGame = () => {
    setError('');
    socketRef.current?.emit('start_game');
  };

  const makeChoice = useCallback((choice: string) => {
    if (phase !== 'choosing' || myChoice) return;
    socketRef.current?.emit('rps_choice', { choice });
  }, [phase, myChoice]);

  const isHost = myId === hostId;

  // ── LOBBY ──────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>← Back</Link>
      <div className={styles.card + ' fade-in'}>
        <div className={styles.gameTitle}>
          <div style={{ fontSize: '3rem' }}>🪨📄✂️</div>
          <h1>Rock Paper Scissors</h1>
          <p>2–4 players, all-vs-all! Each round everyone picks simultaneously — beat your opponents to earn points.</p>
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
        <div className={styles.gameTitle}>
          <h2>Lobby</h2>
          <p>{players.length}/4 players joined</p>
        </div>
        <div className={styles.roomCodeBox}>
          <p>Share this code</p>
          <div className={styles.bigCode}>{roomCode}</div>
          <button className="btn btn-ghost" style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            onClick={() => navigator.clipboard.writeText(roomCode)}>📋 Copy Code</button>
        </div>

        {/* Player list */}
        <div className={styles.playerList}>
          {players.map((pid, idx) => (
            <div key={pid} className={styles.playerListItem}>
              <span className={styles.playerDot} style={{ background: PLAYER_COLORS[idx] }} />
              <span>{playerNames[pid] ?? `Player ${idx + 1}`}</span>
              {pid === hostId && <span className={styles.hostBadge}>HOST</span>}
            </div>
          ))}
          {Array.from({ length: 4 - players.length }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.playerListItem + ' ' + styles.emptySlot}>
              <span className={styles.playerDot} style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span>Waiting for player…</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            className="btn btn-primary"
            id="start-btn"
            onClick={startGame}
            disabled={players.length < 2}
            style={{ opacity: players.length < 2 ? 0.4 : 1 }}
          >
            {players.length < 2 ? 'Need 1 more player…' : `Start Game (${players.length}P)`}
          </button>
        ) : (
          <div style={{ textAlign: 'center', color: 'rgba(240,240,255,0.4)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <div className={styles.spinner} style={{ width: 20, height: 20, borderWidth: 2 }} />
            Waiting for host to start…
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
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
      {/* Scorebar */}
      <div className={styles.scorebar}>
        <div className={styles.roundInfo}>Round {round}/{maxRounds}</div>
        <div className={styles.allScores}>
          {players.map((pid, idx) => (
            <div key={pid} className={styles.playerScore + (pid === myId ? ' ' + styles.myScore : '')}>
              <span className={styles.playerDot} style={{ background: PLAYER_COLORS[idx] }} />
              <span className={styles.pname}>{playerNames[pid] ?? `P${idx+1}`}</span>
              <span className="score-badge" style={{ background: PLAYER_COLORS[idx] + '33', color: PLAYER_COLORS[idx] }}>
                {scores[pid] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Submission status */}
      <div className={styles.submissionBar}>
        {players.map((pid, idx) => {
          const submitted = submittedIds.includes(pid);
          return (
            <div key={pid} className={styles.submissionChip + (submitted ? ' ' + styles.chipDone : '')}>
              <span style={{ color: PLAYER_COLORS[idx], marginRight: 6 }}>●</span>
              <span>{playerNames[pid] ?? `P${idx+1}`}</span>
              <span className={styles.chipStatus}>{submitted ? '✅' : '⏳'}</span>
            </div>
          );
        })}
      </div>

      <p className={styles.waitingNote}>
        {submittedCount}/{players.length} submitted — waiting for all players…
      </p>

      {/* Choice buttons */}
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
    return (
      <div className={styles.page}>
        {/* Scorebar */}
        <div className={styles.scorebar}>
          <div className={styles.roundInfo}>Round {round}/{maxRounds}</div>
          <div className={styles.allScores}>
            {players.map((pid, idx) => (
              <div key={pid} className={styles.playerScore + (pid === myId ? ' ' + styles.myScore : '')}>
                <span className={styles.playerDot} style={{ background: PLAYER_COLORS[idx] }} />
                <span className={styles.pname}>{playerNames[pid] ?? `P${idx+1}`}</span>
                <span className="score-badge" style={{ background: PLAYER_COLORS[idx] + '33', color: PLAYER_COLORS[idx] }}>
                  {scores[pid] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Round result table */}
        <div className={styles.resultCard + ' pop'}>
          <div className={styles.resultTitle}>Round {round} Results</div>
          <div className={styles.resultTable}>
            {players.map((pid, idx) => {
              const choiceName = roundResult.choices[pid];
              const emoji = CHOICES.find(c => c.name === choiceName)?.emoji ?? '?';
              const pts = roundResult.roundPoints[pid] ?? 0;
              const isMe = pid === myId;
              return (
                <div key={pid} className={styles.resultRow + (isMe ? ' ' + styles.resultRowMe : '')}>
                  <div className={styles.resultPlayer}>
                    <span className={styles.playerDot} style={{ background: PLAYER_COLORS[idx] }} />
                    <span className={styles.resultName}>{playerNames[pid] ?? `P${idx+1}`}</span>
                    {isMe && <span className={styles.youTag}>YOU</span>}
                  </div>
                  <span className={styles.resultEmoji}>{emoji}</span>
                  <span className={styles.resultPts + (pts > 0 ? ' ' + styles.ptsWin : '')}>
                    {pts > 0 ? `+${pts}` : '—'}
                  </span>
                </div>
              );
            })}
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
          {draw ? "🤝 It's a Draw!" : winner === myId ? '🏆 You Win!' : `🏆 ${playerNames[winner!] ?? 'Someone'} Wins!`}
        </div>
        <div className={styles.finalScores}>
          {Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([id, sc], idx) => (
              <div key={id} className={styles.finalRow + (id === winner ? ' ' + styles.winnerRow : '')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4️⃣'}
                  </span>
                  <span>{playerNames[id]}</span>
                  {id === myId && <span className={styles.youTag}>YOU</span>}
                </div>
                <span className={styles.finalScore}>{sc}</span>
              </div>
            ))}
        </div>
        <div className={styles.row} style={{ gap: 12 }}>
          <button className="btn btn-primary" onClick={() => { setPhase('lobby'); setScores({}); setRound(1); setPlayers([]); }} id="play-again-btn">Play Again</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );

  return null;
}
