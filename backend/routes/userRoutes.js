// Tables in DB - still need to do update for all and delete for most
// Users [x]

import express from 'express';
import cookieParser from 'cookie-parser';
import {createAnonClient, supabaseAdmin} from '../database/config/supabaseClient.js';
import { setAuthCookies, clearAuthCookies } from '../database/config/auth-cookies.js';
import { requireUser } from '../backendapp.js';
import 'dotenv/config';

const router = express.Router();

router.use(cookieParser())

router.post('/users', requireUser, async (req, res) => {
  const {data, error} = await supabaseAdmin.from('Users').select('*');
  if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Could not fetch users', detail: error.message });
    }
    if(data) {
      console.log("HEY")
    }
    console.log(data)
    res.json(data);
});

router.post('/updateUser', requireUser, async (req, res) => {
 try {
    const {username, Avatar_url, password} = req.body;
  
    if (!username || !Avatar_url) return res.status(400).json({ ok: false, error: ' Missing username or avatar' });

    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }


    const { data: userRow, error: userRowErr } = await supabaseAdmin
      .from('Users')
      .select('id, username, role')
      .eq('auth_user_id', authUserId)
      .single();

    if (userRowErr) {
      return res.status(500).json({ ok: false, error: `User lookup failed: ${userRowErr.message}` });
    }

    const { data: dupe, error: dupeErr } = await supabaseAdmin
    .from('Users')
    .select('id')
    .eq('username', username)
    .neq('id', userRow.id)
    .maybeSingle();
    if (dupeErr) return res.status(500).json({ ok:false, error: dupeErr.message });
    if (dupe) return res.status(409).json({ ok:false, error: 'Username already in use' });


    const { data: updated, error: updErr } = await req.supabase
      .from('Users')
      .update({ Avatar_url, username })
      .eq('id', userRow.id)
      .select('id, username, Avatar_url')
      .single();

    if (updErr) {
      return res.status(500).json({ ok: false, error: `Update failed: ${updErr.message}` });
    }


    const maybePwd = typeof password === 'string' ? password.trim() : '';
    const isPlaceholder = maybePwd === '' || maybePwd === 'undefined' || maybePwd === 'null';
    if (!isPlaceholder) {
      if (maybePwd.length < 6) {
        return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
      }

      const { data: authData, error: passErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: maybePwd,
      });

      if (passErr) {
        return res.status(500).json({ ok: false, error: `Password update failed: ${passErr.message}` });
      }

      const sb = createAnonClient();
      const { data: login, error: loginErr } = await sb.auth.signInWithPassword({
        email: req.user.email,  
        password: maybePwd,
      });


      if (loginErr || !login?.session) {
      clearAuthCookies(res);
      return res.status(200).json({
        ok: true,
        user: updated,
        passwordChanged: true,
        reauthenticated: false,
        message: 'Password changed — please sign in again.',
    });

    }
    setAuthCookies(res, login.session);

    return res.status(200).json({
      ok: true,
      user: updated,
      passwordChanged: true,
      reauthenticated: true,
      message: 'Password changed — you remain signed in.',
    });
  }


    return res.status(201).json({
      ok: true,
      message: "User data collected succsefully",
      user: updated,
      passwordChanged: false,
      reauthenticated: true,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
  }
});

router.post('/deleteUser', requireUser, async (req, res) => {
  try {
    
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }

    const { data: userRow, error: userRowErr } = await supabaseAdmin
      .from('Users')
      .select('id, username')
      .eq('auth_user_id', authUserId)
      .single();

    if (userRowErr) {
      return res.status(500).json({ ok: false, error: `User lookup failed: ${userRowErr.message}` });
    }


    const {data: deletion, error: deleteError} = await req.supabase
    .from("Users")
    .delete()
    .eq('id', userRow.id);
    
    if (deleteError) {
    return res.status(500).json({ error: 'Failed to delete user information ', detail: deleteError.message });
  }

  const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
  if (authDelErr) {
    return res.status(500).json({ ok: false, error: `Failed to delete auth user: ${authDelErr.message}` })
  }

  clearAuthCookies(res);

  return res.status(201).json({
    ok: true,
    message: "player deleted succsefully"
  });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
  }
});

router.post('/getUserById', requireUser, async (req, res) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }

    const { data: userRow, error: userRowErr } = await supabaseAdmin
      .from('Users')
      .select('id, username')
      .eq('auth_user_id', authUserId)
      .single();

    if (userRowErr) {
      return res.status(500).json({ ok: false, error: `User lookup failed: ${userRowErr.message}` });
    }
    const {data: userData, error: userError} = await req.supabase
    .from('Users')
    .select('Avatar_url, username, created_at')
    .eq('id', userRow.id)
    .single();

    if (userError) {
    return res.status(500).json({ error: 'Failed to fetch user information ', detail: userError.message });
  }

  if (!userData || userData.length === 0) {
    console.log("EMPTY")
      return res.status(500).json({ ok: false, message: 'No matches for this user'});
    }


  const newDate = (userData) => {
    const d = new Date(userData?.created_at);
    if (Number.isNaN(d.getTime())) return '';

    // compare by local calendar day
    const startOfDay = (t) => {
      const x = new Date(t);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    const today = startOfDay(new Date());
    const day   = startOfDay(d);

    const diffDays = Math.floor((today - day) / 86400000);
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };


    return res.status(200).json({
      ok: true,
      message: "User data collected succsefully",
      results: {
        username: userData.username,
        Avatar_url: userData.Avatar_url,
        created_at: newDate(userData),
      }

    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
  }
});


