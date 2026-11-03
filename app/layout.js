import { Pacifico } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

// Brand font, self-hosted by next/font at build time (no request to Google from the browser).
// Pacifico: the script accent words in headings.
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico", display: "swap" });

export const metadata = {
  title: "FEELING FINE — adaptive clothing, found together",
  description: "Chat to find adaptive clothing and the shops near you that sell it.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={pacifico.variable}>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <Header />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
