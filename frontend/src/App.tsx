import { useEffect, useRef, useState } from "react";
import { AP_Sidebar } from "./components/AP_Sidebar";
import { Appointments } from "./screen/Appointments";
import { BookAppointment } from "./screen/BookAppointment";
import { Dashboard } from "./screen/Dashboard";
import { MyAppointments } from "./screen/MyAppointments";
import { Queue } from "./screen/Queue";
import { Services } from "./screen/Services";
import { SignIn } from "./screen/SignIn";
import { Staff } from "./screen/Staff";
import { authApi, getErrorMessage } from "./shared/api";
import { connectSocket } from "./shared/realtime";
import type { ApiAppointment, ApiUser, ScreenName, UserRole } from "./shared/types";
import "./interceptors/axiosInterceptors";
import "./App.css";

function getHomeScreen(role: UserRole): ScreenName {
  if (role === "Admin") return "Dashboard";
  if (role === "Customer") return "Book appointment";
  return "Appointments";
}

function App() {
  const mainAreaRef = useRef<HTMLElement>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenName>("Dashboard");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [rescheduleAppointment, setRescheduleAppointment] = useState<ApiAppointment | null>(null);

  useEffect(() => {
    mainAreaRef.current?.scrollTo({ top: 0 });
  }, [activeScreen, rescheduleAppointment]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setCheckingSession(false);
      return;
    }

    authApi.me()
      .then((currentUser) => {
        setUser(currentUser);
        setActiveScreen(getHomeScreen(currentUser.role));
      })
      .catch((error: unknown) => {
        localStorage.removeItem("token");
        setAuthMessage(getErrorMessage(error));
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      setUser(null);
      setRescheduleAppointment(null);
      setAuthMessage("Your session expired. Please sign in again.");
    }

    window.addEventListener("session-expired", handleExpiredSession);
    return () => window.removeEventListener("session-expired", handleExpiredSession);
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    return connectSocket(
      token,
      () => window.dispatchEvent(new Event("queue-updated")),
      (detail) => window.dispatchEvent(new CustomEvent("availability-updated", { detail }))
    );
  }, [user]);

  function handleSignedIn(signedInUser: ApiUser) {
    setUser(signedInUser);
    setAuthMessage("");
    setActiveScreen(getHomeScreen(signedInUser.role));
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
      setRescheduleAppointment(null);
      setAuthMessage(logoutMessage);
    }
  }

  function renderScreen() {
    switch (activeScreen) {
      case "Appointments":
        return <Appointments
          role={user?.role ?? "Customer"}
          onReschedule={(appointment) => {
            setRescheduleAppointment(appointment);
            setActiveScreen("Book appointment");
          }}
        />;
      case "Queue":
        return <Queue role={user?.role ?? "Admin"} />;
      case "Services":
        return <Services />;
      case "Staff":
        return <Staff />;
      case "Book appointment":
        return (
          <BookAppointment
            key={rescheduleAppointment?._id ?? "new-booking"}
            rescheduleAppointment={rescheduleAppointment}
            onRescheduleComplete={() => {
              setRescheduleAppointment(null);
              setActiveScreen(user?.role === "Customer" ? "My appointments" : "Appointments");
            }}
          />
        );
      case "My appointments":
        return <MyAppointments onReschedule={(appointment) => {
          setRescheduleAppointment(appointment);
          setActiveScreen("Book appointment");
        }} />;
      case "Dashboard":
        return <Dashboard onNavigate={setActiveScreen} />;
    }
  }

  if (checkingSession) {
    return <main className="session-loading">Checking your sign-in…</main>;
  }

  if (!user) {
    return <SignIn message={authMessage} onSignedIn={handleSignedIn} />;
  }

  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="app-shell">
      <AP_Sidebar
        activeScreen={activeScreen}
        fullName={user.fullName}
        role={user.role}
        onNavigate={(screen) => {
          if (screen !== "Book appointment") setRescheduleAppointment(null);
          setActiveScreen(screen);
        }}
        onLogout={() => { void handleLogout(); }}
      />
      <main className="main-area" ref={mainAreaRef}>
        <header className="topbar">
          <div className="topbar-right">
            <span className="topbar-date">{today}</span>
            <button className="profile-button">
              <span className="avatar avatar-purple">{user.fullName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}</span>
              <span><strong>{user.fullName}</strong><small>{user.role}</small></span>
              <span className="profile-chevron">⌄</span>
            </button>
          </div>
        </header>
        <div className="page-content">{renderScreen()}</div>
        <footer className="app-footer">
          <span>TeamFlow · Smart Appointment &amp; Queue Management</span>
          <span>Signed in as {user.email}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
