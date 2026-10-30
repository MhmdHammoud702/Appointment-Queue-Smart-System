import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getHomeScreen, screenPaths } from "../shared/navigation";
import type { ScreenName, UserRole } from "../shared/types";
import "./AP_Sidebar.css";

type AP_SidebarProps = {
  activeScreen: ScreenName;
  role: UserRole;
  fullName: string;
  realtimeStatus: "connecting" | "live" | "offline";
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
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

export function AP_Sidebar({ activeScreen, role, fullName, realtimeStatus, menuOpen, onMenuOpenChange, onLogout }: AP_SidebarProps) {
  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onMenuOpenChange(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen, onMenuOpenChange]);

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
          onClick={() => onMenuOpenChange(false)}
          type="button"
        />
      )}
      <aside className={`sidebar${menuOpen ? " menu-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand-section">
            <Link
              className="brand"
              onClick={() => onMenuOpenChange(false)}
              to={screenPaths[getHomeScreen(role)]}
            >
              <span className="brand-mark">T</span>
              <span>TeamFlow</span>
            </Link>
          </div>
          <div className="sidebar-header-actions">
            <span
              aria-label={`Sidebar live updates ${realtimeStatus}`}
              className={`sidebar-live-badge sidebar-live-badge-${realtimeStatus}`}
            >
              <span className="live-dot" />
              {realtimeStatus === "live" ? "Live" : realtimeStatus === "connecting" ? "Connecting" : "Offline"}
            </span>
            <button
              aria-controls="sidebar-menu"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="sidebar-menu-button"
              onClick={() => onMenuOpenChange(!menuOpen)}
              type="button"
            >
              <span />
              <span />
              <span />
              <span className="visually-hidden">{menuOpen ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>

        <div className="sidebar-menu" id="sidebar-menu">
          <div className="sidebar-drawer-header">
            <Link
              className="brand"
              onClick={() => onMenuOpenChange(false)}
              to={screenPaths[getHomeScreen(role)]}
            >
              <span className="brand-mark">T</span>
              <span>TeamFlow</span>
            </Link>
            <span className={`sidebar-live-badge sidebar-live-badge-${realtimeStatus}`}>
              <span className="live-dot" />
              {realtimeStatus === "live" ? "Live" : realtimeStatus === "connecting" ? "Connecting" : "Offline"}
            </span>
            <button
              aria-label="Close navigation menu"
              className="sidebar-menu-button"
              onClick={() => onMenuOpenChange(false)}
              type="button"
            >
              <span className="sidebar-close-icon" />
            </button>
          </div>
          <p className="sidebar-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                aria-current={activeScreen === item.name ? "page" : undefined}
                className={`nav-link ${activeScreen === item.name ? "active" : ""}`}
                key={item.name}
                onClick={() => onMenuOpenChange(false)}
                to={screenPaths[item.name]}
              >
                <span className="nav-symbol">{item.symbol}</span>
                {item.name}
              </Link>
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
