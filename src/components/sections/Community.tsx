import { LINKS } from '@/lib/animation/config';
import styles from './Community.module.css';
import imageSources from './Community.images.json';

const PHOTOS = [
  { file: 'paid-advertising', alt: 'Planning campaign ideas in a notebook' },
  { file: 'ads-campaigns', alt: 'Working on a digital advertising campaign' },
  { file: 'seo', alt: 'Reviewing website performance and marketing analytics' },
  { file: 'local-search', alt: 'A laptop and notebook ready for business planning' },
  { file: 'web-design', alt: 'Planning the design and user experience of a website' },
  { file: 'development', alt: 'Developing a website with code' },
  { file: 'ppc', alt: 'Researching a digital marketing strategy' },
] as const;

export function Community() {
  return (
    <section aria-labelledby="community-heading" className={styles.section}>
      <div className={styles.copy}>
        <div className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M33 11c-5-6-15-4-17 3-2 6 2 10 7 14l8 7a3 3 0 0 0 4 0l9-9M49 20c3-10-9-17-16-9" />
            <path d="m47 23-1 1M6 35h10v22H6zM16 39h7l9 4h6a3 3 0 0 1 0 6H29" />
            <path d="m39 47 10-9c3-3 8-1 5 3L44 51c-2 2-5 3-9 3H16" />
          </svg>
        </div>
        <p className={styles.eyebrow}>Purpose-Driven Growth</p>
        <h2 id="community-heading" className={styles.heading}>
          Giving Back To The Community
        </h2>
        <p className={styles.description}>
          At Chooli Digital Marketing, we believe business growth should create a bigger impact.
          <br className={styles.desktopBreak} />{' '}
          We help local businesses grow through <span>SEO</span>, <span>web development</span>, Local SEO, and{' '}
          <span>paid ads</span>. However,
          <br className={styles.desktopBreak} />{' '}
          our mission goes beyond marketing results.
        </p>
      </div>

      <div className={styles.gallery}>
        <ul className={styles.photos} aria-label="Digital marketing at work">
          {PHOTOS.map((photo) => (
            <li key={photo.file} className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSources[`${photo.file}.jpg`]}
                alt={photo.alt}
                width="650"
                height="650"
                loading="lazy"
                decoding="async"
              />
            </li>
          ))}
        </ul>
      </div>

      <a className={styles.cta} href={LINKS.givingBack}>
        <span>See How It Works</span>
        <span className={styles.arrow} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18 18 6M7 6h11v11" />
          </svg>
        </span>
      </a>
    </section>
  );
}