import express from 'express';
import {createAnonClient, supabaseAdmin} from '../database/config/supabaseClient.js';
import { requireUser } from '../backendapp.js';
import 'dotenv/config';
import { fetchQuestionsInRounds } from '../game_helpers/dbqueires.js';

const router = express.Router();

// route to create a new match
router.post('/createNewMatch', requireUser, async (req, res) => {
  try {
    const { title, category, rounds, users} = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Missing required fields: title, host_user_id' });
    }

    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }
    

    const {data: user_id, error: userError} = await supabaseAdmin
      .from('Users')
      .select("id, username, role")
      .eq("auth_user_id", authUserId)
      .single();
    
    if (userError) {
      console.error('Error fetching user_id: ', userError);
      return res.status(500).json({
        ok: false,
        error: "Error fetching user_id: " + userError.message
      })
    }

    const {data: catData, error: catError} = await supabaseAdmin
      .from('categories')
      .select('*')
      .ilike("name", category)
      .single();

    if (catError) {
      console.error('Error fetching catagories: ', catError);
      return res.status(500).json({
        ok: false,
        error: "Error fetching catagories: " + catError.message
      })
    }

    const cat_id = catData.cat_id;
    // create match
    const { data: newMatch, error: matchError } = await req.supabase
      .from('matches')
      .insert([{
        title: title,
        host_user_id: user_id.id,
        status: "lobby",
        category_id: cat_id
      }])
      .select()
      .single();
    if (matchError) {
      console.error('Error creating match:', matchError);
      return res.status(500).json({
        ok: false,
        error: "Error creating match: " + matchError.message
      });
    }

    await fetchQuestionsInRounds(cat_id, rounds, newMatch.match_id);

    // add host as a player in the match
    const { data: hostPlayer, error: playerError } = await req.supabase
      .from('match_players')
      .insert([{
        match_id: newMatch.match_id,
        user_id: user_id.id
      }])
      .select()
      .single();

    if (playerError) {
      console.error('Error adding host to match:', playerError);
      return res.status(500).json({
        ok: false,
        error: "Match created but error adding host as player: " + playerError.message,
        match: newMatch
      });
    }
    
    const { data: found, error: findErr } = await supabaseAdmin
    .from('Users')
    .select('id')
    .in('username', users);  

    if (findErr) {
      console.error('Error adding host to match:', findErr);
      return res.status(500).json({
        ok: false,
        error: "Match created but error inviting users: " + findErr.message,
        match: newMatch
      });
    }

    const rows = []


    for (const name of found) {
      rows.push({
        match_id: newMatch.match_id,
        invited_user_id: name.id,
      })
    }
    const {data: invitedUsers, error: invitedError} = await supabaseAdmin
    .from('match_invitations')
    .insert(rows)

    if (invitedError) {
      console.error('Error adding users to match:', invitedError);
      return res.status(500).json({
        ok: false,
        error: "Match created but error adding user invitations: " + invitedError.message,
        match: newMatch
      });
    }


    return res.status(201).json({
      ok: true,
      message: "Match created successfully and host added as player",
      match: newMatch,
      hostPlayer: hostPlayer,
      invitedUsers: invitedUsers
    });
    
  } catch (err) {
    console.error('Error in createNewMatch endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
})

