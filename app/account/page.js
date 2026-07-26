"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import NavBar from "../NavBar";
import { getLockSettings, setLockSettings } from "../lib/tournament";
const { getCurrentUser } = require("../../lib/currentUser");

function formatLockTime(hour, minute) {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour < 12 ? "AM" : "PM";
    const mm = String(minute).padStart(2, "0");
    return `${h12}:${mm} ${ampm}`;
}

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
  const [lockHour, setLockHour] = useState(14);
  const [lockMinute, setLockMinute] = useState(0);
  const [hourInput, setHourInput] = useState("14");
  const [minuteInput, setMinuteInput] = useState("0");
  const [savingLock, setSavingLock] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace("/login");
    } else {
      setUser(u);
    }
    setChecked(true);
  }, [router]);

  useEffect(() => {
      if (!user || user.username !== "Griffin") return;
      (async () => {
            const settings = await getLockSettings();
            setLockHour(settings.lockHour);
            setLockMinute(settings.lockMinute);
            setHourInput(String(settings.lockHour));
            setMinuteInput(String(settings.lockMinute));
      })();
  }, [user]);

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

  async function handleSaveLockTime() {
      setSavingLock(true);
      try {
            const hour = Math.max(0, Math.min(23, Number(hourInput) || 0));
            const minute = Math.max(0, Math.min(59, Number(minuteInput) || 0));
            await setLockSettings(hour, minute);
            setLockHour(hour);
            setLockMinute(minute);
      } finally {
            setSavingLock(false);
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

{user.username === "Griffin" && (
    <div className="submit-card" style={{ marginTop: 20 }}>
      <div className="section-heading">Tournament lock time (Griffin only)</div>
      <div className="radio-row">
        <div>
          <label>Hour (0-23)</label>
          <input
            type="text"
                        inputMode="numeric"
                                    value={hourInput}
                                                onChange={(e) => setHourInput(e.target.value)}
                                                            style={{ width: 70 }}
        />
          </div>
                <div>
                  <label>Minute (0-59)</label>
                  <input
                    type="text"
                                inputMode="numeric"
                                            value={minuteInput}
                                                        onChange={(e) => setMinuteInput(e.target.value)}
                                                                    style={{ width: 70 }}
        />
          </div>
          </div>
              <button type="button" className="btn small" disabled={savingLock} onClick={handleSaveLockTime}>
        {savingLock ? "Saving..." : `Save (currently ${formatLockTime(lockHour, lockMinute)})`}
</button>
  </div>
  )}
    </div>
  );
}
