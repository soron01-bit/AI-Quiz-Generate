import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>AI Study Assistant</h1>
        <p>Turn your PDFs into interactive quizzes and summaries using AI.</p>
      </header>
      
      <div className={styles.ctaContainer}>
        <Link href="/auth/login" className={styles.btn}>Login</Link>
        <Link href="/auth/register" className={styles.btnSecondary}>Sign Up</Link>
      </div>
    </main>
  );
}
