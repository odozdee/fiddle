import "./styles.css";
import Link from "next/link";
import { AuthProvider } from "./auth-provider";
import AccountLink from "./account-link";

export const metadata = {
  title: "Fiddle",
  description: "Read your sheet music alongside measure-specific practice tips.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="topbar">
            <div className="site-width topbar-inner">
              <Link href="/" className="wordmark" aria-label="Fiddle home">
                <span className="brand-mark" aria-hidden="true">♫</span>
                Fiddle<span className="brand-period">.</span>
              </Link>
              <nav className="site-nav" aria-label="Main navigation">
                <Link href="/">Home</Link>
                <AccountLink />
                <Link className="nav-practice" href="/practice">Practice Studio</Link>
              </nav>
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
