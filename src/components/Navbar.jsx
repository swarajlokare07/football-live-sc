import { useState } from 'react';
import { navbarStyles as s } from '../assets/dummyStyles';

const navigationLinks = [
  ['#match-center', 'Matches'],
  ['#highlights', 'Highlights'],
  ['#standings', 'Standings'],
  ['#fixtures', 'Fixtures'],
];

function MenuIcon({ open }) {
  return open ? (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={s.nav} aria-label="Main navigation">
      <div className={s.innerContainer}>
        <a href="#top" className={s.logo}>
          FootBuzz
        </a>

        <div className={s.desktopNav}>
          {navigationLinks.map(([href, label]) => (
            <a key={href} href={href} className={s.desktopNavLink}>
              {label}
            </a>
          ))}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <a href="#live" className={s.liveButton}>
            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              className={s.liveIcon}
            >
              <circle cx="4" cy="4" r="3" />
            </svg>
            <span className={s.liveTextFull}>Live Streams</span>
            <span className={s.liveTextShort}>Live</span>
          </a>
          <button
            type="button"
            className={s.hamburgerButton}
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-navigation" className={s.mobileMenu}>
          {navigationLinks.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={s.mobileMenuLink}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
