"use client";

import { useEffect, useRef, useState } from "react";

type SessionUser = { displayName: string; email: string; avatarUrl: string | null };

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "EG";
}

export default function AuthButton({ mobile = false }: { mobile?: boolean }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data: { user?: SessionUser | null }) => setUser(data.user ?? null)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  if (user === undefined) return <span className={`authLoading ${mobile ? "mobile" : ""}`} aria-label="Loading account" />;
  if (!user) return <a className={mobile ? "mobileAuthButton" : "loginButton"} href="/login?returnTo=/">Log in</a>;

  return <div className={`authMenu ${mobile ? "mobile" : ""}`} ref={menuRef}>
    <button className="profileButton" type="button" onClick={() => setOpen((current) => !current)} aria-label={`Open account menu for ${user.displayName}`} aria-expanded={open}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{initials(user.displayName)}</span>}
    </button>
    {open && <div className="profileMenu" role="menu">
      <div className="profileMenuIdentity"><strong>{user.displayName}</strong><small>{user.email}</small></div>
      <a href="/dashboard" role="menuitem">Dashboard</a>
      <a href="/profile" role="menuitem">My profile</a>
      <a href="/api/auth/logout?returnTo=/" role="menuitem">Log out</a>
    </div>}
  </div>;
}
