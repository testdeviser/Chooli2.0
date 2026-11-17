import { LINKS } from '@/lib/animation/config';
import styles from './Community.module.css';

export function Community() {
  return (
    <section aria-labelledby="community-heading" className={styles.section}>
      <div className={styles.copy}>
        <div className={styles.brand}>
          <div className={styles.icon} aria-hidden="true">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M33 11c-5-6-15-4-17 3-2 6 2 10 7 14l8 7a3 3 0 0 0 4 0l9-9M49 20c3-10-9-17-16-9" />
              <path d="m47 23-1 1M6 35h10v22H6zM16 39h7l9 4h6a3 3 0 0 1 0 6H29" />
              <path d="m39 47 10-9c3-3 8-1 5 3L44 51c-2 2-5 3-9 3H16" />
            </svg>
          </div>

          <div>
            <p className={styles.eyebrow}>Purpose-Driven Growth</p>
            <h2 id="community-heading" className={styles.heading}>Business That Gives Back
            </h2>
          </div>
        </div>

        <p className={styles.description}>
          We donate 10% of every monthly retainer to an eligible nonprofit chosen by our client. Because growing a business and doing something good can go hand in hand.
        </p>

        <a className={styles.cta} href={LINKS.givingBack}>
          <span>See How It Works</span>
          <span className={styles.arrow} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 18 18 6M7 6h11v11" />
            </svg>
          </span>
        </a>
      </div>
    </section>
  );
}