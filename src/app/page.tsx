import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CampaignShowcase } from "@/components/landing/campaign-showcase";
import { CitationProof } from "@/components/landing/citation-proof";
import { PlaceholderVisual } from "@/components/landing/placeholder-visual";

/*
 * Public marketing landing page at "/". Kept static and unauthenticated —
 * `src/proxy.ts` allows "/" through without a session.
 *
 * Copy discipline: every claim here comes from docs/BRAND_AND_POSITIONING.md.
 * The promise wordings in the "What holds it together" section are the
 * verbatim safe wordings from §4 and their caveats are part of the claim —
 * do not widen them. Nothing on this page may state a speed number, imply
 * self-serve signup, claim accessibility/mobile readiness, or show customer
 * logos or testimonials: see §5 "Do not market yet".
 *
 * Localization is deliberately NOT a headline feature here — no language
 * picker, no language count, no named languages. Keep it that way.
 */

// TODO(debbie): point at the real inbound address before this goes live.
const CONTACT_EMAIL = "hello@contentgate.app";
const DEMO_HREF = `mailto:${CONTACT_EMAIL}?subject=ContentGate%20demo%20request`;

export const metadata: Metadata = {
  title: "ContentGate — You don’t need to be a marketer to market well",
  description:
    "Your franchisees, distributors, and field reps have to make marketing, and none of them were hired to. ContentGate hands them a system where the design and the claims are already settled — and proves where every claim came from.",
  openGraph: {
    title: "ContentGate — You don’t need to be a marketer to market well",
    description:
      "Approved knowledge and locked templates go in. On-claim, on-brand, export-ready content comes out — with proof of where every claim came from and who approved it.",
    siteName: "ContentGate",
    type: "website",
  },
};

const NAV = [
  { href: "#problem", label: "The problem" },
  { href: "#how", label: "How it works" },
  { href: "#who", label: "Who it’s for" },
  { href: "#proof", label: "What holds it together" },
];

// Focus indication comes from the global `:focus-visible` outline in
// globals.css (added 29c5e2a). Do not add per-element rings here — an
// `outline-none` + ring pair would suppress it and double the affordance.

const ctaOnDark =
  "inline-flex items-center justify-center rounded-control bg-white px-5 py-3 text-[16px] font-semibold text-brand-dark transition-colors hover:bg-brand-tint";
const ctaGhostOnDark =
  "inline-flex items-center justify-center rounded-control border border-white/30 px-5 py-3 text-[16px] font-semibold text-white transition-colors hover:border-white hover:bg-white/10";
const ctaOnLight =
  "inline-flex items-center justify-center rounded-control bg-brand-dark px-5 py-3 text-[16px] font-semibold text-white transition-colors hover:bg-ink/85";

