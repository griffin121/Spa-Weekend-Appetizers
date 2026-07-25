"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
const { setCurrentUser } = require("../../lib/currentUser");

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim();
    if (cleanUsername.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("register_profile", {
        p_username: cleanUsername,
        p_password: password,
      });
      if (rpcError) {
        setError(
          rpcError.message && rpcError.message.includes("already taken")
            ? "That username is taken."
            : "Something went wrong."
        );
        return;
      }
      const profile = data && data[0];
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
        <h1>🥂 Create your profile</h1>
        <p className="sub">Pick a name and password just for this group.</p>
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
            autoComplete="new-password"
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" style={{ marginTop: 18, width: "100%" }} disabled={loading}>
            {loading ? "Creating..." : "Create profile"}
          </button>
        </form>
        <p className="switch-link">
          Already have a profile? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
