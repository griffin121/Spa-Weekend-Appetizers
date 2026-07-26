import { supabase } from "./supabaseClient";

export function getNextLockTime() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(14, 0, 0, 0);
    if (target <= now) {
          target.setDate(target.getDate() + 1);
    }
    return target;
}

export function isPastLockTime() {
    const now = new Date();
    const today2pm = new Date(now);
    today2pm.setHours(14, 0, 0, 0);
    return now >= today2pm;
}

export async function getTotalProfileCount() {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    return count || 0;
}

export async function fetchRankedList(category) {
    const { data: appRows } = await supabase
      .from("appetizers")
      .select("id, name, photo_url, made_by, co_maker_id, category")
      .eq("category", category);

  const { data: ratingRows } = await supabase
      .from("ratings")
      .select("appetizer_id, rating");

  const ratingsByApp = new Map();
    for (const r of ratingRows || []) {
          if (!ratingsByApp.has(r.appetizer_id)) ratingsByApp.set(r.appetizer_id, []);
          ratingsByApp.get(r.appetizer_id).push(r.rating);
    }

  const result = (appRows || []).map((a) => {
        const ratings = ratingsByApp.get(a.id) || [];
        const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
        return { ...a, avg, count: ratings.length };
  });

  result.sort((a, b) => {
        if (a.avg == null && b.avg == null) return 0;
        if (a.avg == null) return 1;
        if (b.avg == null) return -1;
        return b.avg - a.avg;
  });

  return result;
}

function pairSeeds(entries) {
    const pairs = [];
    let lo = 0;
    let hi = entries.length - 1;
    let slot = 0;
    while (lo < hi) {
          pairs.push({ slot, a: entries[lo], b: entries[hi] });
          lo++;
          hi--;
          slot++;
    }
    if (lo === hi) {
          pairs.push({ slot, a: entries[lo], b: null });
    }
    return pairs;
}

export async function ensureTournament(category) {
    const { data: existing } = await supabase
      .from("tournaments")
      .select("*")
      .eq("category", category)
      .maybeSingle();

  if (existing) return existing;

  if (!isPastLockTime()) return null;

  const ranked = await fetchRankedList(category);
    if (ranked.length < 2) return null;

  const { data: created, error } = await supabase
      .from("tournaments")
      .insert({ category, status: "active", locked_at: new Date().toISOString() })
      .select()
      .maybeSingle();

  if (error || !created) {
        const { data: refetched } = await supabase
          .from("tournaments")
          .select("*")
          .eq("category", category)
          .maybeSingle();
        return refetched || null;
  }

  const entriesPayload = ranked.map((a, index) => ({
        tournament_id: created.id,
        appetizer_id: a.id,
        seed: index,
  }));
    await supabase.from("tournament_entries").insert(entriesPayload);

  const sortedBySeed = entriesPayload
      .map((e) => ({ appetizer_id: e.appetizer_id, seed: e.seed }))
      .sort((x, y) => x.seed - y.seed);

  const pairs = pairSeeds(sortedBySeed);

  const matchesPayload = pairs.map((p) => ({
        tournament_id: created.id,
        round: 1,
        slot: p.slot,
        appetizer_a_id: p.a.appetizer_id,
        appetizer_b_id: p.b ? p.b.appetizer_id : null,
        winner_id: p.b ? null : p.a.appetizer_id,
        status: p.b ? "active" : "completed",
  }));

  await supabase.from("tournament_matches").insert(matchesPayload);

  await maybeAdvanceRound(created.id, 1);

  const { data: refreshed } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", created.id)
      .maybeSingle();
    return refreshed;
}

                                     export async function maybeAdvanceRound(tournamentId, round) {
                                         const { data: matches } = await supabase
                                           .from("tournament_matches")
                                           .select("*")
                                           .eq("tournament_id", tournamentId)
                                           .eq("round", round);

  if (!matches || matches.length === 0) return;
                                         const allDone = matches.every((m) => m.status === "completed" && m.winner_id);
                                         if (!allDone) return;

  if (matches.length === 1) {
        const championId = matches[0].winner_id;
        await supabase
          .from("tournaments")
          .update({ status: "completed", champion_id: championId })
          .eq("id", tournamentId);
        return;
  }

  const { data: nextRoundMatches } = await supabase
                                           .from("tournament_matches")
                                           .select("id")
                                           .eq("tournament_id", tournamentId)
                                           .eq("round", round + 1);

  if (nextRoundMatches && nextRoundMatches.length > 0) return;

  const { data: entries } = await supabase
                                           .from("tournament_entries")
                                           .select("appetizer_id, seed")
                                           .eq("tournament_id", tournamentId);

  const seedByAppetizer = new Map((entries || []).map((e) => [e.appetizer_id, e.seed]));

  const winners = matches
                                           .map((m) => ({ appetizer_id: m.winner_id, seed: seedByAppetizer.get(m.winner_id) ?? 0 }))
                                           .sort((a, b) => a.seed - b.seed);

  const pairs = pairSeeds(winners);

  const nextMatchesPayload = pairs.map((p) => ({
        tournament_id: tournamentId,
        round: round + 1,
        slot: p.slot,
        appetizer_a_id: p.a.appetizer_id,
        appetizer_b_id: p.b ? p.b.appetizer_id : null,
        winner_id: p.b ? null : p.a.appetizer_id,
        status: p.b ? "active" : "completed",
  }));

  const { error: insertError } = await supabase
                                           .from("tournament_matches")
                                           .insert(nextMatchesPayload);
                                         if (insertError) return;

  await maybeAdvanceRound(tournamentId, round + 1);
                                     }

export async function castVote(match, profileId, votedForId, totalProfiles) {
    await supabase.from("tournament_votes").upsert(
      { match_id: match.id, profile_id: profileId, voted_for_id: votedForId },
      { onConflict: "match_id,profile_id" }
        );

  const { data: votes } = await supabase
      .from("tournament_votes")
      .select("voted_for_id")
      .eq("match_id", match.id);

  const tally = new Map();
    for (const v of votes || []) {
          tally.set(v.voted_for_id, (tally.get(v.voted_for_id) || 0) + 1);
    }

  const threshold = Math.floor(totalProfiles / 2) + 1;

  for (const [appetizerId, count] of tally.entries()) {
        if (count >= threshold) {
                await supabase
                  .from("tournament_matches")
                  .update({ winner_id: appetizerId, status: "completed" })
                  .eq("id", match.id)
                  .eq("status", "active");
                await maybeAdvanceRound(match.tournament_id, match.round);
                return { decided: true, winner: appetizerId };
        }
  }

  return { decided: false };
}
