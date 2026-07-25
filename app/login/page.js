"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
const { setCurrentUser } = require("../../lib/currentUser");

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("login_profile", {
        p_username: username.trim(),
        p_password: password,
      });
      if (rpcError) {
        setError("Something went wrong.");
        return;
      }
      const profile = data && data[0];
      if (!profile) {
        setError("Incorrect username or password.");
        return;
      }
      setCurrentUser(profile);
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-card">
        <h1>🥂 Welcome back</h1>
        <p className="sub">Log in to rank appetizers with your friends.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Name</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" style={{ marginTop: 18, width: "100%" }} disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="switch-link">
          New here? <Link href="/register">Create a profile</Link>
        </p>
      </div>
    </div>
  );
}
