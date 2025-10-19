import express from "express"
import http from "http"
import { Server } from "socket.io"
import 'dotenv/config'
import cors from 'cors'
import apiRoutes from './routes/apiroutes.js';
import { fetchQuestionsInRounds, fetchMatchQuestions, updateMatchStatus, deactivateQuestions, updateScores, updateMatchCompletedDate } from "./game_helpers/dbqueires.js";
import {createAnonClient, supabaseAdmin, createUserClient} from './database/config/supabaseClient.js';
import cookieParser from 'cookie-parser'
import { setAuthCookies, clearAuthCookies } from './database/config/auth-cookies.js'

export async function requireUser(req, res, next) {
  try {
    const at = req.cookies?.sb_at
    const rt = req.cookies?.sb_rt

    if (!rt && !at) {
      return res.status(401).json({ok: false, error: "not authenticated"})
    }

    let accessToken = at;

    if (accessToken) {
      const sbUser = createUserClient(accessToken)
      const {data: u1 } = await sbUser.auth.getUser();
      if (!u1?.user) {
        accessToken = null;
      }
    }

    if (!accessToken && rt) {
      const sb = createAnonClient()
      const {data, error} = await sb.auth.refreshSession({ refresh_token: rt});
      if (error || !data?.session) {
        clearAuthCookies(res);
        return res.status(401).json({ok: false, error: "session expired"})
      }
      setAuthCookies(res, data.session);
      accessToken = data.session.access_token
    }

    req.supabase = createUserClient(accessToken)

    const {data: u2} = await req.supabase.auth.getUser()
    req.user = u2?.user || null;

    return next()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ok: false, error: "auth mmiddleware error"})
  }
}
const app = express();
app.use(express.json());
app.use(cookieParser());

// Build frontend origin from env; MUST be exact Render frontend URL
const CLIENT_ORIGIN =
  (process.env.CLIENT_ORIGIN?.trim()) ||
  (process.env.CLIENT_ORIGIN_HOST ? `https://${process.env.CLIENT_ORIGIN_HOST}` : undefined);

// Apply CORS BEFORE routes (credentials required for cookies)
app.use(cors({
  origin: CLIENT_ORIGIN ? [CLIENT_ORIGIN] : [],   // set CLIENT_ORIGIN in Render
  credentials: true,
}));

// Fast health check for Render
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }));

// Mount API after CORS
app.use('/api', apiRoutes);

const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN ? [CLIENT_ORIGIN] : [],
    origin: CLIENT_ORIGIN ? [CLIENT_ORIGIN] : [],
    credentials: true,
    methods: ['GET', 'POST'],
  },
});


const port = process.env.PORT || 3000;

// Auth middleware: link a user to the socket
import cookie from 'cookie';
io.use(async (socket, next) => {
  try {
    // Debug: log cookies
    console.log('[Socket Auth] Handshake cookies:', socket.handshake.headers.cookie);
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const accessToken = cookies['sb_at'];
    console.log('[Socket Auth] Parsed accessToken:', accessToken);
    let verifiedUser = null;
    let profile = null;

    if (accessToken) {
      // Validate access token and get user
      const sbUser = createUserClient(accessToken);
      const { data: u1, error: userError } = await sbUser.auth.getUser();
      if (userError) {
        console.warn('[Socket Auth] Supabase getUser error:', userError.message);
      }
      verifiedUser = u1?.user || null;
      console.log('[Socket Auth] Verified user:', verifiedUser);
      if (verifiedUser?.id) {
        // Map auth user to users
        const { data: userRow, error: profileError } = await supabaseAdmin
          .from('Users')
          .select('id, username')
          .eq('auth_user_id', verifiedUser.id)
          .single();
        if (profileError) {
          console.warn('[Socket Auth] DB profile lookup error:', profileError.message);
        }
        console.log('[Socket Auth] DB userRow:', userRow);
        if (!profileError && userRow) {
          profile = userRow;
        }
      }
    } else {
      console.warn('[Socket Auth] No accessToken found in cookies');
    }

    let linked;
    if (verifiedUser) {
      linked = {
        id: profile?.id || socket.id,
        username:
          profile?.username ||
          verifiedUser?.user_metadata?.username ||
          `Player_${socket.id.substring(0, 6)}`,
        verified: true,
        auth_user_id: verifiedUser.id,
      };
      console.log('[Socket Auth] Linked user:', linked);
    } else {
      linked = {
        id: socket.id,
        username: `Player_${socket.id.substring(0, 6)}`,
        verified: false,
        auth_user_id: null,
        authInvalid: !!accessToken,
      };
      console.log('[Socket Auth] Fallback to socket.id:', linked);
    }

    socket.data.user = linked;
    socketUserMap.set(socket.id, linked);
    return next();
  } catch (err) {
    console.error('Socket auth middleware error:', err);
    const fallback = { id: socket.id, username: `Player_${socket.id.substring(0, 6)}`, verified: false };
    socket.data.user = fallback;
    socketUserMap.set(socket.id, fallback);
    return next();
  }
});

