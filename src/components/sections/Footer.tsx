import { LINKS } from '@/lib/animation/config';
import styles from './Footer.module.css';

const GROUPS = [
  {
    title: 'Area We Serve',
    links: [
      { label: 'New Albany, IN', href: `${LINKS.site}/locations/new-albany-in-digital-marketing` },
      { label: 'Clarksville, IN', href: `${LINKS.site}/locations/clarksville-in-digital-marketing` },
      { label: 'Jeffersonville, IN', href: `${LINKS.site}/locations/jeffersonville-in-digital-marketing` },
      { label: 'Sellersburg, IN', href: `${LINKS.site}/locations/sellersburg-in-digital-marketing` },
      { label: 'Louisville, KY', href: `${LINKS.site}/locations/louisville-ky-digital-marketing` },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'SEO & Local Search', href: LINKS.seo },
      { label: 'Paid Advertising', href: `${LINKS.site}/paid-ads` },
      { label: 'Web Development', href: `${LINKS.site}/web-development` },
      { label: 'E-Commerce Management', href: LINKS.site },
    ],
  },
  {
    title: 'Industries',
    links: [
      'Home Services',
      'Plumbers',
      'Electricians',
      'Roofers',
      'Landscapers',
    ].map((label) => ({ label, href: LINKS.industries })),
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: LINKS.about },
      { label: 'Contact Us', href: LINKS.contact },
      { label: 'Blog', href: LINKS.blog },
      { label: 'Giving Back', href: LINKS.givingBack },
    ],
  },
];

export function Footer() {
  return (
    <footer className={styles.footer} aria-label="Site footer">
      <div className={styles.container}>
        <div className={styles.contactRow}>
          <a href={LINKS.site} className={styles.logoLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/chooli-logo.svg"
              alt="Chooli Digital Marketing"
              width="168"
              height="166"
              className={styles.logo}
            />
          </a>

          <div className={styles.contact}>
            <svg
              className={styles.contactIcon}
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.79a2 2 0 0 1-.45 2.11L8.08 9.89a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.89.33 1.83.56 2.79.69A2 2 0 0 1 22 16.92Z" />
              <path d="M14.05 2a9 9 0 0 1 7.95 7.95M14.05 6a5 5 0 0 1 3.95 3.95" />
            </svg>

            <div>
              <p className={styles.contactLabel}>Phone</p>
              <a href={LINKS.phone} className={styles.contactValue}>
                812-987-7007
              </a>
            </div>
          </div>

          <div className={styles.contact}>
            <svg
              className={styles.contactIcon}
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 10V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M9 6h6M9 10h6" />
              <path d="m5 7-3 3v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10l-3-3M2 10l10 6 10-6" />
            </svg>

            <div>
              <p className={styles.contactLabel}>E-mail address</p>
              <a
                href="mailto:support@choolidigitalmarketing.com"
                className={styles.contactValue}
              >
                support@choolidigitalmarketing.com
              </a>
            </div>
          </div>
        </div>

        <div className={styles.columns}>
          {GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className={styles.heading}>{group.title}</h2>
              <ul className={styles.links}>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={styles.copyright}>
          <p>© 2026 Chooli Digital Marketing. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}