"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import NavBar from "../../NavBar";
const { getCurrentUser } = require("../../../lib/currentUser");

const RATING_LABELS = {
1: "💩 Ass Appetizer",
2: "😒 Not Good Appetizer",
3: "🍽️ Appetizer",
4: "👍 Good Appetizer",
5: "🔥 Good Ass Appetizer",
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function makerLabel(app, myId) {
const madeByYou = app.made_by === myId;
const withYou = app.co_maker_id === myId;
const maker = madeByYou ? "You" : app.made_by_name || "?";
if (!app.co_maker_id) return `🧑‍🍳 Solo by ${maker}`;
const co = withYou ? "You" : app.co_maker_name || "?";
return `🧑‍🍳 ${maker} & ${co}`;
}

async function attachSignedUrls(rows) {
const paths = rows.filter((r) => r.photo_url).map((r) => r.photo_url);
if (paths.length === 0) return rows;
const { data } = await supabase.storage
.from("appetizer-photos")
.createSignedUrls(paths, 604800);
const urlByPath = new Map();
(data || []).forEach((d) => {
if (d.signedUrl) urlByPath.set(d.path, d.signedUrl);
});
return rows.map((r) => ({
...r,
photo_signed_url: r.photo_url ? urlByPath.get(r.photo_url) || null : null,
}));
}

export default function DessertRankingsPage() {
const router = useRouter();
const [user, setUser] = useState(null);
const [checked, setChecked] = useState(false);
const [appetizers, setAppetizers] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
const u = getCurrentUser();
if (!u) {
router.replace("/login");
} else {
setUser(u);
}
setChecked(true);
}, [router]);

const load = useCallback(async () => {
setLoading(true);

const { data: profileRows } = await supabase.from("profiles").select("id, username");
const byId = new Map((profileRows || []).map((p) => [p.id, p.username]));

const { data: appRows, error: appError } = await supabase
.from("appetizers")
.select("id, name, photo_url, made_by, co_maker_id, category")
.eq("category", "dessert");

if (!appError && appRows) {
const { data: ratingRows } = await supabase
.from("ratings")
.select("appetizer_id, rating, profile_id, profiles(username)");

const ratingsByApp = new Map();
for (const row of ratingRows || []) {
if (!ratingsByApp.has(row.appetizer_id)) ratingsByApp.set(row.appetizer_id, []);
ratingsByApp.get(row.appetizer_id).push(row);
}

const result = appRows.map((a) => {
const ratings = ratingsByApp.get(a.id) || [];
const avg = ratings.length
? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
: null;
return {
id: a.id,
name: a.name,
photo_url: a.photo_url,
made_by: a.made_by,
co_maker_id: a.co_maker_id,
made_by_name: byId.get(a.made_by),
co_maker_name: a.co_maker_id ? byId.get(a.co_maker_id) : null,
avg,
count: ratings.length,
ratings: ratings.map((r) => ({
username: r.profiles ? r.profiles.username : "?",
rating: r.rating,
})),
};
});

result.sort((a, b) => {
if (a.avg == null && b.avg == null) return 0;
if (a.avg == null) return 1;
if (b.avg == null) return -1;
return b.avg - a.avg;
});

const withPhotos = await attachSignedUrls(result);
setAppetizers(withPhotos);
}
setLoading(false);
}, []);

useEffect(() => {
if (!user) return;
load();
}, [user, load]);

async function handleDelete(a) {
if (!window.confirm(`Delete "${a.name}"? This can't be undone.`)) return;
if (a.photo_url) {
await supabase.storage.from("appetizer-photos").remove([a.photo_url]);
}
await supabase.from("appetizers").delete().eq("id", a.id);
await load();
}

function goToAppetizer(id) {
router.push(`/appetizer/?id=${id}`);
}

if (!checked || !user) return null;

return (
<div className="page">
<NavBar user={user} active="rankings-dessert" title={"🍰 Dessert Rankings"} />
<p className="sub-note">The dessert leaderboard, ranked by average rating.</p>

{loading ? (
<p className="empty">Loading rankings...</p>
) : appetizers.length === 0 ? (
<p className="empty">No desserts yet. Add some from the Home page.</p>
) : (
<div className="card-list">
{appetizers.map((a, index) => (
<div
className={`app-card${index === 0 ? " rank-1" : ""}`}
key={a.id}
role="button"
tabIndex={0}
onClick={() => goToAppetizer(a.id)}
onKeyDown={(e) => {
if (e.key === "Enter") goToAppetizer(a.id);
}}
>
<div className={`rank-badge${index < 3 ? " medal" : ""}`}>
{index < 3 ? RANK_MEDALS[index] : `#${index + 1}`}
</div>
{a.photo_signed_url ? (
<img src={a.photo_signed_url} alt={a.name} />
) : (
<div className="photo-fallback">🍽️</div>
)}
<div className="app-info">
<div className="title-row">
<span className="title">{a.name}</span>
</div>
<div className="makers">{makerLabel(a, user.id)}</div>
<div className="avg-badge">
{a.avg
? `${RATING_LABELS[Math.round(a.avg)]} - ${a.avg.toFixed(1)} avg`
: "No ratings yet"}
{a.count > 0 && ` - ${a.count} rating${a.count === 1 ? "" : "s"}`}
</div>
{a.ratings.length > 0 && (
<div className="friend-ratings">
{a.ratings.map((r) => (
<span className="friend-pill" key={r.username}>
{r.username}: {RATING_LABELS[r.rating] || r.rating}
</span>
))}
</div>
)}
</div>
{a.made_by === user.id && (
<button
className="delete-btn"
title="Delete appetizer"
onClick={(e) => {
e.stopPropagation();
handleDelete(a);
}}
>
🗑️
</button>
)}
</div>
))}
</div>
)}
</div>
);
}