router.post('/searchMatch', async (req, res) => {
  try {
    console.log("1")
    let {title = "", cat = "None"} = req.body;
    if (title == null) {
      title = "";
    }
    if (cat === "None") {
      cat = "";
    }
    const {data: catagory, error: categoryError} = await supabaseAdmin
    .from("categories")
    .select("cat_id, name")
    .ilike("name", `%${cat}%`);

    console.log(catagory)
    if (categoryError) {
    return res.status(500).json({ error: 'Failed to fetch category', detail: categoryError.message });
  }
  if (!catagory?.length) {
      return res.json({
        ok: true,
        message: "No categories found",
        matchArray: [],
      });
    }

    console.log("3")
    const catIds = catagory.map((c) => c.cat_id);
  const {data: matches, error: matchesError} = await supabaseAdmin
  .from("matches")
  .select("match_id, status, title, category_id")
    .ilike("title", `%${title}%`)
    .in("category_id", catIds);

    console.log(matches)
     if (matchesError) {
      return res.status(500).json({ error: 'Failed to fetch matches', detail: matchesError.message });
    }
    
    

    const matchArray = Array.isArray(matches) ? matches : [];

     const categoryMap = new Map(
      catagory.map((c) => [c.cat_id, c.name])
    );

    console.log("5")
    const formattedMatches = matchArray.map((m) => ({
      match_id: m.match_id,
      status: m.status,
      title: m.title,
      category: categoryMap.get(m.category_id) || "Unknown",
    }));
    console.log(formattedMatches)
    return res.status(201).json({
      ok: true,
      message: "Matches succsefully sourced",
      formattedMatches
    });
  
  } catch (err) {
  res.status(500).json({ error: 'Unexpected error', detail: err?.message || String(err) });
}
})

router.post('/getLeaderBoardScores', async (req, res) => {
  try {
    const {period = "Daily", sort = "Rank Descending", name = ""} = req.body;
    
    const now = new Date();
    const start = new Date(now);
    switch (period) {
      case "Daily" :
        start.setDate(start.getDate() - 1);
        break;
      case "Weekly" :
        start.setDate(start.getDate() - 7);
        break;
      case "Yearly" : 
        start.setFullYear(start.getFullYear() -1);
        break;
      default:
        start.setDate(start.getDate() - 1);
        break;
    }



    const startISO = start.toISOString();
    const endISO = now.toISOString();

    const {data: matches, error: matchesError} = await supabaseAdmin
    .from("matches")
    .select("match_id, title, category_id")
    .gte("completed_at", startISO)
    .lte("completed_at", endISO)
    .eq('status', 'completed')

  if (matchesError) {
    return res.status(500).json({ error: 'Failed to fetch matches 1 ', detail: matchesError.message });
  }


  const match_id = (matches || []).map(m => m.match_id);

  if (match_id.length === 0) {
    
    return res.json({leaderboard: [] });
  }

  let allowedUserIds = null;
  let userIdToName = new Map();

  if (name && String(name).trim() !== '') {
    const {data: users, error: userError} = await supabaseAdmin
      .from("Users")
      .select("id, username")
      .ilike("username", `%${name}%`);

    if (userError) {
      
      return res.status(500).json({ error: 'Failed to fetch matches 2 ', detail: userError.message });
    }

    allowedUserIds = new Set(users.map(u => u.id));
    users.forEach(u => userIdToName.set(u.id, u.username));
    
    if (allowedUserIds.size === 0) {
      return res.json({leaderboard: []});
    }
  }

  let scoresQuery = supabaseAdmin
  .from('match_scores')
  .select('user_id, points, match_id')
  .in('match_id', match_id)

  if (allowedUserIds) {
    const ids = [...allowedUserIds]
      .filter(v => v !=null)
      .map(String);

      if (ids.length === 0) {
        return res.json({ leaderboard: []});
      }
    scoresQuery = scoresQuery.in("user_id", ids)
  }
  
  const {data: scores, error: scoresError} = await scoresQuery;
  
  if (scoresError) {
    return res.status(500).json({ error: 'Failed to fetch matches 3 ', detail: scoresError.message });
  }

  if (!scores?.length) {
    return res.json({leaderboard: []});
  }

  if (userIdToName.size === 0) {
     const userIds = Array.from(new Set(scores.map(s => s.user_id)));
    const {data: users2, error: users2Err} = await supabaseAdmin
    .from("Users")
    .select("id, username")
    .in('id', userIds);

    if (users2Err) {
      return res.status(500).json({ error: 'Failed to fetch usernames', detail: users2Err.message });
    }

    users2.forEach(u => userIdToName.set(u.id, u.username));
  }

  const matchDetailsById = new Map((matches || []).map(m => [m.match_id, { title: m.title, category_id: m.category_id }]));
  const categoryIds = Array.from(new Set((matches || []).map(m => m.category_id).filter(Boolean)));
  let categoryMap = new Map();
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesErr } = await supabaseAdmin
      .from('categories')
      .select('cat_id, name')
      .in('cat_id', categoryIds);
    if (categoriesErr) {
      return res.status(500).json({ error: 'Failed to fetch categories', detail: categoriesErr.message });
    }
    categoryMap = new Map(categories.map(c => [c.cat_id, c.name]));
  }

  let leaderboard = scores.map(s => {
    const matchDetails = matchDetailsById.get(s.match_id) || {};
    const categoryName = matchDetails.category_id ? (categoryMap.get(matchDetails.category_id) || 'Unknown') : 'Unknown';
    return {
      username: userIdToName.get(s.user_id) ?? '(unknown)',
      points: s.points || 0,
      match_title: matchDetails.title || '(unknown match)',
      category: categoryName,
    };
  });

  if (sort === 'Rank Descending') {
    leaderboard.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  } else if (sort === 'Rank Ascending') {
    leaderboard.sort((a, b) => (a.points ?? 0) - (b.points ?? 0));
  }

  return res.status(201).json({
    ok: true,
    message: "leaderboard succesfully sourced",
    leaderboard
  });

} catch (err) {
  res.status(500).json({ error: 'Unexpected error', detail: err?.message || String(err) });
}
});