let gameQuestions = null;
let currentQuestionData = null;
let players = new Map();
let playerAnswers = new Map();
let currentMatchId = null;
let socketUserMap = new Map();
const matchData = new Map();

function getUserForSocket(socketId) {
  return socketUserMap.get(socketId) || null;
}

function getRoomName(matchId) {
  return `match:${matchId}`;
}

function emitToCurrentMatch(event, payload) {
  try {
    const activeMatchId = (gameState && gameState.matchId) || currentMatchId;
    if (activeMatchId) {
      io.to(getRoomName(activeMatchId)).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch (e) {
    console.error('emitToCurrentMatch error:', e);
    io.emit(event, payload);
  }
}

async function broadcastLobbyState(matchId) {
  try {
    const room = getRoomName(matchId);
    const roomSet = io.sockets.adapter.rooms.get(room) || new Set();
    const uniqueByUser = new Map();

    for (const sid of roomSet) {
      const s = io.sockets.sockets.get(sid);
      const u = s?.data?.user;
      if (!u?.id) continue;
      if (!uniqueByUser.has(u.id)) uniqueByUser.set(u.id, { id: u.id, username: u.username });
    }

    let hostId = matchData.get(matchId)?.host_user_id || null;
    if (!hostId) {
      const { data: m, error } = await supabaseAdmin
        .from('matches')
        .select('host_user_id, status')
        .eq('match_id', matchId)
        .single();
      if (!error && m) {
        matchData.set(matchId, { host_user_id: m.host_user_id, status: m.status });
        hostId = m.host_user_id;
      }
    }

    io.to(room).emit('lobby_state', {
      matchId,
      hostId,
      players: Array.from(uniqueByUser.values()),
      count: uniqueByUser.size
    });
  } catch (e) {
    console.error('broadcastLobbyState error:', e);
  }
}
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiRoutes);

app.get("/health", (req, res) => res.send("ok"));

let timer = 20;
let timerInterval = null;
let gameState = {
  isActive: false,
  currentRound: 1,
  currentQuestion: 1,
  totalRounds: 4,
  questionsPerRound: 7,
  timerStarted: false,
  questionStartTime: null,
  correctAnswer: null,
  matchId: null
};

function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timer = 20;
  gameState.questionStartTime = Date.now();
  playerAnswers.clear();
  
  console.log('Timer started with 20 seconds');
  
  emitToCurrentMatch('timer', timer);
  
  timerInterval = setInterval(() => {
    timer--;
    emitToCurrentMatch('timer', timer);
    
    if (timer <= 0) {
      console.log('Timer expired, moving to next question');
      clearInterval(timerInterval);
      timerInterval = null;
      
      timer = 20;
      
      handleQuestionTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function calculateScore(timeRemaining, isCorrect) {
  if (!isCorrect) return 0;
  
  // Base points for correct answer: 100
  // Speed bonus: up to 100 additional points based on time remaining
  const basePoints = 100;
  const speedBonus = Math.floor((timeRemaining / 20) * 100);
  return basePoints + speedBonus;
}

function getUserKeyFromSocket(socket) {
  const u = socket?.data?.user;
  return (u?.id) || socket.id;
}

function addPlayer(socket, username = null) {
  const userKey = getUserKeyFromSocket(socket);
  if (!players.has(userKey)) {
    const linkedUser = socket?.data?.user || socketUserMap.get(socket.id);
    players.set(userKey, {
      id: userKey,
      username: (linkedUser?.username) || username || `Player_${String(userKey).substring(0, 6)}`,
      score: 0,
      answersSubmitted: 0,
      correctAnswers: 0
    });
    console.log(`Player added: ${players.get(userKey).username} (user=${userKey}) via socket ${socket.id}`);
    broadcastLeaderboard();
  }
  return players.get(userKey);
}

function broadcastLeaderboard(matchId = (gameState?.matchId || currentMatchId)) {
  try {
    const roomId = matchId ? getRoomName(matchId) : null;
    // Build a set of logical user ids present in the room
    let inRoomUserKeys = null;
    if (roomId) {
      const roomSet = io.sockets.adapter.rooms.get(roomId) || new Set();
      inRoomUserKeys = new Set();
      for (const sid of roomSet) {
        const u = getUserForSocket(sid);
        const key = u?.id || sid;
        inRoomUserKeys.add(key);
      }
    }

    // Build sorted entries and rank map for in match players
    const entries = Array.from(players.entries())
      .filter(([userKey]) => (inRoomUserKeys ? inRoomUserKeys.has(userKey) : true));
    entries.sort(([, a], [, b]) => b.score - a.score);
    const rankMap = new Map(entries.map(([userKey], idx) => [userKey, idx + 1]));

    const allPlayers = entries
      .map(([, player], index) => ({
        rank: index + 1,
        username: player.username,
        score: player.score,
        correctAnswers: player.correctAnswers,
        totalAnswers: player.answersSubmitted
      }));

    if (roomId) {
      io.to(roomId).emit('leaderboard_update', allPlayers);

      // send players position and score to their socket
      const roomSet = io.sockets.adapter.rooms.get(roomId) || new Set();
      for (const sid of roomSet) {
        const u = getUserForSocket(sid);
        const key = u?.id || sid;
        const p = players.get(key);
        if (!p) continue;
        const myRank = rankMap.get(key) || null;
        io.to(sid).emit('my_score', {
          username: p.username,
          score: p.score,
          rank: myRank,
          correctAnswers: p.correctAnswers,
          totalAnswers: p.answersSubmitted,
        });
      }
    } else {
      io.emit('leaderboard_update', allPlayers);
      // push to every connected socket
      for (const [sid, sock] of io.sockets.sockets) {
        const u = getUserForSocket(sid);
        const key = u?.id || sid;
        const p = players.get(key);
        if (!p) continue;
        const myRank = rankMap.get(key) || null;
        io.to(sid).emit('my_score', {
          username: p.username,
          score: p.score,
          rank: myRank,
          correctAnswers: p.correctAnswers,
          totalAnswers: p.answersSubmitted,
        });
      }
    }
  } catch (e) {
    console.error('broadcastLeaderboard error:', e);
  }
}


function handleQuestionTimeout() {
  console.log(`Question ${gameState.currentQuestion} of round ${gameState.currentRound} timed out`);
  
  gameState.timerStarted = false;
  
  gameState.currentQuestion++;
  
  if (gameState.currentQuestion > gameState.questionsPerRound) {
    gameState.currentQuestion = 1;
    gameState.currentRound++;
    
    if (gameState.currentRound > gameState.totalRounds) {
      gameState.isActive = false;
      stopTimer();
        emitToCurrentMatch('game_ended');
        updateMatchStatus(currentMatchId, "completed");
        updateMatchCompletedDate(currentMatchId);
        deactivateQuestions(currentMatchId);

        // Mark match as completed in DB
        (async () => {
          try {
            if (gameState.matchId) {
              const { error } = await supabaseAdmin
                .from('matches')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('match_id', gameState.matchId);
              if (error) {
                console.warn('Failed to update match status to completed:', error.message);
              } else {
                const prev = matchData.get(gameState.matchId) || {};
                matchData.set(gameState.matchId, { ...prev, status: 'completed' });
              }
            }
          } catch (e) {
            console.warn('Error updating match status to completed:', e?.message || e);
          }
        })();
      console.log('Game ended - all questions completed');
      return;
    }
  }
  
  console.log(`Moving to question ${gameState.currentQuestion} of round ${gameState.currentRound}`);
  
  loadCurrentQuestion();
  
  setTimeout(() => {
    gameState.timerStarted = true;
    startTimer();
  }, 500);
}

async function startRealtime() {
  const channel = supabaseAdmin
    .channel('realtime:match_players')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_players' },
      (payload) => {
        io.emit('player_join', payload);
      }
    )

    .on(
      'postgres_changes',
      {event: "*", schema: "public", table:"match_invitations"},
      (payload) => {
        io.emit("notification_sent", payload);
      }
    )

    

  const status = channel.subscribe();
  console.log('Realtime channel status:', status);
}



function loadCurrentQuestion() {
  if (!gameQuestions || !gameQuestions.rounds) {
    console.error('No game data available');
    return;
  }
  
  const currentRoundData = gameQuestions.rounds[gameState.currentRound - 1];
  if (!currentRoundData || !currentRoundData.questions) {
    console.error('No questions available for current round');
    return;
  }
  
  const currentQuestionInfo = currentRoundData.questions[gameState.currentQuestion - 1];
  if (!currentQuestionInfo) {
    console.error('No question available for current position');
    return;
  }
  
  console.log(`Loading question ${gameState.currentQuestion} of round ${gameState.currentRound}: ${currentQuestionInfo.prompt.substring(0, 50)}...`);
  
  const correctAnswerObj = currentQuestionInfo.options.find(opt => opt.correct);
  gameState.correctAnswer = correctAnswerObj ? correctAnswerObj.text : null;

  // Shuffle options for display
  const shuffledOptions = [...currentQuestionInfo.options]
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  currentQuestionData = {
    round: gameState.currentRound,
    questionNumber: gameState.currentQuestion,
    totalRounds: gameState.totalRounds,
    questionsPerRound: gameState.questionsPerRound,
    question: currentQuestionInfo.prompt,
    options: shuffledOptions.map(opt => opt.text),
    category: currentQuestionInfo.category,
    difficulty: currentQuestionInfo.difficulty
  };
  
  emitToCurrentMatch('question_loaded', currentQuestionData);
}

io.on('connection', (socket) => {
  const linked = socket.data?.user;
  console.log('A user connected:', socket.id, linked ? `(user: ${linked.username}, id: ${linked.id}, verified: ${linked.verified})` : '');
  
  // add player to the game
  addPlayer(socket);

  if (gameState.isActive) {
    socket.emit('timer', timer);
    
    if (currentQuestionData) {
      socket.emit('question_loaded', currentQuestionData);
    }
  } else {
    socket.emit('timer', 20);
  }

  socket.on('create_match', async (matchData) => {
    console.log('Setting up match...', matchData);
    try {
      // Set default values
      const title = matchData?.title || `Match_${Date.now()}`;
      const linked = socket.data?.user;
      const hostUserId = linked?.id;

      if (!hostUserId) {
        throw new Error('No linked user found for this socket. Cannot create match without a host user id.');
      }
      
      console.log(`Creating match "${title}" with host ${hostUserId}`);
      const matchId = matchData.match_id;
      if (!matchId) throw new Error('match_id is required to create match');
      currentMatchId = matchId;

      // Fetch questions for match
      const gameData = await fetchMatchQuestions(matchId);
      gameQuestions = {
        totalRounds: gameData.totalRounds,
        questionsPerRound: gameData.questionsPerRound,
        rounds: gameData.rounds.map(r => ({
          roundNumber: r.roundNumber,
          questions: r.questions.map(q => ({
            prompt: q.prompt,
            options: q.options,
            category: q.category,
            difficulty: q.difficulty
          }))
        }))
      };

      // Join host to the lobby room and broadcast initial state
      await socket.join(getRoomName(matchId));
      await broadcastLobbyState(matchId);

      console.log('Game prepared from DB:', {
        totalRounds: gameData.totalRounds,
        totalQuestions: gameData.totalQuestions
      });
      socket.emit('match_created', {
        success: true,
        matchId,
        totalRounds: gameData.totalRounds,
        totalQuestions: gameData.totalQuestions
      });
    } catch (err) {
      console.error('Error setting up match:', err);
      socket.emit('match_created', { 
        success: false, 
        error: err.message 
      });
    }
  });

  // Join the most recent open match when
  socket.on('join_latest_match', async (_payload, ack) => {
    try {
      const u = socket.data?.user;
      if (!u?.id) throw new Error('User not linked');

      const { data: m, error } = await supabaseAdmin
        .from('matches')
        .select('match_id, host_user_id, status')
        .eq('status', 'lobby')
        .order('match_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message || 'Failed to find open match');
      if (!m) throw new Error('No open matches available');

      const matchId = m.match_id;
  matchData.set(matchId, { host_user_id: m.host_user_id, status: m.status });

      // Add to match_players
      const { data: existing } = await supabaseAdmin
        .from('match_players')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', u.id)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabaseAdmin
          .from('match_players')
          .insert([{ match_id: matchId, user_id: u.id }]);
        if (insErr) throw new Error('Failed to add player to match');
      }

      await socket.join(getRoomName(matchId));
      await broadcastLobbyState(matchId);
      broadcastLeaderboard(matchId);
      if (typeof ack === 'function') ack({ ok: true, matchId });
      else socket.emit('join_match_result', { ok: true, matchId });
    } catch (e) {
      console.error('join_latest_match error:', e);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
      else socket.emit('join_match_result', { ok: false, error: e.message });
    }
  });

  // Join an existing match lobby
  socket.on('join_match', async ({ matchId }, ack) => {
    try {
      if (!matchId) throw new Error('matchId is required');
      const u = socket.data?.user;
      if (!u?.id) throw new Error('User not linked');

      // ensure match exists and is joinable
      let meta = matchData.get(matchId);
      if (!meta) {
        const { data: m, error } = await supabaseAdmin
          .from('matches')
          .select('host_user_id, status')
          .eq('match_id', matchId)
          .single();
        if (error || !m) throw new Error('Match not found');
        meta = { host_user_id: m.host_user_id, status: m.status };
        matchData.set(matchId, meta);
      }
  if (meta.status && meta.status !== 'lobby') throw new Error('Match is not joinable');
      const { data: existing, error: checkErr } = await supabaseAdmin
        .from('match_players')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', u.id)
        .maybeSingle();
      if (!existing) {
        const { error: insErr } = await supabaseAdmin
          .from('match_players')
          .insert([{ match_id: matchId, user_id: u.id }]);
        if (insErr) throw new Error('Failed to add player to match');
      }

      await socket.join(getRoomName(matchId));
      await broadcastLobbyState(matchId);
      broadcastLeaderboard(matchId);
      if (typeof ack === 'function') ack({ ok: true, matchId });
    } catch (e) {
      console.error('join_match error:', e);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // Leave lobby
  socket.on('leave_match', async ({ matchId }, ack) => {
    try {
      if (!matchId) throw new Error('matchId is required');
      await socket.leave(getRoomName(matchId));
      await broadcastLobbyState(matchId);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // Get current lobby state
  socket.on('get_lobby_state', async ({ matchId }, ack) => {
    try {
      if (!matchId) throw new Error('matchId is required');
      const room = getRoomName(matchId);
      const roomSet = io.sockets.adapter.rooms.get(room) || new Set();
      const players = [];
      const seen = new Set();
      for (const sid of roomSet) {
        const s = io.sockets.sockets.get(sid);
        const u = s?.data?.user;
        if (u?.id && !seen.has(u.id)) { seen.add(u.id); players.push({ id: u.id, username: u.username }); }
      }
      const hostId = matchData.get(matchId)?.host_user_id || null;
      const payload = { matchId, hostId, players, count: players.length };
      if (typeof ack === 'function') ack({ ok: true, ...payload });
      else socket.emit('lobby_state', payload);
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // useful debug to id cleints
  socket.on('whoami', (ack) => {
    const linked = socket.data?.user;
    if (typeof ack === 'function') {
      ack({ ok: true, user: linked });
    } else {
      socket.emit('whoami_result', { ok: true, user: linked });
    }
  });

  socket.on('start_match', () => {
    console.log('Starting match...');
    
    if (!gameQuestions) {
      console.error('No game data available for match start');
      socket.emit('match_start_error', { error: 'No game data available. Please create a match first.' });
      return;
    }
    
    gameState = {
      isActive: true,
      currentRound: 1,
      currentQuestion: 1,
      totalRounds: gameQuestions.totalRounds,
      questionsPerRound: gameQuestions.questionsPerRound,
      timerStarted: false,
      questionStartTime: null,
      correctAnswer: null,
      matchId: currentMatchId
    };
    
    updateMatchStatus(currentMatchId, "in progress");

    console.log('Game state reset:', gameState);
    
    stopTimer();
    timer = 20;

    // Set match status to 'in progress' in the DB
    (async () => {
      try {
        if (currentMatchId) {
          const { error } = await supabaseAdmin
            .from('matches')
            .update({ status: 'in progress' })
            .eq('match_id', currentMatchId);
          if (error) {
            console.warn('Failed to update match status to in progress:', error.message);
          } else {
            const prev = matchData.get(currentMatchId) || {};
            matchData.set(currentMatchId, { ...prev, status: 'in progress' });
          }
        }
      } catch (e) {
        console.warn('Error updating match status to in progress:', e?.message || e);
      }
    })();
    
    console.log('Loading first question...');
    loadCurrentQuestion();
    
  });


  socket.on('match_component_ready', () => {
    console.log('Match component is ready, broadcasting question and starting timer if needed');
    if (!gameState.isActive || !currentQuestionData) {
      console.log('Not ready to broadcast question - isActive:', gameState.isActive, 'hasData:', !!currentQuestionData);
      return;
    }

    emitToCurrentMatch('question_loaded', currentQuestionData);

    // Start timer once per question
    if (!gameState.timerStarted) {
      gameState.timerStarted = true;
      setTimeout(() => {
        console.log('Starting timer now');
        startTimer();
      }, 500);
    }
  });

  socket.on('submit_answer', async (data) => {
    const { answer, timeRemaining } = data;
    const userKey = getUserKeyFromSocket(socket);
    const player = players.get(userKey);
    
    if (!player) {
      console.error('Player not found for answer submission');
      return;
    }
    
    if (playerAnswers.has(userKey)) {
      console.log(`Player ${player.username} already answered this question`);
      return;
    }
    
    const isCorrect = answer === gameState.correctAnswer;
    const pointsEarned = calculateScore(timeRemaining || timer, isCorrect);
    
    // update player stats
    player.score += pointsEarned;
    player.answersSubmitted++;
    if (isCorrect) {
      player.correctAnswers++;
    }
    
    playerAnswers.set(userKey, {
      answer: answer,
      isCorrect: isCorrect,
      pointsEarned: pointsEarned,
      timeRemaining: timeRemaining || timer
    });
    
    console.log(`${player.username} answered "${answer}" (${isCorrect ? 'CORRECT' : 'WRONG'}) - earned ${pointsEarned} points`);

    try {
      let userId = getUserKeyFromSocket(socket);
      let responseTimeMs;
      if (gameState?.questionStartTime) {
        responseTimeMs = Math.max(0, Date.now() - gameState.questionStartTime);
      } else {
        // fallback
        const secondsLeft = Number.isFinite(timeRemaining) ? timeRemaining : timer;
        responseTimeMs = Math.max(0, (20 - (secondsLeft || 0)) * 1000);
      }
      console.log(currentMatchId);
      console.log(pointsEarned);
      console.log(isCorrect);
      console.log(responseTimeMs);
      updateScores(currentMatchId, userId, pointsEarned, isCorrect, responseTimeMs)
      .catch(e => console.error('updateScores error:', e));
        } catch (e) {
          console.error('Failed to call updateScores:', e);
        }
        
    socket.emit('answer_result', {
      isCorrect: isCorrect,
      pointsEarned: pointsEarned,
      newTotalScore: player.score,
      correctAnswer: gameState.correctAnswer
    });
    
    // update match scoreboard
    broadcastLeaderboard(gameState?.matchId || currentMatchId);
  });

  socket.on('get_leaderboard', ({ matchId } = {}, ack) => {
    try {
      const effMatchId = matchId || gameState?.matchId || currentMatchId;
      const roomId = effMatchId ? getRoomName(effMatchId) : null;
      let inRoomUserKeys = null;
      if (roomId) {
        const roomSet = io.sockets.adapter.rooms.get(roomId) || new Set();
        inRoomUserKeys = new Set();
        for (const sid of roomSet) {
          const u = getUserForSocket(sid);
          const key = u?.id || sid;
          inRoomUserKeys.add(key);
        }
      }

      const leaderboard = Array.from(players.entries())
        .filter(([userKey]) => (inRoomUserKeys ? inRoomUserKeys.has(userKey) : true))
        .map(([, p]) => p)
        .sort((a, b) => b.score - a.score)
        .map((p, idx) => ({
          rank: idx + 1,
          username: p.username,
          score: p.score,
          correctAnswers: p.correctAnswers,
          totalAnswers: p.answersSubmitted,
        }));

      if (typeof ack === 'function') {
        ack({ ok: true, leaderboard });
      } else {
        socket.emit('leaderboard_update', leaderboard);
      }
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

    socket.on('disconnecting', () => {
    try {
      for (const room of socket.rooms) {
        if (room.startsWith('match:')) {
          const matchId = room.split(':')[1];
          setTimeout(() => {
            broadcastLobbyState(matchId);
            broadcastLeaderboard(matchId);
          }, 0);
        }
      }
    } catch {}
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const u = socket.data?.user;
    if (u?.username) {
      console.log(`Player ${u.username} disconnected`);
    }
    socketUserMap.delete(socket.id);
  });
});

server.listen(port, '0.0.0.0', async () => {
  await startRealtime();
  console.log(`Backend listening on port ${port}`)
  console.log(`Socket.IO server ready`)
})
