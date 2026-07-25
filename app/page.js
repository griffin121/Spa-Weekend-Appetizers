"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import NavBar from "./NavBar";
const { getCurrentUser } = require("../lib/currentUser");

const RATING_LABELS = {
    1: "\ud83d\udca9 Ass Appetizer",
    2: "\ud83d\ude12 Not Good Appetizer",
    3: "\ud83c\udf7d\ufe0f Appetizer",
    4: "\ud83d\udc4d Good Appetizer",
    5: "\ud83d\udd25 Good Ass Appetizer",
};

function makerLabel(app, myId) {
    const madeByYou = app.made_by === myId;
    const withYou = app.co_maker_id === myId;
    const maker = madeByYou ? "You" : app.made_by_name || "?";
    if (!app.co_maker_id) return `\ud83e\uddd1\u200d\ud83c\udf73 Solo by ${maker}`;
    const co = withYou ? "You" : app.co_maker_name || "?";
    return `\ud83e\uddd1\u200d\ud83c\udf73 ${maker} & ${co}`;
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

export default function HomePage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [checked, setChecked] = useState(false);

const [profiles, setProfiles] = useState([]);
    const [appetizers, setAppetizers] = useState([]);
    const [loading, setLoading] = useState(true);

const [name, setName] = useState("");
    const [photoFile, setPhotoFile] = useState(null);
    const [madeWith, setMadeWith] = useState("solo");
    const [coMakerId, setCoMakerId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

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
    const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, username")
    .order("username", { ascending: true });
    setProfiles(profileRows || []);

                         const { data: appRows } = await supabase
    .from("appetizers")
    .select("id, name, photo_url, made_by, co_maker_id, created_at")
    .order("created_at", { ascending: false });

                         const { data: ratingRows } = await supabase
    .from("ratings")
    .select("appetizer_id, rating");

                         const byId = new Map((profileRows || []).map((p) => [p.id, p.username]));
    const ratingsByApp = new Map();
    for (const r of ratingRows || []) {
        if (!ratingsByApp.has(r.appetizer_id)) ratingsByApp.set(r.appetizer_id, []);
        ratingsByApp.get(r.appetizer_id).push(r.rating);
    }

                         const enriched = (appRows || []).map((a) => {
                             const ratings = ratingsByApp.get(a.id) || [];
                             const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
                             return {
                                 ...a,
                                 made_by_name: byId.get(a.made_by),
                                 co_maker_name: a.co_maker_id ? byId.get(a.co_maker_id) : null,
                                 avg,
                                 count: ratings.length,
                             };
                         });

                         const withPhotos = await attachSignedUrls(enriched);
    setAppetizers(withPhotos);
    setLoading(false);
}, []);

useEffect(() => {
    if (!user) return;
    load();
}, [user, load]);

async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    if (!cleanName) {
        setError("Give your appetizer a name.");
        return;
    }
    if (madeWith === "with" && !coMakerId) {
        setError("Pick who you made it with, or choose solo.");
        return;
    }

    setSubmitting(true);
    try {
        let photo_url = null;
        if (photoFile) {
            const path = `${Date.now()}-${photoFile.name}`;
            const { error: uploadError } = await supabase.storage
            .from("appetizer-photos")
            .upload(path, photoFile);
            if (!uploadError) {
                photo_url = path;
            }
        }

    await supabase.from("appetizers").insert({
        name: cleanName,
        photo_url,
        made_by: user.id,
        co_maker_id: madeWith === "with" ? coMakerId : null,
    });

    setName("");
        setPhotoFile(null);
        setMadeWith("solo");
        setCoMakerId("");
        await load();
    } finally {
        setSubmitting(false);
    }
}

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

const otherProfiles = profiles.filter((p) => p.id !== user.id);

return (
    <div className="page">
      <NavBar user={user} active="home" title={"🥂 Spa Weekend Appetizers"} />
    <p className="sub-note">Submit your homemade appetizer and see what everyone else brought.</p>

<div className="submit-card">
    <div className="section-heading" style={{ margin: "0 0 14px" }}>
      ➕ Add an appetizer
    </div>
<form onSubmit={handleSubmit}>
    <label htmlFor="name">What did you make?</label>
<input
id="name"
type="text"
        placeholder={"e.g. Bacon-wrapped jalapeño poppers"}
value={name}
onChange={(e) => setName(e.target.value)}
required
/>

    <label htmlFor="photo">Photo (optional)</label>
<input
id="photo"
type="file"
accept="image/*"
onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
/>

    <label>Who made it?</label>
<div className="radio-row">
    <button
type="button"
className={`radio-chip${madeWith === "solo" ? " active" : ""}`}
onClick={() => setMadeWith("solo")}
>
          🧑‍🍳 Just me
    </button>
<button
type="button"
className={`radio-chip${madeWith === "with" ? " active" : ""}`}
onClick={() => setMadeWith("with")}
>
          🤝 Made it with someone
    </button>
    </div>

{madeWith === "with" && (
    <select value={coMakerId} onChange={(e) => setCoMakerId(e.target.value)}>
<option value="">Select who you made it with...</option>
{otherProfiles.map((p) => (
    <option key={p.id} value={p.id}>
{p.username}
    </option>
))}
    </select>
)}

{error && <p className="error">{error}</p>}

<button className="btn" style={{ marginTop: 18, width: "100%" }} disabled={submitting}>
{submitting ? "Adding..." : "\ud83c\udf7d\ufe0f Add appetizer"}
</button>
    </form>
    </div>

  <div className="section-heading">📜 Recently added</div>
{loading ? (
    <p className="empty">Loading...</p>
    ) : appetizers.length === 0 ? (
    <p className="empty">No appetizers yet. Be the first to add one!</p>
 ) : (
     <div className="card-list">
     {appetizers.map((a) => (
     <div
                     className="app-card"
      key={a.id}
 role="button"
 tabIndex={0}
 onClick={() => goToAppetizer(a.id)}
 onKeyDown={(e) => {
     if (e.key === "Enter") goToAppetizer(a.id);
 }}
>
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
{a.avg ? `${RATING_LABELS[Math.round(a.avg)]} \u00b7 ${a.avg.toFixed(1)} avg` : "No ratings yet"}
{a.count > 0 && ` \u00b7 ${a.count} rating${a.count === 1 ? "" : "s"}`}
</div>
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
