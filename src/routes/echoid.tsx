import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import "../styles/hero.css";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4";
const POSTER_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png";

const LINKS = [
  { label: "Story", href: "#story" },
  { label: "Platforms", href: "#platforms" },
  { label: "Identity", href: "#identity" },
  { label: "Contact", href: "#contact" },
];

export const Route = createFileRoute("/echoid")({
  head: () => ({
    meta: [
      { title: "ECHOID — Your voice ID to the E network" },
      {
        name: "description",
        content: "ECHOID is your voice ID to the E network. Request voice entry and claim your identity.",
      },
      { property: "og:title", content: "ECHOID — Your voice ID to the E network" },
      {
        property: "og:description",
        content: "ECHOID is your voice ID to the E network. Request voice entry and claim your identity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: POSTER_URL },
      { name: "twitter:image", content: POSTER_URL },
    ],
    links: [{ rel: "preconnect", href: "https://d8j0ntlcm91z4.cloudfront.net" }],
  }),
  component: Echoid,
});

function Echoid() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [open]);

  return (
    <section className="hero">
      <div className="hero__media" style={{ ["--poster" as string]: `url(${POSTER_URL})` }}>
        <video autoPlay muted loop playsInline preload="auto" poster={POSTER_URL}>
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      </div>
      <div className="hero__scrim" />

      <header className="nav">
        <a className="nav__logo" href="#top">
          ECHOID
        </a>
        <nav className="nav__right">
          <div className="nav__links">
            {LINKS.map((l) => (
              <a key={l.href} className="nav__link" href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
          <a className="nav__cta" href="#join">
            Join up
          </a>
          <button
            ref={toggleRef}
            type="button"
            className={`nav__toggle${open ? " is-active" : ""}`}
            aria-expanded={open}
            aria-controls="mobileMenu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </nav>
      </header>

      <div
        id="mobileMenu"
        className={`mobile-menu${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        {...(!open ? { inert: "" as unknown as boolean } : {})}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {LINKS.map((l, i) => (
          <a
            key={l.href}
            className="mobile-menu__link"
            href={l.href}
            style={{ ["--i" as string]: i }}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </a>
        ))}
        <a
          className="mobile-menu__cta"
          href="#join"
          style={{ ["--i" as string]: 4 }}
          onClick={() => setOpen(false)}
        >
          Join up
        </a>
      </div>

      <div className="hero__body">
        <div className="panel">
          <span className="panel__chip">[ Voice entry ]</span>
          <h1 className="panel__title">ECHOID</h1>
          <p className="panel__tagline">Your voice ID to the E network.</p>

          <form className="panel__form" action="#" method="post" noValidate onSubmit={(e) => e.preventDefault()}>
            <label className="vh" htmlFor="email">
              Email
            </label>
            <input id="email" className="field" type="email" name="email" placeholder="Email" />
            <button type="submit" className="btn btn--ghost">
              Proceed using email
            </button>
            <button type="submit" className="btn btn--solid">
              Access
            </button>
          </form>

          <a className="panel__referral" href="#invite">
            I&apos;ve got an invite key
          </a>
        </div>
      </div>

      <footer className="legal">
        Opening an e.xyz account signals that you accept our{" "}
        <a href="#privacy-notice">Privacy Notice</a> and{" "}
        <a href="#service-contract">Service Contract</a>.
      </footer>
    </section>
  );
}
