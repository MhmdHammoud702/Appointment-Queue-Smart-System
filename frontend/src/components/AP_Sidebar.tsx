import { useEffect, useState } from "react";
import type { ScreenName, UserRole } from "../shared/types";
import "./AP_Sidebar.css";

type AP_SidebarProps = {
  activeScreen: ScreenName;
  role: UserRole;
  fullName: string;
  onNavigate: (screen: ScreenName) => void;
  onLogout: () => void;
};

const adminNavigation: { name: ScreenName; symbol: string }[] = [
  { name: "Dashboard", symbol: "▦" },
  { name: "Appointments", symbol: "▣" },
  { name: "Queue", symbol: "◷" },
  { name: "Services", symbol: "◇" },
  { name: "Staff", symbol: "♙" },
];

const customerNavigation: { name: ScreenName; symbol: string }[] = [
  { name: "Book appointment", symbol: "+" },
  { name: "My appointments", symbol: "▤" },
];

const staffNavigation: { name: ScreenName; symbol: string }[] = [
  { name: "Appointments", symbol: "▣" },
  { name: "Queue", symbol: "◷" },
];

const receptionistNavigation: { name: ScreenName; symbol: string }[] = [
  { name: "Appointments", symbol: "▣" },
  { name: "Queue", symbol: "◷" },
];

export function AP_Sidebar({ activeScreen, role, fullName, onNavigate, onLogout }: AP_SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const navigation = role === "Admin"
    ? adminNavigation
    : role === "Staff" ? staffNavigation
      : role === "Receptionist" ? receptionistNavigation
        : customerNavigation;
  const initials = fullName
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {menuOpen && (
        <button
          aria-label="Close navigation menu"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}
      <aside className={`sidebar${menuOpen ? " menu-open" : ""}`}>
        <div className="sidebar-header">
          <button className="brand" onClick={() => {
            setMenuOpen(false);
            onNavigate(role === "Admin" ? "Dashboard" : navigation[0]!.name);
          }}>
            <span className="brand-mark">T</span>
            <span>TeamFlow</span>
          </button>
          <button
            aria-controls="sidebar-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="sidebar-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span />
            <span />
            <span />
            <span className="visually-hidden">{menuOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>

        <div className="sidebar-menu" id="sidebar-menu">
          <p className="sidebar-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {navigation.map((item) => (
              <button
                aria-current={activeScreen === item.name ? "page" : undefined}
                className={`nav-link ${activeScreen === item.name ? "active" : ""}`}
                key={item.name}
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate(item.name);
                }}
              >
                <span className="nav-symbol">{item.symbol}</span>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

        <button className="sidebar-user" onClick={onLogout} title="Sign out">
          <span className="avatar avatar-small">{initials}</span>
          <span>
            <strong>{fullName}</strong>
            <small>{role} · Sign out</small>
          </span>
          <span className="user-dots">↪</span>
        </button>
      </aside>
    </>
  );
}
