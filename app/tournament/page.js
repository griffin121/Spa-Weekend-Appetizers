"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import NavBar from "../NavBar";
import {
  getNextLockTime,
  isPastLockTime,
  getTotalProfileCount,
  ensureTournament,
  castVote,
  getLockSettings,
} from "../lib/tournament";
const { getCurrentUser } = require("../../lib/currentUser");

const CATEGORIES = [
  { key: "appetizer", label: "🥟 Appetizer Bracket" },
  { key: "dessert", label: "🍰 Dessert Bracket" },
];

function formatCountdown(ms) {
  if (ms <= 0) return "0h 0m 0s";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatLockTime(hour, minute) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

export default function TournamentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState({});
  const [lockHour, setLockHour] = useState(14);
  const [lockMinute, setLockMinute] = useState(0);
  const votingRef = useRef(false);

useEffect(() => {
  const u = getCurrentUser();
  if (!u) {
    router.replace("/login");
  } else {
    setUser(u);
  }
  setChecked(true);
}, [router]);

async function loadCategoryData(category, hour, minute) {
  const tournament = await ensureTournament(category, hour, minute);
  if (!tournament) {
    return { tournament: null, matches: [], appetizersById: {}, seedById: {}, votesByMatch: {} };
  }

  const { data: matches } = await supabase
  .from("tournament_matches")
  .select("*")
  .eq("tournament_id", tournament.id)
  .order("round", { ascending: true })
  .order("slot", { ascending: true });

  const { data: entries } = await supabase
  .from("tournament_entries")
  .select("appetizer_id, seed")
  .eq("tournament_id", tournament.id);

  const appetizerIds = (entries || []).map((e) => e.appetizer_id);
  const appetizerRows = appetizerIds.length
  ? (await supabase.from("appetizers").select("id, name, photo_url").in("id", appetizerIds)).data
    : [];

  const appetizersById = {};
  (appetizerRows || []).forEach((a) => {
    appetizersById[a.id] = a;
  });

  const seedById = {};
  (entries || []).forEach((e) => {
    seedById[e.appetizer_id] = e.seed;
  });

  const allMatchIds = (matches || []).map((m) => m.id);

  let votesByMatch = {};
  let profilesById = {};
  if (allMatchIds.length) {
    const { data: voteRows } = await supabase
    .from("tournament_votes")
    .select("match_id, profile_id, voted_for_id")
    .in("match_id", allMatchIds);
    (voteRows || []).forEach((v) => {
      if (!votesByMatch[v.match_id]) votesByMatch[v.match_id] = [];
      votesByMatch[v.match_id].push(v);
    });
    const voterIds = [...new Set((voteRows || []).map((v) => v.profile_id))];
    if (voterIds.length) {
      const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", voterIds);
      (profileRows || []).forEach((p) => {
        profilesById[p.id] = p;
      });
    }
  }

  return { tournament, matches: matches || [], appetizersById, seedById, votesByMatch, profilesById };
}

const loadAll = useCallback(async (hour, minute) => {
  setLoading(true);
  const total = await getTotalProfileCount();
  setTotalProfiles(total);

                            const results = {};
  for (const cat of CATEGORIES) {
    results[cat.key] = await loadCategoryData(cat.key, hour, minute);
  }
  setCategoryData(results);
  setLoading(false);
}, []);

useEffect(() => {
  if (!user) return;
  (async () => {
    const settings = await getLockSettings();
    setLockHour(settings.lockHour);
    setLockMinute(settings.lockMinute);
    setLocked(true); // tournament stays live once created; no daily lock/unlock cycle
    loadAll(settings.lockHour, settings.lockMinute);
  })();
}, [user, loadAll]);

useEffect(() => {
  if (locked) return;
  const interval = setInterval(() => {
    const target = getNextLockTime(lockHour, lockMinute);
    const ms = target.getTime() - Date.now();
    setCountdownText(formatCountdown(ms));
    if (isPastLockTime(lockHour, lockMinute)) {
      setLocked(true);
      loadAll(lockHour, lockMinute);
    }
  }, 1000);
  return () => clearInterval(interval);
}, [locked, loadAll, lockHour, lockMinute]);

async function handleVote(category, match, appetizerId) {
  if (votingRef.current) return;
  votingRef.current = true;
  try {
    await castVote(match, user.id, appetizerId, totalProfiles);
    const updated = await loadCategoryData(category, lockHour, lockMinute);
    setCategoryData((prev) => ({ ...prev, [category]: updated }));
  } finally {
    votingRef.current = false;
  }
}

if (!checked || !user) return null;

return (
  <div className="page">
<NavBar user={user} active="tournament" title={"🏆 Tournament"} />
  <p className="sub-note">
  Single-elimination bracket - top rank faces bottom rank. A dish wins once it has more than half of everyone's votes.
  </p>

  
{!locked ? (
  <div className="countdown-box">
<div className="countdown-label">🔒 Rankings lock for the tournament in</div>
  <div className="countdown-value">{countdownText || "calculating..."}</div>
<p className="sub-note" style={{ margin: "10px 0 0" }}>
At {formatLockTime(lockHour, lockMinute)}, the current standings for Appetizers and Desserts freeze and the bracket is generated automatically.
  </p>
  </div>
) : loading ? (
  <p className="empty">Loading tournament...</p>
  ) : (
  CATEGORIES.map((cat) => (
    <TournamentBracket
                 key={cat.key}
  label={cat.label}
                 data={categoryData[cat.key]}
  user={user}
onVote={(match, appetizerId) => handleVote(cat.key, match, appetizerId)}
totalProfiles={totalProfiles}
/>
  ))
  )}
  </div>
);
}

