"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
const { clearCurrentUser } = require("../lib/currentUser");

const LINKS = [
  { href: "/", label: "🏠 Home", key: "home" },
  { href: "/rankings", label: "🥟 Appetizer Rankings", key: "rankings-appetizer" },
  { href: "/rankings/dessert", label: "🍰 Dessert Rankings", key: "rankings-dessert" },
  { href: "/account", label: "⚙️ Account", key: "account" },
];

export default function NavBar({ user, active, title }) {
  const router = useRouter();

  function handleLogout() {
    clearCurrentUser();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <div className="brand-row">
        <h1>{title}</h1>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} className={active === l.key ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="who">
        {user.username}{" "}
        <button className="btn secondary small" style={{ marginLeft: 8 }} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
