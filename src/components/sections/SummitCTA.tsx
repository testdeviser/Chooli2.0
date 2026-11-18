import { LINKS } from '@/lib/animation/config';
import styles from './SummitCTA.module.css';

export function SummitCTA() {
  return (
    <section aria-labelledby="summit-cta-heading" className={styles.section}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Summit Your Market</p>

        <h2 id="summit-cta-heading" className={styles.heading}>
          Ready To Climb Higher
          <br />
          Together?
        </h2>

        <p className={styles.description}>
          Tell us about your business, your goals, and what&apos;s holding
          <br />
          you back. We&apos;ll help you figure out the next step.
        </p>

        <a href={LINKS.contact} className={styles.cta}>
          <span>Start the Conversation</span>
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