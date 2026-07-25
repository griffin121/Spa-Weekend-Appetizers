"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import NavBar from "../NavBar";
const { getCurrentUser } = require("../../lib/currentUser");

const RATING_LABELS = {
    1: "💩 Ass Appetizer",
    2: "😒 Not Good Appetizer",
    3: "🍽️ Appetizer",
    4: "👍 Good Appetizer",
    5: "🔥 Good Ass Appetizer",
};

function makerLabel(app, myId) {
    const madeByYou = app.made_by === myId;
    const withYou = app.co_maker_id === myId;
    const maker = madeByYou ? "You" : app.made_by_name || "?";
    if (!app.co_maker_id) return `🧑‍🍳 Solo by ${maker}`;
    const co = withYou ? "You" : app.co_maker_name || "?";
    return `🧑‍🍳 ${maker} & ${co}`;
}

function AppetizerDetailInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const appetizerId = searchParams.get("id");

const [user, setUser] = useState(null);
    const [checked, setChecked] = useState(false);

const [appetizer, setAppetizer] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [justRated, setJustRated] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
    if (!appetizerId) {
        setError("No appetizer specified.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError("");
    try {
        const { data: appRow, error: appError } = await supabase
        .from("appetizers")
        .select("*")
        .eq("id", appetizerId)
        .maybeSingle();

    if (appError || !appRow) {
        setError("Appetizer not found.");
        setLoading(false);
        return;
    }

    const { data: profileRows } = await supabase.from("profiles").select("id, username");
        const byId = new Map((profileRows || []).map((p) => [p.id, p.username]));

    let photo_signed_url = null;
        if (appRow.photo_url) {
            const { data: signedData } = await supabase.storage
            .from("appetizer-photos")
            .createSignedUrl(appRow.photo_url, 604800);
            photo_signed_url = signedData ? signedData.signedUrl : null;
        }

    setAppetizer({
        ...appRow,
        photo_signed_url,
        made_by_name: byId.get(appRow.made_by),
        co_maker_name: appRow.co_maker_id ? byId.get(appRow.co_maker_id) : null,
    });

    const { data: ratingRows } = await supabase
        .from("ratings")
        .select("rating, profile_id, updated_at, profiles(username)")
        .eq("appetizer_id", appetizerId);
        setRatings(ratingRows || []);
    } finally {
        setLoading(false);
    }
}, [appetizerId]);

useEffect(() => {
    if (!user) return;
    load();
}, [user, load]);

async function handleRate(rating) {
    if (!appetizer) return;
    if (appetizer.made_by === user.id) return;
    await supabase.from("ratings").upsert(
        {
            appetizer_id: appetizer.id,
            profile_id: user.id,
            rating,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "appetizer_id,profile_id" }
        );
    setJustRated(true);
    setTimeout(() => setJustRated(false), 1800);
    await load();
}

async function handleDelete() {
    if (!appetizer) return;
    if (!window.confirm(`Delete "${appetizer.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
        if (appetizer.photo_url) {
            await supabase.storage.from("appetizer-photos").remove([appetizer.photo_url]);
        }
        await supabase.from("appetizers").delete().eq("id", appetizer.id);
        router.push("/");
    } finally {
        setDeleting(false);
    }
}

if (!checked || !user) return null;

const avg = ratings.length
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : null;
    const mine = ratings.find((r) => r.profile_id === user.id);
    const myRating = mine ? mine.rating : null;
    const isCreator = appetizer && appetizer.made_by === user.id;

return (
    <div className="page">
    <NavBar user={user} active="" title={"🍽️ Appetizer"} />

{loading ? (
    <p className="empty">Loading...</p>
    ) : error ? (
    <p className="error">{error}</p>
    ) : (
    <>
    <div className="detail-hero">
{appetizer.photo_signed_url ? (
    <img src={appetizer.photo_signed_url} alt={appetizer.name} />
) : (
    <div className="photo-fallback">🍽️</div>
    )}
    <div className="detail-info">
    <h2>{appetizer.name}</h2>
<p className="sub-note" style={{ margin: "0 0 10px" }}>
{makerLabel(appetizer, user.id)}
</p>

<div className="avg-badge">
{avg ? `${RATING_LABELS[Math.round(avg)]} - ${avg.toFixed(1)} avg` : "No ratings yet"}
{ratings.length > 0 &&
    ` - ${ratings.length} rating${ratings.length === 1 ? "" : "s"}`}
</div>

{isCreator ? (
    <p className="sub-note" style={{ marginTop: 12 }}>
🙅 You can't rate your own appetizer.
    </p>
) : (
    <>
    <div className="rate-buttons">
{[1, 2, 3, 4, 5].map((n) => (
    <button
                     key={n}
className={myRating === n ? "active" : ""}
    onClick={() => handleRate(n)}
title={RATING_LABELS[n]}
>
{RATING_LABELS[n]}
</button>
))}
</div>
{justRated && <span className="rating-flash">Rating saved!</span>}
 {mine && mine.updated_at && (
     <div className="rating-updated">
     You rated this{" "}
  {new Date(mine.updated_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
  })}
  </div>
  )}
 </>
 )}

{ratings.length > 0 && (
    <div className="friend-ratings" style={{ marginTop: 12 }}>
{ratings.map((r) => (
    <span className="friend-pill" key={r.profile_id}>
{r.profiles ? r.profiles.username : "?"}: {RATING_LABELS[r.rating] || r.rating}
</span>
))}
</div>
)}

{appetizer.made_by === user.id && (
    <button
 className="btn danger"
 style={{ marginTop: 18 }}
onClick={handleDelete}
disabled={deleting}
>
{deleting ? "Deleting..." : "🗑️ Delete appetizer"}
</button>
)}
</div>
    </div>
    </>
)}
</div>
);
}

export default function AppetizerDetailPage() {
    return (
        <Suspense fallback={null}>
        <AppetizerDetailInner />
        </Suspense>
    );
}