router.post('/getMatchHistory', requireUser, async (req, res) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }
    const { data: userRow, error: userRowErr } = await supabaseAdmin
      .from('Users')
      .select('id, username')
      .eq('auth_user_id', authUserId)
      .single();

    if (userRowErr) {
      return res.status(500).json({ ok: false, error: `User lookup failed: ${userRowErr.message}` });
    }

  const {data: scores, error: scoreserror} = await req.supabase
    .from('match_scores')
    .select('match_id, points')
    .eq('user_id', userRow.id);


   if (scoreserror) {
    return res.status(500).json({ error: 'Failed to fetch user information ', detail: scoreserror.message });
  }

   if (!scores || scores.length === 0) {
    console.log("EMPTY")
      return res.status(200).json({ ok: true, message: 'No matches for this user', results: [] });
    }


  let matchIDs= scores.map( r => r.match_id);
  const {data: matches, error: matchError} = await supabaseAdmin
    .from('matches')
    .select('title, match_id')
    .in('match_id', matchIDs)

    if (matchError) {
    return res.status(500).json({ error: 'Failed to fetch match information ', detail: matchError.message });
  }
    console.log(matches)
    const pointsById = new Map();
    for (const { match_id, points } of scores) {
      pointsById.set(match_id, (pointsById.get(match_id) ?? 0) + points);
    }
    console.log(pointsById)
    const results = (matches ?? []).map(m => ({
      title: m.title,
      points: pointsById.get(m.match_id) ?? null
    }));


    let highScore = 0;
    let gamesPlayed = 0;
    for (const s of results) {
      gamesPlayed++;
      if (s.points >= highScore) {
        highScore = s.points;
      }
    } 
    console.log(results)
    return res.status(201).json({
      ok: true,
      message: "Match history succsefully sourced",
      results,
      highScore,
      gamesPlayed,

    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
  }
});

router.post('/getNotifications', requireUser, async (req, res) => {
  try {
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
    const {data: wholeInvite, error: wholeInviteError} = await req.supabase
    .from("match_invitations")
    .select(`
      match_id,
      invitation_id,
      status,
      matches:match_id (
      match_id,
      title,
      host_user_id,
      category_id,
      Users:host_user_id ( id, username ),
      categories:category_id (cat_id, name)
      )
      `)
      .eq('invited_user_id', user_id.id)
      .eq('status', 'pending')

    if (wholeInviteError) {
      console.error('Error fetching invitations : ', wholeInviteError);
      return res.status(500).json({
        ok: false,
        error: "Error fetching invitations : " + wholeInviteError.message
      })
    }


    if (!wholeInvite || wholeInvite.length === 0 ) {
      return res.status(201).json({
        ok: true,
        message: "No invites yet!",
        results: []
      })
    }


    const results = (wholeInvite ?? []).map(i => ({
      match_id: i.match_id,
      invitation_id: i.invitation_id ?? null,
      title: i.matches?.title ?? null,
      host_user_id: i.matches?.host_user_id ?? null,
      host_username: i.matches?.Users?.username ?? null,
      category_id: i.matches?.category_id ?? null,
      category_name: i.matches?.categories?.name ?? null,
      message: "You have been invited by " + i.matches?.Users?.username + " to play in a " + i.matches?.categories?.name + " quiz, do you want to join the match: " + i.matches?.title + "?"
    }));


    res.status(201).json({
      ok: true,
      results: results
    })

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
  }
});


router.post('/acceptInvite', requireUser,  async (req, res) => {
try {
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


    const {invitation_id, match_id} = req.body;
    const {data: invitation, error: invitationError} = await req.supabase
    .from('match_invitations')
    .delete("*")
    .eq('invitation_id', invitation_id)


    if (invitationError) {
      console.error('failed to delete invitation : ', invitationError);
      return res.status(500).json({
        ok: false,
        error: 'failed to delete invitation : ' + invitationError
    })
  }

  const {data: player, error: playerError} = await req.supabase
  .from('match_players')
  .insert([
    {
      match_id: match_id,
      user_id: user_id.id
    }
  ])
  .select()
  .single();


  if (playerError) {
    console.error('failed to add player into match: ', playerError);
    return res.status(500).json({
        ok: false,
        error: 'failed to add player into match: ' + playerError
    });
  }

  return res.status(201).json({
    ok: true,
    results: player,
  })


} catch(err) {
  console.error(err);
  return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
}
});


