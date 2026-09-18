"use client";

import { useActionState, useState } from "react";
import { login, signup } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <main className="shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="brand" style={{ fontSize: "1.4rem", marginBottom: 8 }}>
        Recruit<span>U</span>
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 28 }}>
        Your whole job hunt in one place. Private by default — nobody sees your
        work unless you invite them.
      </p>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>
          {mode === "login" ? "Sign in" : "Create your account"}
        </h2>

        <form action={formAction} key={mode}>
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="displayName">Name</label>
              <input id="displayName" name="displayName" type="text" autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            {mode === "signup" && <p className="hint">At least 8 characters.</p>}
          </div>

          {state?.error && <p className="error">{state.error}</p>}

          <button className="btn btn-primary" type="submit" disabled={pending} style={{ marginTop: 20, width: "100%", justifyContent: "center" }}>
            {pending ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          style={{ background: "none", border: 0, color: "var(--accent-ink)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </main>
  );
}
