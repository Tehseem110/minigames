import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.badge}>🎮 Real-time Multiplayer</div>
        <h1 className={styles.title}>
          Mini<span className={styles.accent}>Games</span>
        </h1>
        <p className={styles.subtitle}>
          Challenge your friends in lightning-fast multiplayer games. Create a room, share the code, and let the battle begin!
        </p>
      </div>

      <div className={styles.grid}>
        {/* Color Reaction Duel */}
        <Link href="/color-duel" className={styles.gameCard}>
          <div className={styles.gameIcon}>
            <div className={styles.colorDots}>
              <span style={{ background: '#ef4444' }} />
              <span style={{ background: '#3b82f6' }} />
              <span style={{ background: '#22c55e' }} />
              <span style={{ background: '#eab308' }} />
              <span style={{ background: '#a855f7' }} />
              <span style={{ background: '#f97316' }} />
            </div>
          </div>
          <div className={styles.gameInfo}>
            <h2>Color Reaction</h2>
            <p>A color flashes on screen — smash the matching button before your opponents do! Wrong click = penalty. Lightning reflexes win.</p>
            <div className={styles.gameTags}>
              <span>⚡ Reflex</span>
              <span>🎯 5 Rounds</span>
              <span>👥 2–4 Players</span>
            </div>
          </div>
          <div className={styles.playBtn}>Play Now →</div>
        </Link>

        {/* Rock Paper Scissors */}
        <Link href="/rps" className={styles.gameCard}>
          <div className={styles.gameIcon} style={{ fontSize: '4rem' }}>🪨📄✂️</div>
          <div className={styles.gameInfo}>
            <h2>Rock Paper Scissors</h2>
            <p>All-vs-all RPS! Every player picks simultaneously — beat more opponents to earn more points. Outthink, outplay, outlast.</p>
            <div className={styles.gameTags}>
              <span>🧠 Strategy</span>
              <span>🎯 5 Rounds</span>
              <span>👥 2–4 Players</span>
            </div>
          </div>
          <div className={styles.playBtn}>Play Now →</div>
        </Link>
      </div>

      <p className={styles.footer}>Built with Next.js + Socket.io • Real-time WebSocket Multiplayer</p>
    </div>
  );
}
