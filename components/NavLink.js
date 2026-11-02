"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A header link that highlights itself when you're on that page.
export default function NavLink({ href, children, className = "" }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={`nav-link ${className}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
