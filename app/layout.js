import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "FEELING FIND — adaptive clothing, found together",
  description: "Chat to find adaptive clothing and the shops near you that sell it.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <Header />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
