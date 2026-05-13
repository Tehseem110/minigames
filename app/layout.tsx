import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MiniGames – Multiplayer Party Games',
  description: 'Play real-time multiplayer mini-games: Color Reaction Duel and Rock Paper Scissors with friends!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
