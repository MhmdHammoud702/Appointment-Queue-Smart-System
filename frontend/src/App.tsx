import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AP_Error } from "./components/AP_Error";
import { AP_Loading } from "./components/AP_Loading";
import { AP_Sidebar } from "./components/AP_Sidebar";
import { Appointments } from "./screen/Appointments";
import { BookAppointment } from "./screen/BookAppointment";
import { Dashboard } from "./screen/Dashboard";
import { MyAppointments } from "./screen/MyAppointments";
import { Queue } from "./screen/Queue";
import { Services } from "./screen/Services";
import { SignIn } from "./screen/SignIn";
import { Staff } from "./screen/Staff";
import { authApi, appointmentsApi, getErrorMessage } from "./shared/api";
import { canAccessScreen, getActiveScreen, getHomeScreen, screenPaths } from "./shared/navigation";
import { connectSocket, type AppointmentBookedNotification } from "./shared/realtime";
import type { ApiAppointment, ApiUser, ScreenName, UserRole } from "./shared/types";
import "./interceptors/axiosInterceptors";
import "./App.css";

type ProtectedScreenProps = {
  role: UserRole;
  screen: ScreenName;
  children: ReactNode;
};

function ProtectedScreen({ role, screen, children }: ProtectedScreenProps) {
  if (!canAccessScreen(role, screen)) {
    return <Navigate replace to={screenPaths[getHomeScreen(role)]} />;
  }

  return children;
}

