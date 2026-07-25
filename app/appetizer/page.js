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

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

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
      const [profiles, setProfiles] = useState([]);
      const [ratings, setRatings] = useState([]);
      const [comments, setComments] = useState([]);
      const [reactions, setReactions] = useState([]);
      const [commentText, setCommentText] = useState("");
      const [postingComment, setPostingComment] = useState(false);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState("");
      const [justRated, setJustRated] = useState(false);
      const [deleting, setDeleting] = useState(false);
      const [uploadingPhoto, setUploadingPhoto] = useState(false);
      const [editingChef, setEditingChef] = useState(false);
      const [chefId, setChefId] = useState("");
      const [chefWith, setChefWith] = useState("solo");
      const [coMakerId, setCoMakerId] = useState("");
      const [savingChef, setSavingChef] = useState(false);
      const [chefError, setChefError] = useState("");

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

            const { data: profileRows } = await supabase
                      .from("profiles")
                      .select("id, username")
                      .order("username", { ascending: true });
                    setProfiles(profileRows || []);
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

            const { data: commentRows } = await supabase
                      .from("comments")
                      .select("id, profile_id, body, created_at, profiles(username)")
                      .eq("appetizer_id", appetizerId)
                      .order("created_at", { ascending: true });
                    setComments(commentRows || []);

            const commentIds = (commentRows || []).map((c) => c.id);
                    if (commentIds.length > 0) {
                                const { data: reactionRows } = await supabase
                                  .from("comment_reactions")
                                  .select("id, comment_id, profile_id, emoji")
                                  .in("comment_id", commentIds);
                                setReactions(reactionRows || []);
                    } else {
                                setReactions([]);
                    }
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

  async function handlePhotoChange(e) {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          if (!file || !appetizer) return;
          setUploadingPhoto(true);
          try {
                    const path = `${appetizer.id}-${Date.now()}-${file.name}`;
                    const { error: uploadError } = await supabase.storage
                      .from("appetizer-photos")
                      .upload(path, file);
                    if (uploadError) return;
                    const oldPath = appetizer.photo_url;
                    await supabase.from("appetizers").update({ photo_url: path }).eq("id", appetizer.id);
                    if (oldPath) {
                                await supabase.storage.from("appetizer-photos").remove([oldPath]);
                    }
                    await load();
          } finally {
                    setUploadingPhoto(false);
          }
  }

  function handleStartEditChef() {
          if (!appetizer) return;
          setChefId(appetizer.made_by || "");
          setChefWith(appetizer.co_maker_id ? "with" : "solo");
          setCoMakerId(appetizer.co_maker_id || "");
          setChefError("");
          setEditingChef(true);
  }

  function handleCancelEditChef() {
          setEditingChef(false);
          setChefError("");
  }

  async function handleSaveChef(e) {
          e.preventDefault();
          if (!chefId) {
                    setChefError("Pick who made it.");
                    return;
          }
          if (chefWith === "with" && !coMakerId) {
                    setChefError("Pick who they made it with, or choose solo.");
                    return;
          }
          if (chefWith === "with" && coMakerId === chefId) {
                    setChefError("Chef and co-chef can't be the same person.");
                    return;
          }
          setChefError("");
          setSavingChef(true);
          try {
                    await supabase
                      .from("appetizers")
                      .update({
                                    made_by: chefId,
                                    co_maker_id: chefWith === "with" ? coMakerId : null,
                      })
                      .eq("id", appetizer.id);
                    setEditingChef(false);
                    await load();
          } finally {
                    setSavingChef(false);
          }
  }

  async function handlePostComment(e) {
          e.preventDefault();
          const body = commentText.trim();
          if (!body || !appetizer || !user) return;
          setPostingComment(true);
          try {
                    await supabase.from("comments").insert({
                                appetizer_id: appetizer.id,
                                profile_id: user.id,
                                body,
                    });
                    setCommentText("");
                    await load();
          } finally {
                    setPostingComment(false);
          }
  }

  async function handleDeleteComment(commentId) {
          if (!window.confirm("Delete this comment?")) return;
          await supabase.from("comments").delete().eq("id", commentId);
          await load();
  }

  async function handleToggleReaction(commentId, emoji) {
          if (!user) return;
          const existing = reactions.find(
                    (r) => r.comment_id === commentId && r.profile_id === user.id && r.emoji === emoji
                  );
          if (existing) {
                    await supabase.from("comment_reactions").delete().eq("id", existing.id);
          } else {
                    await supabase.from("comment_reactions").insert({
                                comment_id: commentId,
                                profile_id: user.id,
                                emoji,
                    });
          }
          await load();
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
                  <div className="photo-col">
  {appetizer.photo_signed_url ? (
                      <img src={appetizer.photo_signed_url} alt={appetizer.name} />
              ) : (
                                  <div className="photo-fallback">🍽️</div>
                                )}
                                <label className={"photo-upload-btn" + (uploadingPhoto ? " uploading" : "")}>
{uploadingPhoto
                  ? "Uploading..."
                      : appetizer.photo_signed_url
                   ? "📷 Change photo"
                      : "📷 Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                  style={{ display: "none" }}
                />
                    </label>
                    </div>
            <div className="detail-info">
                                  <h2>{appetizer.name}</h2>

{editingChef ? (
                    <form className="chef-edit-form" onSubmit={handleSaveChef}>
                      <label className="sub-note">Who made it?</label>
                   <div className="radio-row">
                        <button
                       type="button"
                       className={"radio-chip" + (chefWith === "solo" ? " active" : "")}
                      onClick={() => setChefWith("solo")}
                    >
                                                🧑‍🍳 Solo
                          </button>
                    <button
                      type="button"
                      className={"radio-chip" + (chefWith === "with" ? " active" : "")}
                      onClick={() => setChefWith("with")}
                    >
                      🤝 With someone
                          </button>
                          </div>
                  <select value={chefId} onChange={(e) => setChefId(e.target.value)}>
                    <option value="">Select chef...</option>
{profiles.map((p) => (
                          <option key={p.id} value={p.id}>
{p.id === user.id ? "You" : p.username}
</option>
                    ))}
                        </select>
{chefWith === "with" && (
                        <select value={coMakerId} onChange={(e) => setCoMakerId(e.target.value)}>
                      <option value="">Select co-chef...</option>
{profiles
                         .filter((p) => p.id !== chefId)
                         .map((p) => (
                                                       <option key={p.id} value={p.id}>
{p.id === user.id ? "You" : p.username}
</option>
                        ))}
                            </select>
                  )}
{chefError && <p className="error">{chefError}</p>}
                   <div className="chef-edit-actions">
                        <button type="submit" className="btn small" disabled={savingChef}>
{savingChef ? "Saving..." : "Save"}
</button>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={handleCancelEditChef}
                    >
                                                Cancel
                          </button>
                          </div>
                          </form>
              ) : (
                                  <div className="maker-row">
                                    <p className="sub-note" style={{ margin: 0 }}>
{makerLabel(appetizer, user.id)}
</p>
                  <button
                    className="edit-chef-btn"
                    onClick={handleStartEditChef}
                    title="Edit chef"
                  >
✏️
                        </button>
                        </div>
              )}

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

          <div className="comments-section">
                <h3 className="section-heading">💬 Comments</h3>
            <form className="comment-form" onSubmit={handlePostComment}>
                  <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
              />
                                  <button type="submit" className="btn" disabled={postingComment || !commentText.trim()}>
{postingComment ? "Posting..." : "Post"}
</button>
    </form>

            <div className="comment-list">
{comments.length === 0 && <p className="empty">No comments yet.</p>}
{comments.map((c) => (
                    <div className="comment-card" key={c.id}>
                  <div className="comment-header">
                        <span className="comment-author">{c.profiles ? c.profiles.username : "?"}</span>
                    <span className="comment-time">
{new Date(c.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
})}
</span>
{c.profile_id === user.id && (
                          <button
                         className="comment-delete"
                         onClick={() => handleDeleteComment(c.id)}
                         title="Delete comment"
                       >
                                                     x
                             </button>
                                                 )}
</div>
                  <p className="comment-body">{c.body}</p>
                  <div className="reaction-row">
{REACTION_EMOJIS.map((emoji) => {
                          const reactors = reactions.filter(
                                                      (r) => r.comment_id === c.id && r.emoji === emoji
                                                    );
                          const mineReaction = reactors.some((r) => r.profile_id === user.id);
                          return (
                                                      <button
                              key={emoji}
                              className={"reaction-chip" + (mineReaction ? " active" : "")}
                                               onClick={() => handleToggleReaction(c.id, emoji)}
                        >
{emoji}
{reactors.length > 0 && (
                                <span className="reaction-count">{reactors.length}</span>
                           )}
</button>
                      );
})}
</div>
    </div>
              ))}
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