router.post('/declineInvite', requireUser, async (req, res) => {
try {
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


    const {invitation_id, match_id} = req.body;
    const {data: invitation, error: invitationError} = await supabaseAdmin
    .from('match_invitations')
    .delete("*")
    .eq('invitation_id', invitation_id)


    if (invitationError) {
      console.error('failed to delete invitation : ', invitationError);
      return res.status(500).json({
        ok: false,
        error: 'failed to delete invitation : ' + invitationError
    })
  }

  return res.status(201).json({
    ok: true,
    results: invitation,
  })

} catch(err) {
  console.error(err);
  return res.status(500).json({ ok: false, error: 'Unexpected error', detail: err.message });
}
});


router.post('/loginattempt', async (req, res) => {
  try {
    const {email, password, username} = req.body;
    const sb = createAnonClient();

    const {data: signInData, error: signInError} = await sb.auth.signInWithPassword({
      email, password
    });
    if (signInError) {
      console.error(signInError);
      return res.status(400).json({ok: false, error: signInError.message});
    }

    const {user, session } = signInData;


    if (!session) {
      return res.status(400).json({ ok: false, error: 'No session returned' })
    }


    const {data: userD, error: userError} = await supabaseAdmin
    .from("Users")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("username", username)

    if (userError) {
      console.error(userError);
      return res.status(400).json({ok: false, error: userError.message});
    }

    if (userD.length == 0) {
      return res.status(400).json({ok: false, error: "incorrect username"});
    }

    setAuthCookies(res, session)

    return res.status(200).json({
      ok: true, 
      user: {id: user.id, email: user.email, username},
      uid: user.id
    });
  } catch (err) {    
    console.error(err);
    return res.status(500).json({ok: false, error: "server error"})
  }
});


router.post('/searchUsers', requireUser, async (req, res) => {
  try {
    const {username} = req.body;
    
    const {data: users, error: userError} = await req.supabase 
    .from("Users")
    .select("username")
    .ilike("username", `%${username}%`);

    if (userError) {
      console.error("Failed to fetch list of users: " + userError);
      return res.status(500).json({
        ok: false,
        error: "Failed to fetch list of users:  " + userError.message,
        users: [],
      });
    }

    if (users.length == 0) {
        return res.status(201).json({
        ok: true,
        message: "No users found with that username",
        users: [],
      });
    }
    const usernames = (users ?? []).map(r => r.username);
    return res.status(201).json({
      ok: true,
      message: "users retrieved succsefully",
      users: usernames
    })

  } catch (err) {
    console.error(err);
    return res.status(500).json({ok: false, error: "server error"})
  }
});

router.post('/newUser', async (req, res) => {
  try {
    const {email, password, username} = req.body;

    const sb = createAnonClient();

    const {data: userD, error: userError} = await supabaseAdmin
    .from("Users")
    .select("id")
    .eq("username", username)
    .limit(1)

    if (userError) {
      console.error(userError);
      return res.status(400).json({ok: false, error: userError.message});
    }


    if (userD?.length) {
      return res.status(400).json({ok: false, error: "that username has already been chosen!"});
    }

    

    const {data: signUpData, error: signUpError} = await sb.auth.signUp({
      email, password
    });
    if (signUpError) {
      console.error(signUpError);
      return res.status(400).json({ok: false, error: signUpError.message});
    }

    const {user, session} = signUpData;
    if (!user) return res.status(400).json({ ok: false, error: 'Sign up created user = null' })

    const {data: userRow, error: insertError} = await supabaseAdmin
      .from("Users")
      .insert([
        {
            Avatar_url: "",
            role: "player",
            username,
            auth_user_id: user.id,
        }
      ])
      .select()
      .single();
      if (insertError) {
        console.error(insertError);
        return res.status(400).json({ok: false, error: insertError.message});
      }

      if (session) {
        setAuthCookies(res, session)
      }

      return res.status(201).json({
        ok: true, 
        user: userRow,
        uid: user.id,
        emailNeedsVerification: !session,
      });
      
  } catch (err) {    
    console.error(err);
    return res.status(500).json({ok: false, error: "server error"})
  }
});


router.post('/logout', async (_req, res) => {
  clearAuthCookies(res)
  res.status(200).json({ok: true});
})

router.post('/isAdmin', requireUser, async (req, res) => {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated"
      })
    }
    

    const { data: userRow, error: userError } = await supabaseAdmin
      .from('Users')
      .select('id, username, role')
      .eq('auth_user_id', authUserId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);

      return res.status(500).json({
        ok: false,
        error: `User lookup failed ${userError.message}`
      });
    }

    const isAdmin = userRow.role === 'admin';

    return res.status(200).json({
      ok: true,
      isAdmin: isAdmin,
      role: userRow.role
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      ok: false,
      error: 'Unexpected error',
      default: err.message
    });
  }
});

export default router;