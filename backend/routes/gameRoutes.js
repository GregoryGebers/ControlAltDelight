import express from 'express';
import {createAnonClient, supabaseAdmin} from '../database/config/supabaseClient.js';
import { requireUser } from '../backendapp.js';
import 'dotenv/config';

const router = express.Router();

// Game constants
const ROUNDS_PER_GAME = 4;
const QUESTIONS_PER_ROUND = 7;
const TOTAL_QUESTIONS_NEEDED = 28;

const easy = '89f0cf9d-c8ad-4476-b91a-1816fb0eaad2';
const medium = '2038298b-5cb1-4d94-b836-a8ca22331989';
const hard = 'de1fbc8c-bbb3-4034-a31a-84ad324f5fab';

const difficultyMap = {
  'easy': easy,
  'medium': medium,
  'hard': hard
};

async function getCategoryId(categoryName) {
  try {
    const { data: existingCategory, error: findError } = await supabaseAdmin
      .from('categories')
      .select('cat_id, name')
      .eq('name', categoryName)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (existingCategory) {
      return existingCategory.cat_id;
    }

    const { data: newCategory, error: createError } = await supabaseAdmin
      .from('categories')
      .insert([{ name: categoryName }])
      .select('cat_id')
      .single();

    if (createError) {
      throw createError;
    }

    return newCategory.cat_id;
  } catch (error) {
    console.error('Error in getCategoryId:', error);
    throw error;
  }
}

// Fisher-Yates algorithm to shuffel questions
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function organizeIntoRounds(questions) {
  const rounds = [];
  for (let i = 0; i < ROUNDS_PER_GAME; i++) {
    const startIndex = i * QUESTIONS_PER_ROUND;
    const endIndex = startIndex + QUESTIONS_PER_ROUND;
    rounds.push({
      roundNumber: i + 1,
      questions: questions.slice(startIndex, endIndex)
    });
  }
  return rounds;
}

// endpoint to start a new game and get shuffled questions
router.post('/game/start', async (req, res) => {
  try {
    const { difficulty, category, matchId } = req.body;

    // validate parameters exist
    if (!difficulty || !category || !matchId) {
      return res.status(400).json({ 
        error: 'Missing required fields: difficulty, category, matchId' 
      });
    }

    // validate difficulty
    if (!difficultyMap[difficulty.toLowerCase()]) {
      return res.status(400).json({ 
        error: 'Invalid difficulty. Must be: easy, medium, or hard' 
      });
    }

    // build query
    let query = supabaseAdmin
      .from('questions')
      .select(`
        question_id,
        prompt,
        is_active,
        categories:cat_id ( cat_id, name ),
        difficulties:diff_id ( diff_id, type ),
        question_options ( answer_option, is_correct )
      `)

    // filter by difficulty
    const difficultyId = difficultyMap[difficulty.toLowerCase()];
    query = query.eq('diff_id', difficultyId);

    // filter by category
    try {
      const categoryId = await getCategoryId(category);
      query = query.eq('cat_id', categoryId);
    } catch (error) {
      console.error('Error getting category ID:', error);
      return res.status(400).json({ error: 'Invalid category' });
    }

    // fetch questions from database
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return res.status(500).json({ error: 'Failed to fetch questions from database' });
    }

    // check num questions
    if (!data || data.length < TOTAL_QUESTIONS_NEEDED) {
      return res.status(400).json({ 
        error: `Not enough questions available. Need ${TOTAL_QUESTIONS_NEEDED}, found ${data?.length || 0}`,
        available: data?.length || 0,
        needed: TOTAL_QUESTIONS_NEEDED
      });
    }

    // normalize the question format
    const normalizedQuestions = data.map(q => ({
      id: q.question_id,
      prompt: q.prompt,
      isActive: q.is_active,
      category: q.categories ? q.categories.name : null,
      difficulty: q.difficulties ? q.difficulties.type : null,
      options: (q.question_options ?? []).map(opt => ({
        text: opt.answer_option,
        correct: opt.is_correct
      }))
    }));

    // shuffle all questions
    const shuffledQuestions = shuffleArray(normalizedQuestions);

    const gameQuestions = shuffledQuestions.slice(0, TOTAL_QUESTIONS_NEEDED);

    // organize questions into rounds
    const rounds = organizeIntoRounds(gameQuestions);

    const gameData = {
      matchId: matchId,
      category: category,
      difficulty: difficulty,
      totalRounds: ROUNDS_PER_GAME,
      questionsPerRound: QUESTIONS_PER_ROUND,
      totalQuestions: TOTAL_QUESTIONS_NEEDED,
      rounds: rounds,
      gameStarted: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'Game started successfully',
      data: gameData
    });

  } catch (error) {
    console.error('Error in game/start endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// endpoint to get game constants and configuration
router.get('/game/config', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      config: {
        roundsPerGame: ROUNDS_PER_GAME,
        questionsPerRound: QUESTIONS_PER_ROUND,
        totalQuestionsNeeded: TOTAL_QUESTIONS_NEEDED,
        availableDifficulties: Object.keys(difficultyMap),
        gameRules: {
          description: 'Each game consists of 4 rounds with 7 questions per round',
          totalQuestions: TOTAL_QUESTIONS_NEEDED,
          questionSelection: 'Questions are randomly shuffled from the selected category and difficulty'
        }
      }
    });
  } catch (error) {
    console.error('Error in game config endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

router.get('/game/endscores', async (req, res) => {
  try {
    const { match_id } = req.query;
    if (!match_id) {
      return res.status(400).json({ error: 'match_id is required' });
    }

    const { data: scoreRows, error: scoresError } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', match_id);

    if (scoresError) {
      console.error('Supabase error fetching match_scores:', scoresError);
      return res.status(500).json({ error: 'Failed to fetch match scores' });
    }

    const rows = Array.isArray(scoreRows) ? scoreRows : [];
    if (rows.length === 0) {
      return res.status(200).json({ ok: true, scores: [] });
    }

  const userIds = [...new Set(rows.map(r => r.user_id ?? r.user_if))];
    const { data: users, error: usersError } = await supabase
      .from('Users')
      .select('id, username')
      .in('id', userIds);

    if (usersError) {
      console.error('Supabase error fetching Users:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users for scores' });
    }

    const nameById = new Map((users || []).map(u => [u.id, u.username]));

    const sorted = rows
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0));

    const formatted = sorted.map((r, idx) => {
      const seconds = typeof r.avg_response_ms === 'number'
        ? (r.avg_response_ms / 1000)
        : null;
      return {
        rank: idx + 1,
        username: nameById.get(r.user_id ?? r.user_if) || '(unknown)',
        averageAnswerTime: seconds != null ? seconds.toFixed(2) : null,
        points: r.points || 0,
      };
    });

    return res.status(200).json({ ok: true, scores: formatted });
  } catch (error) {
    console.error('Error in game endscores endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

export default router;