function RescheduleAppointmentPage({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { appointmentId } = useParams();
  const location = useLocation();
  const locationAppointment =
    (location.state as { appointment?: ApiAppointment } | null)?.appointment;
  const [appointment, setAppointment] = useState<ApiAppointment | null>(() =>
    locationAppointment && locationAppointment._id === appointmentId ? locationAppointment : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!appointmentId) {
      setError("The appointment to reschedule was not specified.");
      setLoading(false);
      return;
    }

    if (locationAppointment?._id === appointmentId) {
      setAppointment(locationAppointment);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    setAppointment(null);
    setError("");
    setLoading(true);
    appointmentsApi.get(appointmentId)
      .then((result) => {
        if (active) setAppointment(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [appointmentId, locationAppointment]);

  if (loading) return <AP_Loading label="Loading appointment to reschedule" />;
  if (error) return <AP_Error message={error} />;
  if (!appointment) return <AP_Error message="The appointment could not be loaded." />;

  return (
    <BookAppointment
      key={appointment._id}
      rescheduleAppointment={appointment}
      onRescheduleComplete={onComplete}
    />
  );
}

function App() {
  const mainAreaRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [appointmentToast, setAppointmentToast] = useState<AppointmentBookedNotification | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    mainAreaRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setCheckingSession(false);
      return;
    }

    authApi.me()
      .then(setUser)
      .catch((error: unknown) => {
        localStorage.removeItem("token");
        setAuthMessage(getErrorMessage(error));
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      setUser(null);
      setAuthMessage("Your session expired. Please sign in again.");
      navigate("/login", { replace: true });
    }

    window.addEventListener("session-expired", handleExpiredSession);
    return () => window.removeEventListener("session-expired", handleExpiredSession);
  }, [navigate]);

  useEffect(() => {
    if (!user || checkingSession) return;

    if (["/", "/login", "/register"].includes(location.pathname)) {
      navigate(screenPaths[getHomeScreen(user.role)], { replace: true });
    }
  }, [checkingSession, location.pathname, navigate, user]);

  useEffect(() => {
    if (!user) {
      setRealtimeStatus("offline");
      setAppointmentToast(null);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setRealtimeStatus("offline");
      return;
    }

    setRealtimeStatus("connecting");
    return connectSocket(
      token,
      () => window.dispatchEvent(new Event("queue-updated")),
      (detail) => window.dispatchEvent(new CustomEvent("availability-updated", { detail })),
      (notification) => {
        if (user.role === "Receptionist") setAppointmentToast(notification);
      },
      (connected) => {
        const status = connected ? "live" : "offline";
        setRealtimeStatus(status);
        window.dispatchEvent(new CustomEvent("realtime-status", { detail: status }));
      },
    );
  }, [user]);

  function handleSignedIn(signedInUser: ApiUser) {
    setUser(signedInUser);
    setAuthMessage("");
    const path = location.pathname;
    const isReschedulePath = /^\/appointments\/[^/]+\/reschedule$/.test(path);
    const requestedScreen = getActiveScreen(path, signedInUser.role);
    const canReturnToPath = isReschedulePath
      ? signedInUser.role !== "Receptionist"
      : canAccessScreen(signedInUser.role, requestedScreen) && screenPaths[requestedScreen] === path;
    navigate(
      canReturnToPath ? path : screenPaths[getHomeScreen(signedInUser.role)],
      { replace: true },
    );
  }

  async function handleLogout() {
    let logoutMessage = "";
    try {
      await authApi.logout();
    } catch (error) {
      logoutMessage = `Signed out locally. ${getErrorMessage(error)}`;
    } finally {
      localStorage.removeItem("token");
      setUser(null);
      setAppointmentToast(null);
      setAuthMessage(logoutMessage);
      navigate("/login", { replace: true });
    }
  }

  if (checkingSession) {
    return <main className="session-loading">Checking your sign-in…</main>;
  }

  if (!user) {
    return (
      <SignIn
        message={authMessage}
        mode={location.pathname === "/register" ? "register" : "login"}
        onModeChange={(mode) => navigate(mode === "register" ? "/register" : "/login")}
        onSignedIn={handleSignedIn}
      />
    );
  }

  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const activeScreen = getActiveScreen(location.pathname, user.role);
  const homePath = screenPaths[getHomeScreen(user.role)];

  return (
    <div className={`app-shell${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
      {user.role === "Receptionist" && appointmentToast && (
        <AppointmentBookedToast
          customerName={appointmentToast.customerName}
          onDismiss={() => setAppointmentToast(null)}
        />
      )}
      <AP_Sidebar
        activeScreen={activeScreen}
        fullName={user.fullName}
        role={user.role}
        realtimeStatus={realtimeStatus}
        menuOpen={mobileMenuOpen}
        onMenuOpenChange={setMobileMenuOpen}
        onLogout={() => { void handleLogout(); }}
      />
      <main className="main-area" ref={mainAreaRef}>
        <header className="topbar">
          <div className="topbar-inner">
            <span
              aria-live="polite"
              className={`live-badge live-badge-${realtimeStatus}`}
              title={realtimeStatus === "live"
                ? "Real-time updates are connected"
                : realtimeStatus === "connecting"
                  ? "Connecting to real-time updates"
                  : "Real-time updates are disconnected"}
            >
              <span className="live-dot" />
              {realtimeStatus === "live"
                ? "Live"
                : realtimeStatus === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </span>
            <span className="mobile-business-name">TeamFlow</span>
            <div className="topbar-right">
              <span className="topbar-date">{today}</span>
              <button aria-label={`Signed in as ${user.fullName}, ${user.role}`} className="profile-button" type="button">
                  <span className="avatar avatar-purple">{user.fullName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}</span>
                  <span><strong>{user.fullName}</strong><small>{user.role}</small></span>
              </button>
              <span className={`mobile-online-status mobile-online-status-${realtimeStatus}`}>
                  <span className="live-dot" />
                  {realtimeStatus === "live" ? "Online" : realtimeStatus === "connecting" ? "Connecting" : "Offline"}
              </span>
              <button
                aria-controls="sidebar-menu"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                className="topbar-menu-button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                type="button"
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate replace to={homePath} />} />
            <Route path="/login" element={<Navigate replace to={homePath} />} />
            <Route path="/register" element={<Navigate replace to={homePath} />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedScreen role={user.role} screen="Dashboard">
                  <Dashboard onNavigate={(screen) => navigate(screenPaths[screen])} />
                </ProtectedScreen>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedScreen role={user.role} screen="Appointments">
                  <Appointments
                    role={user.role}
                    onReschedule={(appointment) => navigate(
                      `/appointments/${appointment._id}/reschedule`,
                      { state: { appointment } },
                    )}
                  />
                </ProtectedScreen>
              }
            />
            <Route
              path="/appointments/:appointmentId/reschedule"
              element={user.role === "Receptionist"
                ? <Navigate replace to={homePath} />
                : (
                  <RescheduleAppointmentPage
                    onComplete={() => navigate(
                      screenPaths[user.role === "Customer" ? "My appointments" : "Appointments"],
                      { replace: true },
                    )}
                  />
                )}
            />
            <Route
              path="/queue"
              element={
                <ProtectedScreen role={user.role} screen="Queue">
                  <Queue role={user.role} />
                </ProtectedScreen>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedScreen role={user.role} screen="Services">
                  <Services />
                </ProtectedScreen>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedScreen role={user.role} screen="Staff">
                  <Staff />
                </ProtectedScreen>
              }
            />
            <Route
              path="/book"
              element={
                <ProtectedScreen role={user.role} screen="Book appointment">
                  <BookAppointment />
                </ProtectedScreen>
              }
            />
            <Route
              path="/my-appointments"
              element={
                <ProtectedScreen role={user.role} screen="My appointments">
                  <MyAppointments
                    onReschedule={(appointment) => navigate(
                      `/appointments/${appointment._id}/reschedule`,
                      { state: { appointment } },
                    )}
                  />
                </ProtectedScreen>
              }
            />
            <Route path="*" element={<Navigate replace to={homePath} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function AppointmentBookedToast({
  customerName,
  onDismiss,
}: {
  customerName: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 8_000);
    return () => window.clearTimeout(timeout);
  }, [customerName, onDismiss]);

  return (
    <div aria-live="polite" className="appointment-booked-toast" role="status">
      <span aria-hidden="true" className="appointment-booked-toast-icon">!</span>
      <span className="appointment-booked-toast-message">
        <strong>{customerName}</strong> booked an appointment. Waiting for your confirmation.
      </span>
      <button
        aria-label="Dismiss appointment notification"
        className="appointment-booked-toast-dismiss"
        onClick={onDismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

export default App;