router.post('/getLobby', async (req, res) => {
  try {
    const {match_id} = req.body;
    console.log(match_id + "0");
    const {data: lobbyData, error: lobbyError} = await supabaseAdmin
    .from("match_players")
    .select("match_id, user_id, is_ready")
    .eq("match_id", match_id)

    if (lobbyError) {
       return res.status(500).json({ error: 'Failed to get lobby data ', detail: lobbyError.message });
    }

    console.log(lobbyData + "1")
    const users = (lobbyData ?? []).map(r => r.user_id);



    const {data: usersData, error: userError} = await supabaseAdmin
    .from("Users")
    .select("id, username")
    .in("id", users)

    if (userError) {
      return res.status(500).json({ error: 'Failed to get user data ', detail: userError.message });
    }
    console.log(usersData + "2")
    const readyById = new Map(lobbyData.map(r => [r.user_id, r.is_ready]));
    const results = (usersData ?? []).map(u => ({
      id: u.id,
      username: u.username,
      is_ready: readyById.get(u.id) ?? false,
    }));


     return res.status(201).json({
      ok: true,
      message: "Lobby Data succsessfully retrieved",
      results,
    });


  } catch (err) {
    console.error('Error in getLobby endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});


router.post('/addPlayerToMatch', async (req, res) => {
  try {
    const { match_id, user_id } = req.body;

    if (!match_id || !user_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: match_id and user_id"
      });
    }

    // check if the match exists
    const { data: matchExists, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('match_id, title')
      .eq('match_id', match_id)
      .single();

    if (matchError || !matchExists) {
      return res.status(404).json({
        ok: false,
        error: "Match not found"
      });
    }

    // check if player is already in the match
    const { data: existingPlayer, error: checkError } = await supabaseAdmin
      .from('match_players')
      .select('id')
      .eq('match_id', match_id)
      .eq('user_id', user_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing player:', checkError);
      return res.status(500).json({
        ok: false,
        error: "Error checking if player is already in match"
      });
    }

    if (existingPlayer) {
      return res.status(409).json({
        ok: false,
        error: "Player is already in this match"
      });
    }

    // add player to match
    const { data: newPlayer, error: insertError } = await supabaseAdmin
      .from('match_players')
      .insert([{
        match_id: match_id,
        user_id: user_id
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error adding player to match:', insertError);
      return res.status(500).json({
        ok: false,
        error: "Error adding player to match: " + insertError.message
      });
    }

    return res.status(201).json({
      ok: true,
      message: "Player successfully added to match",
      data: newPlayer,
      match: matchExists
    });
    
  } catch (err) {
    console.error('Error in addPlayerToMatch endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});

// endpoint to remove a user from a match
router.delete('/removePlayerFromMatch', async (req, res) => {
  try {
    const { match_id, user_id } = req.body;

    if (!match_id || !user_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: match_id and user_id"
      });
    }

    // check if the match exists
    const { data: matchExists, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('match_id, title, host_user_id')
      .eq('match_id', match_id)
      .single();

    if (matchError || !matchExists) {
      return res.status(404).json({
        ok: false,
        error: "Match not found"
      });
    }

    // check if player is in the match
    const { data: existingPlayer, error: checkError } = await supabaseAdmin
      .from('match_players')
      .select('id')
      .eq('match_id', match_id)
      .eq('user_id', user_id)
      .single();

    if (checkError || !existingPlayer) {
      return res.status(404).json({
        ok: false,
        error: "Player is not in this match"
      });
    }

    // remove player from match
    const { data: removedPlayer, error: deleteError } = await supabaseAdmin
      .from('match_players')
      .delete()
      .eq('match_id', match_id)
      .eq('user_id', user_id)
      .select();

    if (deleteError) {
      console.error('Error removing player from match:', deleteError);
      return res.status(500).json({
        ok: false,
        error: "Error removing player from match: " + deleteError.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Player successfully removed from match",
      data: removedPlayer[0],
      match: {
        match_id: matchExists.match_id,
        title: matchExists.title
      }
    });
    
  } catch (err) {
    console.error('Error in removePlayerFromMatch endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});

// endpoint to create a match invitation
router.post('/createMatchInvite', async (req, res) => {
  try {
    const { match_id, target_user_id } = req.body;

    if (!match_id || !target_user_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: match_id and target_user_id"
      });
    }

    // check if the match exists
    const { data: matchExists, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('match_id, title, host_user_id')
      .eq('match_id', match_id)
      .single();

    if (matchError || !matchExists) {
      return res.status(404).json({
        ok: false,
        error: "Match not found"
      });
    }

    // check if target user exists
    const { data: userExists, error: userError } = await supabaseAdmin
      .from('Users')
      .select('id')
      .eq('id', target_user_id)
      .single();

    if (userError || !userExists) {
      return res.status(404).json({
        ok: false,
        error: "Target user not found"
      });
    }

    // check if user is already in the match
    const { data: existingPlayer, error: playerCheckError } = await supabaseAdmin
      .from('match_players')
      .select('id')
      .eq('match_id', match_id)
      .eq('user_id', target_user_id)
      .single();

    if (existingPlayer) {
      return res.status(409).json({
        ok: false,
        error: "User is already in this match"
      });
    }

    // check if invitation already exists
    const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
      .from('match_invatations')
      .select('id')
      .eq('match_id', match_id)
      .eq('target_user_id', target_user_id)
      .single();

    if (existingInvite) {
      return res.status(409).json({
        ok: false,
        error: "Invitation already exists for this user and match"
      });
    }

    // create the invitation
    const { data: newInvite, error: createError } = await supabaseAdmin
      .from('match_invatations')
      .insert([{
        match_id: match_id,
        target_user_id: target_user_id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating match invitation:', createError);
      return res.status(500).json({
        ok: false,
        error: "Error creating match invitation: " + createError.message
      });
    }

    return res.status(201).json({
      ok: true,
      message: "Match invitation created successfully",
      data: newInvite,
      match: {
        match_id: matchExists.match_id,
        title: matchExists.title
      }
    });
    
  } catch (err) {
    console.error('Error in createMatchInvite endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});

export default router;