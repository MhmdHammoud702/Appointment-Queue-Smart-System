import { useState, type FormEvent } from "react";
import * as yup from "yup";
import { AP_Button } from "../components/AP_Button";
import { AP_Textbox } from "../components/AP_Textbox";
import { authApi, getErrorMessage } from "../shared/api";
import type { ApiUser, LoginFields, RegisterFields } from "../shared/types";
import { loginSchema, registerSchema } from "../shared/validation";
import "./SignIn.css";

export type AuthMode = "login" | "register";

type SignInProps = {
  onSignedIn: (user: ApiUser, token: string) => void;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  message?: string;
};

const emptyLogin: LoginFields = { email: "", password: "" };
const emptyRegistration: RegisterFields = { fullName: "", email: "", phone: "", password: "" };

export function SignIn({ onSignedIn, mode, onModeChange, message = "" }: SignInProps) {
  const [login, setLogin] = useState(emptyLogin);
  const [registration, setRegistration] = useState(emptyRegistration);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegistering = mode === "register";

  function changeMode(nextMode: AuthMode) {
    onModeChange(nextMode);
    setErrors({});
    setRequestError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError("");

    try {
      setLoading(true);
      const result = isRegistering
        ? await authApi.register(await registerSchema.validate(registration, { abortEarly: false }))
        : await authApi.login(await loginSchema.validate(login, { abortEarly: false }));
      localStorage.setItem("token", result.token);
      onSignedIn(result.user, result.token);
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const nextErrors: Record<string, string> = {};
        error.inner.forEach((issue) => {
          if (issue.path) nextErrors[issue.path] = issue.message;
        });
        setErrors(nextErrors);
      } else {
        setRequestError(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-window" aria-label="TeamFlow account access">
        <div className="auth-layout">
          <aside className="auth-info">
            <div className="auth-brand"><span className="auth-brand-mark">≡</span> TeamFlow</div>
            <div className="auth-info-copy">
              <p className="auth-eyebrow">SMART APPOINTMENTS</p>
              <h1>Book appointments online and see your place in the queue.</h1>
              <ul>
                <li><span>▣</span> Pick a service, a practitioner and a free time</li>
                <li><span>✉</span> Get your booking reference by email</li>
                <li><span>☷</span> Check in at reception and follow the live queue</li>
              </ul>
            </div>
            <p className="auth-info-note">Your bookings and queue updates, all in one place.</p>
          </aside>

          <section className="auth-form-panel">
            <div className="auth-switch">
              {isRegistering ? "Already have an account?" : "New here?"}
              <button onClick={() => changeMode(isRegistering ? "login" : "register")} type="button">
                {isRegistering ? "Sign in" : "Create an account"}
              </button>
            </div>

            <div className="auth-form-content">
              <h2>{isRegistering ? "Create your account" : "Welcome back"}</h2>
              <p className="auth-description">
                {isRegistering
                  ? "Book, reschedule and cancel your own appointments."
                  : "Sign in to manage your appointments."}
              </p>

              <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
                {isRegistering ? (
                  <>
                    <div className="auth-field-row">
                      <AP_Textbox
                        label="Full name"
                        value={registration.fullName}
                        error={errors.fullName}
                        onChange={(fullName) => setRegistration({ ...registration, fullName })}
                      />
                      <AP_Textbox
                        label="Phone"
                        type="tel"
                        value={registration.phone}
                        error={errors.phone}
                        onChange={(phone) => setRegistration({ ...registration, phone })}
                      />
                    </div>
                    <AP_Textbox
                      label="Email"
                      type="email"
                      value={registration.email}
                      error={errors.email}
                      onChange={(email) => setRegistration({ ...registration, email })}
                    />
                    <AP_Textbox
                      label="Password"
                      type="password"
                      value={registration.password}
                      error={errors.password}
                      help="At least 8 characters."
                      onChange={(password) => setRegistration({ ...registration, password })}
                    />
                  </>
                ) : (
                  <>
                    <AP_Textbox
                      label="Email"
                      type="email"
                      value={login.email}
                      error={errors.email}
                      onChange={(email) => setLogin({ ...login, email })}
                    />
                    <AP_Textbox
                      label="Password"
                      type="password"
                      value={login.password}
                      error={errors.password}
                      onChange={(password) => setLogin({ ...login, password })}
                    />
                  </>
                )}
                {(requestError || message) && <p className="auth-error" role="alert">{requestError || message}</p>}
                <AP_Button className="full-width" loading={loading} type="submit">
                  {isRegistering ? "Create account" : "Sign in"}
                </AP_Button>
              </form>

              {isRegistering && (
                <p className="auth-account-note">
                  <span aria-hidden="true">ⓘ</span>
                  Staff and admin accounts are created by the clinic administrator.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
