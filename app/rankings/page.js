"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function makerLabel(app, myId) {
  const madeByYou = app.made_by === myId;
  const withYou = app.co_maker_id === myId;
  const maker = madeByYou ? "You" : app.made_by_name || "?";
  if (!app.co_maker_id) return `🧑‍🍳 Solo by ${maker}`;
  const co = withYou ? "You" : app.co_maker_name || "?";
  return `🧑‍🍳 ${maker} & ${co}`;
}

export default function RankingsPage() {
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: profileRows } = await supabase.from("profiles").select("id, username");
      const byId = new Map((profileRows || []).map((p) => [p.id, p.username]));

      const { data: appRows, error: appError } = await supabase
        .from("appetizers")
        .select("id, name, photo_url, made_by, co_maker_id");

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

        setAppetizers(result);
      }
      setLoading(false);
    })();
  }, [user]);

  if (!checked || !user) return null;

  return (
    <div className="page">
      <NavBar user={user} active="rankings" title="🏆 Rankings" />
      <p className="sub-note">The full group leaderboard, ranked by average rating.</p>

      {loading ? (
        <p className="empty">Loading rankings...</p>
      ) : appetizers.length === 0 ? (
        <p className="empty">No appetizers yet. Add some from the Home page.</p>
      ) : (
        <div className="card-list">
          {appetizers.map((a, index) => (
            <div className={`app-card${index === 0 ? " rank-1" : ""}`} key={a.id}>
              <div className={`rank-badge${index < 3 ? " medal" : ""}`}>
                {index < 3 ? RANK_MEDALS[index] : `#${index + 1}`}
              </div>
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.name} />
              ) : (
                <div className="photo-fallback">🍽️</div>
              )}
              <div className="app-info">
                <div className="title-row">
                  <Link href={`/appetizer/?id=${a.id}`} className="title">
                    {a.name}
                  </Link>
                </div>
                <div className="makers">{makerLabel(a, user.id)}</div>
                <div className="avg-badge">
                  {a.avg
                    ? `${RATING_LABELS[Math.round(a.avg)]} · ${a.avg.toFixed(1)} avg`
                    : "No ratings yet"}
                  {a.count > 0 && ` · ${a.count} rating${a.count === 1 ? "" : "s"}`}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
