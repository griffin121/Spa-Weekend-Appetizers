"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import NavBar from "../NavBar";
const { getCurrentUser } = require("../../lib/currentUser");

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
    } else {
      setUser(u);
    }
    setChecked(true);
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc("change_password", {
        p_username: user.username,
        p_old_password: oldPassword,
        p_new_password: newPassword,
      });
      if (rpcError) {
        setError(
          rpcError.message && rpcError.message.includes("Incorrect")
            ? "Your current password is incorrect."
            : "Something went wrong."
        );
        return;
      }
      setSuccess("Password updated.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  }

  if (!checked || !user) return null;

  return (
    <div className="page">
      <NavBar user={user} active="account" title="⚙️ Account" />
      <p className="sub-note">Change your password for {user.username}.</p>

      <div className="auth-card" style={{ margin: "0" }}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="oldPassword">Current password</label>
          <input
            id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {error && <p className="error">{error}</p>}
          {success && (
            <p className="sub-note" style={{ color: "var(--accent)" }}>
              {success}
            </p>
          )}
          <button className="btn" style={{ marginTop: 18, width: "100%" }} disabled={saving}>
            {saving ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