function Logo({ tone }: { tone: "light" | "dark" }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* White on --color-brand was 2.90:1 and failed AA; 29c5e2a darkened the
          token to #00756e, which measures 5.57:1, so this matches the app's
          own lockup again. */}
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-extrabold leading-none text-white">
        C
      </span>
      <span
        className={`text-[18px] font-bold tracking-[-0.03em] ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        contentgate
      </span>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-label text-accent-dark">{children}</p>;
}

export default function LandingPage() {
  return (
    <>
      {/* .skip-link is defined globally in globals.css as of 29c5e2a — use it
          rather than re-implementing the pattern here. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-dark/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
          <Link
            href="/"
            aria-label="ContentGate home"
            className="rounded-control"
          >
            <Logo tone="light" />
          </Link>

          <nav aria-label="Sections" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="rounded text-[15px] font-medium text-sidebar-text transition-colors hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-control px-3 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Log in
            </Link>
            <a
              href={DEMO_HREF}
              className="hidden rounded-control bg-white px-4 py-2 text-[15px] font-semibold text-brand-dark transition-colors hover:bg-brand-tint sm:inline-flex"
            >
              Request a demo
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-brand-dark">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/15 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="max-w-3xl">
              <p className="text-label text-brand-on-dark">
                Governed marketing production
              </p>
              <h1 className="mt-5 text-hero text-balance text-white">
                You don’t need to be a marketer to market well.
              </h1>
              <p className="mt-6 max-w-2xl text-lede text-pretty text-sidebar-text">
                Your franchisees, distributors, and field reps have to make
                marketing. None of them were hired to. Give them a system where
                the design and the claims are already settled.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href={DEMO_HREF} className={ctaOnDark}>
                  Request a demo
                </a>
                <Link href="/login" className={ctaGhostOnDark}>
                  Log in
                </Link>
              </div>
              <p className="mt-10 max-w-2xl border-l-2 border-brand pl-4 text-prose text-sidebar-text">
                Approved knowledge and locked templates go in. On-claim,
                on-brand, export-ready content comes out — with proof of where
                every claim came from and who approved it.
              </p>
            </div>

            {/* Fills the dead right column at ≥1280px. Bleeds past the
                container edge on purpose — the section is overflow-hidden, and
                a boxed image reads worse here. Hidden below xl so the mobile
                layout never has to carry it. */}
            <PlaceholderVisual
              label="Hero visual"
              spec="384 × 520, bleeds right"
              tone="dark"
              className="pointer-events-none absolute right-[-6%] top-1/2 hidden h-[520px] w-[460px] -translate-y-1/2 xl:block"
            />
          </div>
        </section>

        {/* ── Showcase ─────────────────────────────────────────────────── */}
        <section
          aria-labelledby="showcase-heading"
          className="border-t border-white/10 bg-brand-dark"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-label text-brand-on-dark">
                One brand, every market
              </p>
              <h2
                id="showcase-heading"
                className="mt-4 text-display text-balance text-white"
              >
                Fill the fields. Nothing else moves.
              </h2>
              <p className="mt-5 text-lede text-pretty text-sidebar-text">
                Five things open. Everything that makes it look like the brand
                stays shut.
              </p>
              <a
                href="#proof"
                className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-on-dark underline-offset-4 hover:underline"
              >
                See what stops it shipping
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="anim-rise mt-14">
              <CampaignShowcase />
            </div>
          </div>
        </section>

        {/* ── Problem ──────────────────────────────────────────────────── */}
        <section
          id="problem"
          aria-labelledby="problem-heading"
          className="scroll-mt-20 bg-page"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="anim-rise max-w-3xl">
              <SectionLabel>The problem</SectionLabel>
              <h2
                id="problem-heading"
                className="mt-4 text-display text-balance text-ink"
              >
                You approved all of it. Then it left the building.
              </h2>
              <p className="mt-5 text-lede text-pretty text-ink-muted-strong">
                The claims, the artwork, the regulatory wording — settled at
                headquarters. The selling happens somewhere else entirely, in
                fifteen markets, through people who need something usable this
                week. You have three options. All three are bad.
              </p>
            </div>

            <ol className="anim-rise mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Headquarters makes everything",
                  body: "You keep control and lose the year. A market waits six weeks for one social post, and the queue never empties.",
                },
                {
                  n: "02",
                  title: "Local teams make their own",
                  body: "Fast, and off-brand inside a month. Stretched logos, retyped claims, a statistic someone half-remembered. Not carelessness — nobody gave them a tool that assumed they weren’t designers.",
                },
                {
                  n: "03",
                  title: "Agencies in-market",
                  body: "You pay per asset, wait anyway, get a different brand in every country — and still nobody is checking the claims.",
                },
              ].map((option) => (
                <li
                  key={option.n}
                  className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-6"
                >
                  <span className="text-label text-ink-muted-strong">
                    {option.n}
                  </span>
                  <h3 className="text-subhead text-ink">{option.title}</h3>
                  <p className="text-prose text-ink-muted-strong">
                    {option.body}
                  </p>
                </li>
              ))}
            </ol>

            <div className="anim-rise mt-6 rounded-card border border-edge bg-brand-dark p-8 sm:p-10">
              <p className="text-label text-brand-on-dark">Option four</p>
              <p className="mt-4 max-w-3xl text-h1 text-balance text-white">
                The real constraint is not effort. It is expertise.
              </p>
              <p className="mt-4 max-w-3xl text-prose text-pretty text-sidebar-text">
                Put the design skill in the template. Put the regulatory skill
                in the approved sources. Now the person at the edge only has to
                know the one thing you don’t — their own customer. They move at
                their own speed, and off-claim output stops being a risk you
                manage and becomes a thing that cannot happen.
              </p>
            </div>
          </div>
        </section>

        {/* ── Four messages ────────────────────────────────────────────── */}
        <section aria-labelledby="promise-heading" className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <SectionLabel>What changes</SectionLabel>
              <h2
                id="promise-heading"
                className="mt-4 text-display text-balance text-ink"
              >
                Four things change at once.
              </h2>
            </div>

            <div className="anim-rise mt-12 grid gap-5 sm:grid-cols-2">
              {[
                {
                  title: "Local teams stop waiting",
                  body: "The bottleneck is gone. Nobody sits in a queue in another time zone for a one-pager they need before tomorrow’s call.",
                },
                {
                  title: "One brand, every market",
                  body: "It looks like the brand whether headquarters made it on Tuesday or a franchisee made it at eleven on a Sunday night.",
                },
                {
                  // Not "nothing unapproved ships": admins can download
                  // filename-labelled draft previews for internal QA, so the
                  // absolute is false. §4, and the Codex brief bans it too.
                  title: "Export is gated on approval",
                  body: "The gate is in the database, not in a process someone can click past when the quarter is ending.",
                },
                {
                  title: "Agency quality, in-house",
                  body: "The design skill sits in the template. One more size is not one more invoice.",
                },
              ].map((message, index) => (
                <div
                  key={message.title}
                  className="flex flex-col gap-3 rounded-card border border-edge bg-page p-7"
                >
                  <span className="text-label text-accent-dark">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-h1 text-balance text-ink">
                    {message.title}
                  </h3>
                  <p className="text-prose text-pretty text-ink-muted-strong">
                    {message.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section
          id="how"
          aria-labelledby="how-heading"
          className="scroll-mt-20 bg-page"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <SectionLabel>How it works</SectionLabel>
              <h2
                id="how-heading"
                className="mt-4 text-display text-balance text-ink"
              >
                Three steps. Then it ships.
              </h2>
              {/* Source approval and template publishing are real, but they are
                  one-time setup done centrally. Leading with them makes the
                  product look like configuration before it looks like
                  production. They stay acknowledged here and are covered
                  properly in the persona and enforcement sections. */}
              <p className="mt-5 text-lede text-pretty text-ink-muted-strong">
                Your brand approves the sources and publishes the templates
                once, centrally. This is what everyone else ever sees.
              </p>
            </div>

            <ol className="anim-rise mt-12 flex flex-col gap-4">
              {[
                {
                  n: "01",
                  who: "The local team",
                  title: "Fill in what only they know",
                  body: "Their customer, their offer, their week. That is the whole job. They never restyle anything and never decide what may be claimed.",
                },
                {
                  n: "02",
                  who: "The system",
                  title: "Draft, cite, fit-check",
                  body: "Copy is drafted against the approved sources. Every claim carries a citation checked word for word. Real glyph metrics catch the headline that won’t fit — before the render, not after.",
                },
                {
                  n: "03",
                  who: "An approver",
                  title: "Release it. Only then export",
                  body: "A named person approves one exact revision, and export will accept nothing else. Edit an approved asset and it falls back to draft on the spot.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="grid gap-4 rounded-card border border-edge bg-surface p-6 sm:grid-cols-[auto_180px_minmax(0,1fr)] sm:items-start sm:gap-8 sm:p-7"
                >
                  <span className="text-label text-accent-dark">{step.n}</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-label text-ink-muted-strong">
                      {step.who}
                    </span>
                    <h3 className="text-subhead text-ink">{step.title}</h3>
                  </div>
                  <p className="text-prose text-pretty text-ink-muted-strong">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-8 max-w-3xl text-lede text-pretty text-ink">
              Step three is the one worth watching in a demo. Change a single
              word of approved copy and the asset reverts to draft in front of
              you. Everything before that is a content tool. That keystroke is
              the product.
            </p>
            <div className="mt-7">
              <a href={DEMO_HREF} className={ctaOnLight}>
                Watch it happen on your own brand
              </a>
            </div>
          </div>
        </section>

        {/* ── Who it’s for ─────────────────────────────────────────────── */}
        <section
          id="who"
          aria-labelledby="who-heading"
          className="scroll-mt-20 bg-surface"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <SectionLabel>Who it’s for</SectionLabel>
              <h2
                id="who-heading"
                className="mt-4 text-display text-balance text-ink"
              >
                Five people. One broken process.
              </h2>
              <p className="mt-5 text-lede text-pretty text-ink-muted-strong">
                Three of them make marketing with no marketing training at all.
                That isn’t a discipline problem. They were handed a job that
                assumed a skill nobody ever gave them.
              </p>
            </div>

            <div className="anim-rise mt-12 grid gap-5 md:grid-cols-2">
              {[
                {
                  role: "CEO, country GM, commercial director",
                  quote:
                    "Every market moves at its own speed. None of them go off-script.",
                  body: "Right now you choose between moving fast and keeping control, and you have stopped noticing you’re choosing. You shouldn’t have to. Ask what was said about your product eighteen months ago and the answer takes seconds, not a fortnight of email.",
                },
                {
                  role: "Brand & regional marketing",
                  quote: "Set the rules once. Stop enforcing them by hand.",
                  body: "Open your inbox and count the resize requests. That is your week, and you didn’t take this job to run a production queue. Lock the layouts, approve the sources, step out of the path. The template says no so you don’t have to — at 2am, in Manila, without you.",
                },
                {
                  role: "Field sales",
                  quote:
                    "The right material, in your hand, before your next call.",
                  body: "You’re in a car park, fifteen minutes early, and the options are a two-year-old PDF or something you rebuild in PowerPoint. Pick the product, pick the format, done. Current, correct, already approved. You stop apologising for the leaflet.",
                },
                {
                  role: "Franchisees, distributors, local partners",
                  quote:
                    "Look like the brand. Sound like your market. Stay in your own job.",
                  body: "They sent you a folder of files and a PDF of guidelines. No designer came with it. Now you get real templates sized for the channels you actually use — and you fill in the one part you know better than headquarters ever will.",
                },
                {
                  role: "Compliance, regulatory, legal",
                  quote: "Approve the source once. Every asset proves itself.",
                  body: "You spend weeks getting a claim exactly right, then watch the qualifier fall off by the fourth copy. Now the copy has to quote your material word for word and the server checks it — at generation, and again at approval. You stop being the department of no.",
                },
              ].map((persona) => (
                <article
                  key={persona.role}
                  className="flex flex-col gap-4 rounded-card border border-edge bg-page p-7"
                >
                  {/* Photography slot — in context, never stock boardrooms, and
                      never attributed: no names, no companies, no logos. */}
                  <PlaceholderVisual
                    label="Portrait"
                    spec="in context"
                    tone="light"
                    variant="portrait"
                    ratio="16 / 9"
                    className="w-full"
                  />
                  <p className="text-label text-ink-muted-strong">
                    {persona.role}
                  </p>
                  <blockquote className="text-h1 text-balance text-ink">
                    {persona.quote}
                  </blockquote>
                  <p className="text-prose text-pretty text-ink-muted-strong">
                    {persona.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Managed implementation ───────────────────────────────────── */}
        {/* From the Codex product & services brief §10.6. Onboarding is a real
            part of the offer, not a footnote — template install and assignment
            are still an engineering workflow, so saying so is both accurate and
            better positioning than implying self-serve. Pricing deliberately
            omitted; that is a separate decision. */}
        <section aria-labelledby="managed-heading" className="bg-page">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="anim-rise max-w-3xl">
              <SectionLabel>Getting live</SectionLabel>
              <h2
                id="managed-heading"
                className="mt-4 text-display text-balance text-ink"
              >
                We do more than hand you another login.
              </h2>
              <p className="mt-5 text-lede text-pretty text-ink-muted-strong">
                We structure your source knowledge, bring across your approved
                assets, build the templates, set up roles and approvals, and
                train the people who will use it.
              </p>
            </div>

            <ol className="anim-rise mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                { n: "01", phase: "Discover" },
                { n: "02", phase: "Organize" },
                { n: "03", phase: "Build" },
                { n: "04", phase: "Configure" },
                { n: "05", phase: "Train" },
                { n: "06", phase: "Launch" },
              ].map((step) => (
                <li
                  key={step.phase}
                  className="flex items-baseline gap-3 rounded-card border border-edge bg-surface px-5 py-4 lg:flex-col lg:gap-2"
                >
                  <span className="text-label text-accent-dark">{step.n}</span>
                  <span className="text-subhead text-ink">{step.phase}</span>
                </li>
              ))}
            </ol>

            <p className="anim-rise mt-8 max-w-3xl text-lede text-pretty text-ink">
              Easy for local teams. Controlled for the brand.
            </p>
          </div>
        </section>

        {/* ── Proof ────────────────────────────────────────────────────── */}
        <section
          id="proof"
          aria-labelledby="proof-heading"
          className="scroll-mt-20 bg-brand-dark"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="text-label text-brand-on-dark">
                What holds it together
              </p>
              <h2
                id="proof-heading"
                className="mt-4 text-display text-balance text-white"
              >
                Everyone says grounded. This one shows the receipt.
              </h2>
              <p className="mt-5 text-lede text-pretty text-sidebar-text">
                Every claim is matched word for word against a source you
                approved — and re-checked every time it moves.
              </p>
            </div>

            <div className="anim-rise mt-12">
              <CitationProof />
              {/* The §4 safe wording travels with the vignette rather than in a
                  card of its own — the vignette IS this claim. Verbatim; do
                  not widen. */}
              <p className="mt-4 max-w-3xl text-prose text-pretty text-sidebar-text">
                Generated copy must carry server-verified verbatim citations to
                approved sources. Not a similarity score — the actual span,
                re-checked at submit, approve, export, and render.
              </p>
            </div>

            <ul className="anim-rise mt-10 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Export is gated on the approved revision",
                  body: "Final exports require the current approved revision. Admins can download clearly filename-labelled draft previews for internal QA.",
                },
                {
                  title: "You cannot click past the workflow",
                  body: "The authenticated client surface cannot bypass the workflow. Write to the row directly and a trigger puts the status, the approver, and the timestamps straight back. One guarded path in, checked under a row lock.",
                },
                {
                  title: "The history does not move",
                  body: "Generated-content revision and workflow-event history is append-only, including for service-role access. Who approved exactly what, and when — still answerable in eighteen months, by anyone who asks.",
                },
                {
                  title: "The layout cannot break",
                  body: "Locked layouts, checksum-verified template bundles, and font-aware fit checking. Geometry, line limits, and fonts are declared up front, and fit is measured on real glyphs rather than guessed at.",
                },
                {
                  title: "The AI never gets the last word",
                  body: "AI output is always a draft. Only a human can approve. Generation writes draft at every insert site, and the security policy refuses anything else — independently, even if the code forgot.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex flex-col gap-3 rounded-card border border-white/10 bg-white/[0.03] p-7"
                >
                  <h3 className="text-subhead text-white">{item.title}</h3>
                  <p className="text-prose text-pretty text-sidebar-text">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────────── */}
        {/* Continues the dark block above rather than starting a new one: the
            proof section earns the trust, this closes on it. Hence no top
            border and a tighter top pad than the light-section rhythm. */}
        <section aria-labelledby="cta-heading" className="bg-brand-dark">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-20 pt-8 sm:px-8 sm:pb-24 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
            <div className="max-w-3xl">
              <h2
                id="cta-heading"
                className="text-display text-balance text-white"
              >
                See the revert.
              </h2>
              <p className="mt-5 text-lede text-pretty text-sidebar-text">
                A working session, not a slide deck. Generate an asset from an
                approved source. Open the citation and read the exact line it
                stands on. Approve it. Export it. Then change one approved word
                and watch the export shut.
              </p>
              <p className="mt-5 text-prose text-pretty text-sidebar-text">
                Everyone starts with a setup session, not a signup form. We
                install your templates with you, so the first thing you see is
                your own brand rather than somebody’s sample.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href={DEMO_HREF} className={ctaOnDark}>
                  Request a demo
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="rounded text-[15px] font-semibold text-brand-on-dark underline-offset-4 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>

            {/* The revert loop — approve, change one approved word, watch the
                export shut. ~6–10s, muted/playsInline/loop, poster frame, and
                a static fallback under prefers-reduced-motion. */}
            <PlaceholderVisual
              label="The revert"
              spec="silent loop, 800 × 500"
              tone="dark"
              variant="media"
              ratio="16 / 10"
              className="w-full"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-edge bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo tone="dark" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="rounded text-body font-medium text-ink-muted-strong transition-colors hover:text-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="rounded text-body font-semibold text-ink transition-colors hover:text-accent-dark"
                >
                  Log in
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-caption text-ink-muted-strong">
            © 2026 ContentGate
          </p>
        </div>
      </footer>
    </>
  );
}
