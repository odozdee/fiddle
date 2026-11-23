import Link from "next/link";

const steps = [
  ["Bring your score", "Choose a PDF of the violin sheet music you’re working on.", "Use a clear scan or digital edition up to 15 MB. Fiddle starts reading as soon as you upload it."],
  ["Find the tricky passages", "Fiddle reads each page and looks for measures worth slowing down on.", "If the extracted notes look uncertain, compare them with the original page before working on the passage."],
  ["Practice with the score open", "Turn through the pages and read the tips beside the original notation.", "Try one suggestion at a time, then play the phrase again in context."],
  ["Compare your playing", "Upload your take and choose a YouTube reference of the same passage.", "Set the reference excerpt, compare pacing and pitch patterns, then watch an embedded lesson for suggested pitch or rhythm work."],
];

const stages = [
  ["Prepare the page", "PyMuPDF", "Splits the PDF into pages and renders the original notation for the preview.", "document"],
  ["Read the notation", "Audiveris + music21", "Audiveris recognizes the score. music21 reads the resulting MusicXML as measures, notes, rhythms, and voices.", "notation"],
  ["Draft the advice", "Claude", "Uses the page image and extracted notation together to suggest exercises for passages it can read confidently.", "spark"],
  ["Pair it with the score", "Fiddle", "Shows each page beside its own tips so you can check the notation as you practice.", "desk"],
  ["Compare performances", "Librosa", "Aligns your uploaded take with the chosen YouTube excerpt and compares pacing and pitch patterns.", "notation"],
  ["Find a lesson", "Fiddle", "Matches suggested pitch or rhythm work to an embedded violin tutorial you can watch in the practice studio.", "spark"],
];

function StageIcon({ name }) {
  const paths = {
    document: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
    notation: "M9 18V7l10-3v11 M9 10l10-3 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M19 15a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0",
    spark: "M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z",
    desk: "M3 5h18v14H3z M12 5v14 M6 9h3 M6 13h3 M15 9h3 M15 13h3",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

        <figure className="home-example">
          <div className="violin-study" aria-hidden="true">
            <span>FIDDLE</span>
            <svg viewBox="0 0 400 300" fill="none">
              <defs>
                <linearGradient id="varnish" x1="90" y1="160" x2="220" y2="270" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#edac72" />
                  <stop offset=".48" stopColor="#a95135" />
                  <stop offset="1" stopColor="#4e2730" />
                </linearGradient>
              </defs>
              <circle cx="208" cy="146" r="122" stroke="#e9ae872e" />
              <circle cx="208" cy="146" r="99" stroke="#e9ae8720" />
              <path d="M29 210H375M29 222H375M29 234H375M29 246H375M29 258H375" stroke="#f9c09625" />
              <g transform="rotate(31 205 156)" strokeLinejoin="round">
                <path d="M193 143C182 149 168 145 158 158C147 173 152 185 164 196C175 205 172 216 159 221C139 228 132 247 139 266C147 287 170 294 200 294C230 294 253 287 261 266C268 247 261 228 241 221C228 216 225 205 236 196C248 185 253 173 242 158C232 145 218 149 207 143Z"
                  fill="url(#varnish)" stroke="#ffcb9a" strokeWidth="2" />
                <path d="M190 151C176 153 165 153 160 168C156 181 164 188 172 196C185 211 178 222 160 229C143 238 142 253 148 267C154 282 174 288 200 288C226 288 246 282 252 267C258 253 257 238 240 229C222 222 215 211 228 196C236 188 244 181 240 168C235 153 224 153 210 151"
                  stroke="#ffd5a4" strokeOpacity=".55" />
                <path d="M194 54H206L211 197H189Z" fill="#38232d" stroke="#e0a47c" />
                <path d="M194 58L191 40Q193 25 201 25Q214 27 208 41L206 58Z" fill="#b76443" stroke="#ffcb9a" />
                <path d="M184 44H194M206 36H215M186 51H195M205 49H215" stroke="#ffd1a7" strokeWidth="3" strokeLinecap="round" />
                <path d="M180 205C172 209 181 218 176 228M220 205C228 209 219 218 224 228" stroke="#512832" strokeWidth="3" strokeLinecap="round" />
                <path d="M188 222Q200 215 212 222L209 231H191Z" fill="#ffcc95" />
                <path d="M193 240H207L214 274Q200 282 186 274Z" fill="#38232d" stroke="#e0a47c" />
                <path d="M197 54L195 258M199 54L198 258M201 54L202 258M203 54L205 258" stroke="#ffe2bc" strokeWidth=".6" />
              </g>
            </svg>
          </div>
          <figcaption className="example-tip">
            <span className="coach-mark" aria-hidden="true">✦</span>
            <div>
              <span className="eyebrow">EXAMPLE PRACTICE TIP</span>
              <p>Play the string crossings slowly, then try the full phrase with the same bow motion.</p>
            </div>
          </figcaption>
        </figure>
      </section>
      <section id="how-it-works" className="home-guide" aria-labelledby="guide-title">
        <h2 id="guide-title">How Fiddle works</h2>
        <p className="guide-description">Upload your score. Fiddle reads it and gives you practice tips along with an option to compare your playing.</p>
        <ol className="home-steps">
          {steps.map(([title, description, detail], index) => (
            <li key={title}>
              <details name="practice-steps">
                <summary>
                  <span className="panel-number" aria-hidden="true">0{index + 1}</span>
                  <span className="step-title">{title}</span>
                  <span className="step-description">{description}</span>
                  <span className="step-toggle" aria-hidden="true">+</span>
                </summary>
                <p>{detail}</p>
              </details>
            </li>
          ))}
        </ol>
      </section>
      <section className="system-overview" aria-labelledby="system-title">
        <p className="eyebrow">BEHIND THE MUSIC</p>
        <h2 id="system-title">What happens to your score</h2>
        <p className="guide-description">Follow the full practice studio workflow, from the uploaded score to audio feedback and a lesson to work with.</p>
        <ol className="system-stages">
          {stages.map(([title, tool, description, icon], index) => (
            <li key={title}>
              <div className="stage-marker">
                <span><StageIcon name={icon} /></span>
                <small>0{index + 1}</small>
              </div>
              <h3>{title}</h3>
              <span className="stage-tool">{tool}</span>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

    </main>
  );
}
