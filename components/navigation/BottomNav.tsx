"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  label: string;
  href: string;
  center?: boolean;
};

const items: Item[] = [
  { label: "Home", href: "/baseline" },
  { label: "Fitness", href: "/baseline/fitness" },
  { label: "I Declare", href: "/baseline/declare", center: true },
  { label: "Finance", href: "/baseline/finance" },
  { label: "More", href: "/baseline/more" },
];

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
                <span className="nav-pill" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
