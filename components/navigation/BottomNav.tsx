"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  label: string;
  href: string;
  center?: boolean;
  icon: "home" | "fitness" | "assistant" | "finance" | "more";
};

const items: Item[] = [
  { label: "Home", href: "/baseline", icon: "home" },
  { label: "Fitness", href: "/baseline/fitness", icon: "fitness" },
  { label: "Assistant", href: "/baseline/assistant", center: true, icon: "assistant" },
  { label: "Finance", href: "/baseline/finance", icon: "finance" },
  { label: "More", href: "/baseline/more", icon: "more" },
];

function NavIcon({ name }: { name: Item["icon"] }) {
  const paths = {
    home: <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z" />,
    fitness: <path d="M7 9v6m10-6v6M4 10v4m16-4v4M7 12h10" />,
    assistant: <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm6 12 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />,
    finance: <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function isActive(pathname: string, href: string) {
  if (href === "/baseline") return pathname === "/baseline";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="bottom-nav-wrap">
      <nav className="bottom-nav" aria-label="Baseline Navigation">
        <div className="bottom-nav-inner">
          {items.map((item) => {
            const active = isActive(pathname, item.href);

            const className = [
              "nav-item",
              active ? "nav-item-active" : "",
              item.center ? "nav-item-center" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Link key={item.href} href={item.href} className={className}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