function TournamentBracket({ label, data, user, onVote, totalProfiles }) {
  if (!data || !data.tournament) {
    return (
      <div className="tournament-section">
  <div className="section-heading">{label}</div>
    <p className="empty">Not enough entries to run a bracket yet.</p>
      </div>
    );
  }

const { tournament, matches, appetizersById, seedById, votesByMatch, profilesById } = data;
  const rounds = {};
  matches.forEach((m) => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });
  const roundNumbers = Object.keys(rounds)
  .map(Number)
  .sort((a, b) => a - b);
  const threshold = Math.floor(totalProfiles / 2) + 1;

return (
  <div className="tournament-section">
  <div className="section-heading">{label}</div>

  {tournament.status === "completed" && (
    <div className="champion-banner">
🏆 Champion: {appetizersById[tournament.champion_id]?.name || "?"}
   </div>
   )}

  {roundNumbers.map((round) => (
    <div key={round} className="tournament-round">
    <div className="round-label">Round {round}</div>
                    <div className="card-list">
                    {rounds[round].map((m) => (
                      <MatchCard
                                       key={m.id}
                                       match={m}
  appetizersById={appetizersById}
  seedById={seedById}
  votes={votesByMatch[m.id] || []}
profilesById={profilesById}
threshold={threshold}
user={user}
onVote={onVote}
/>
  ))}
  </div>
  </div>
))}
  </div>
);
}

function MatchCard({ match, appetizersById, seedById, votes, threshold, user, onVote, profilesById }) {
  const a = match.appetizer_a_id ? appetizersById[match.appetizer_a_id] : null;
  const b = match.appetizer_b_id ? appetizersById[match.appetizer_b_id] : null;

if (!b) {
  return (
    <div className="app-card match-card">
    <div className="app-info">
    <div className="title-row">
    <span className="title">{a ? a.name : "?"}</span>
  <span className="category-tag appetizer">Bye</span>
  </div>
  <div className="makers">Automatically advances - no opponent this round.</div>
  </div>
  </div>
  );
}

const myVote = votes.find((v) => v.profile_id === user.id);
const countFor = (id) => votes.filter((v) => v.voted_for_id === id).length;
const aCount = countFor(match.appetizer_a_id);
const bCount = countFor(match.appetizer_b_id);
const namesFor = (id) =>
  votes
.filter((v) => v.voted_for_id === id)
.map((v) => profilesById[v.profile_id]?.username || "?");
const aNames = namesFor(match.appetizer_a_id);
const bNames = namesFor(match.appetizer_b_id);
const decided = match.status === "completed";

return (
  <div className="app-card match-card">
  <div className="app-info" style={{ width: "100%" }}>
<div className="match-sides">
  <button
type="button"
className={
  "match-side" +
  (decided && match.winner_id === match.appetizer_a_id ? " winner" : "") +
  (myVote && myVote.voted_for_id === match.appetizer_a_id ? " my-vote" : "")
}
disabled={decided}
onClick={() => onVote(match, match.appetizer_a_id)}
>
  <div className="match-side-top">
  <span className="seed-badge">#{(seedById[match.appetizer_a_id] ?? 0) + 1}</span>
<span className="match-side-name">{a ? a.name : "?"}</span>
  </div>
<span className="match-side-count">
{aCount} vote{aCount === 1 ? "" : "s"}
</span>
{aNames.length > 0 && (
  <span className="match-side-voters" style={{ display: "block", fontSize: "0.75rem", color: "#666" }}>
{aNames.join(", ")}
</span>
  )}
  </button>
<div className="match-vs">vs</div>
<button
type="button"
className={
  "match-side" +
  (decided && match.winner_id === match.appetizer_b_id ? " winner" : "") +
  (myVote && myVote.voted_for_id === match.appetizer_b_id ? " my-vote" : "")
}
disabled={decided}
onClick={() => onVote(match, match.appetizer_b_id)}
>
  <div className="match-side-top">
  <span className="seed-badge">#{(seedById[match.appetizer_b_id] ?? 0) + 1}</span>
<span className="match-side-name">{b ? b.name : "?"}</span>
  </div>
<span className="match-side-count">
{bCount} vote{bCount === 1 ? "" : "s"}
</span>
{bNames.length > 0 && (
  <span className="match-side-voters" style={{ display: "block", fontSize: "0.75rem", color: "#666" }}>
{bNames.join(", ")}
</span>
  )}
  </button>
  </div>
{decided ? (
  <div className="my-rating-badge" style={{ marginTop: 8 }}>
✅ Winner: {match.winner_id === match.appetizer_a_id ? (a ? a.name : "?") : (b ? b.name : "?")}
</div>
) : (
  <div className="sub-note" style={{ margin: "8px 0 0" }}>
Needs {threshold} vote{threshold === 1 ? "" : "s"} for one dish to decide the match.
  </div>
)}
</div>
  </div>
);
}
