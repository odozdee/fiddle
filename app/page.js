import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site-width home">
      <section className="hero home-hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow hero-label"><span />AI VIOLIN PRACTICE ASSISTANT</p>
          <h1 id="home-title">Make every<br />measure <em>count.</em></h1>
          <p className="hero-description">Upload your score, receive helpful tips, and compare your recordings with an excerpt</p>
          <Link className="home-cta" href="/practice">Open Practice Studio</Link>
        </div>

      </section>
    </main>
  );
}
