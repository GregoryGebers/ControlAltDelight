import supabase from '../database/config/supabaseClient.js';

const ROUNDS_PER_GAME = 4;
const QUESTIONS_PER_ROUND = 7;
const TOTAL_QUESTIONS_NEEDED = 28;

const difficultyMap = {
  'easy': '89f0cf9d-c8ad-4476-b91a-1816fb0eaad2',
  'medium': '2038298b-5cb1-4d94-b836-a8ca22331989',
  'hard': 'de1fbc8c-bbb3-4034-a31a-84ad324f5fab'
};

async function getCategoryId(categoryName) {
  try {
    const { data: existingCategory, error: findError } = await supabase
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

    const { data: newCategory, error: createError } = await supabase
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

export async function updateMatchStatus(match_id, match_status) {
  try {
    const { data: updated, error: updateErr } = await supabase
      .from('matches')
      .update({ status: match_status }) 
      .eq('match_id', match_id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }
    return updated;
  } catch (err) {
    console.error('Error in updateMatchStatus:', err);
    throw err;
  }
}
export async function updateMatchCompletedDate(match_id) {
  try {
    const { data: updated, error: updateErr } = await supabase
      .from('matches')
      .update({ completed_at: new Date().toISOString() }) // Use ISO 8601 format
      .eq('match_id', match_id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update match completed date: ${updateErr.message}`);
    }

    return updated;
  } catch (err) {
    console.error('Error in updateMatchCompletedDate:', err);
    throw err;
  }
}

export async function updateScores(match_id, user_id, points_received, question_correct, question_response_time) {
  try {
    // Fetch existing score record for the user in the match
    const { data: existingScore, error: fetchError } = await supabase
      .from('match_scores')
      .select('points, correct_count, questions_answered, total_response_time_ms')
      .eq('match_id', match_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }
    const isNewRecord = !existingScore;
    const newTotalScore = isNewRecord ? points_received : existingScore.points + points_received;
    const newCorrectAnswers = isNewRecord ? (question_correct ? 1 : 0) : existingScore.correct_count + (question_correct ? 1 : 0);
    const newTotalQuestions = isNewRecord ? 1 : (existingScore.questions_answered ?? 0) + 1;
    const newTotalResponseTime = isNewRecord ? question_response_time : existingScore.total_response_time_ms + question_response_time;
    const newAvgResponseTime = Math.round(newTotalResponseTime / newTotalQuestions); // Round to integer for bigint

    const scoreData = {
      match_id,
      user_id,
      points: newTotalScore,
      correct_count: newCorrectAnswers,
      questions_answered: newTotalQuestions,
      total_response_time_ms: newTotalResponseTime,
      avg_response_ms: newAvgResponseTime
    };

    if (isNewRecord) {
      const { data: inserted, error: insertError } = await supabase
        .from('match_scores')
        .insert([scoreData])
        .select()
        .maybeSingle();
      if (insertError) throw insertError;
      return inserted ?? scoreData;
    } else {
      const { data: updated, error: updateError } = await supabase
        .from('match_scores')
        .update({
          points: newTotalScore,
          correct_count: newCorrectAnswers,
          questions_answered: newTotalQuestions,
          total_response_time_ms: newTotalResponseTime,
          avg_response_ms: newAvgResponseTime
        })
        .eq('match_id', match_id)
        .eq('user_id', user_id)
        .select()
        .maybeSingle();
      if (updateError) throw updateError;
      return updated ?? scoreData;
    }
  } catch (err) {
    console.error('Error in updateScores:', err);
    throw err;
  }
}

export async function deactivateQuestions(match_id) {
  try {
    const { data: rounds, error: roundsError } = await supabase
      .from('match_rounds')
      .select('round_id')
      .eq('match_id', match_id);

    if (roundsError) {
      throw roundsError;
    }

    if (!rounds || rounds.length === 0) {
      console.log('No rounds found for match_id:', match_id);
      return [];
    }

    const roundIds = rounds.map(round => round.round_id);

    const { data: roundQuestions, error: questionsError } = await supabase
      .from('round_questions')
      .select('question_id')
      .in('match_round_id', roundIds);

    if (questionsError) {
      throw questionsError;
    }

    if (!roundQuestions || roundQuestions.length === 0) {
      console.log('No questions found for rounds:', roundIds);
      return [];
    }

    const questionIds = roundQuestions.map(rq => rq.question_id);

    const { data: updated, error: updateErr } = await supabase
      .from('questions')
      .update({ is_active: false })
      .in('question_id', questionIds)
      .select();

    if (updateErr) {
      throw updateErr;
    }

    return updated;
  } catch (err) {
    console.error('Error in deactivateQuestions:', err);
    throw err;
  }
}

export async function fetchQuestionsInRounds(category, rounds, match_id) {
  console.log(rounds);
  if (rounds.length !== ROUNDS_PER_GAME) {
    throw new Error(`Invalid number of rounds provided. Expected ${ROUNDS_PER_GAME}, received ${rounds.length}`);
  }

  try {
    const roundsData = [];
    // Process one round at a time
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const diff = rounds[i];
      const diff_id = difficultyMap[diff.toLowerCase()];

      // Fetch available (is_active = false) questions for the given category and difficulty
      const { data, error } = await supabase
        .from('questions')
        .select(`
          question_id,
          prompt,
          is_active,
          cat_id,
          diff_id,
          question_options ( answer_option, is_correct )
        `)
        .eq('cat_id', category) 
        .eq('diff_id', diff_id)
        .eq('is_active', false);
      if (error) {
        console.error('Error fetching questions:', error);
        throw new Error('Failed to fetch questions from database');
      }
      if (data.length < QUESTIONS_PER_ROUND) {
        throw new Error(
          `Not enough questions available for difficulty "${diff}" in category "${category}". ` +
          `Need ${QUESTIONS_PER_ROUND}, found ${data.length}`
        );
      }

      // Shuffle and select questions
      const shuffled = shuffleArray(data);
      const selected = shuffled.slice(0, QUESTIONS_PER_ROUND);
            
      if (!diff_id) {
        throw new Error(`Invalid difficulty: ${diff}. Valid difficulties are: ${Object.keys(difficultyMap).join(', ')}`);
      }
      
      console.log(`Round ${i + 1}: difficulty=${diff}, diff_id=${diff_id}, match_id=${match_id}`);
      
      const { data: insertedRound, error: insertError } = await supabase
          .from('match_rounds')
          .insert([{
            match_id: match_id,
            round_number: i + 1,
            difficulty_id: diff_id
          }])
          .select()
          .single();

      if (insertError) {
        console.error('Error inserting match round:', insertError);
        throw new Error('Failed to insert match round into database');
      }

      const roundId = insertedRound.round_id;      
      console.log(`Inserted round: roundId=${roundId}, match_id=${match_id}, round_number=${i + 1}`);
      const questionRows = selected.map((question, index) => ({
        match_round_id: roundId,
        question_id: question.question_id,
        time_limit_seconds: 20
      }));

      const { data: savedQuestions, error: questionsError } = await supabase
        .from('round_questions')
        .insert(questionRows)
        .select();

      if (questionsError) {
        console.error('Error inserting round questions:', questionsError);
        throw new Error('Failed to insert questions into round_questions table');
      }

      // Normalize selected questions
      const normalized = selected.map(q => ({
        id: q.question_id,
        prompt: q.prompt,
        isActive: q.is_active,
        category: q.cat_id ?? null,
        difficulty: q.diff_id ?? null,
        options: q.question_options.map(opt => ({
          text: opt.answer_option,
          correct: opt.is_correct
        }))
      }));
      console.log(normalized);
      roundsData.push(normalized);

      // Collect IDs to mark as active
      const selectedIds = selected.map(q => q.question_id);
      // Update selected questions active status
      if (selectedIds.length > 0) {
        const { error: updateError } = await supabase
          .from('questions')
          .update({ is_active: true })
          .in('question_id', selectedIds);

        if (updateError) {
          console.error('Error updating questions:', updateError);
          throw new Error('Failed to update selected questions in database');
        }
      }
    }

    return {
      success: true,
      totalRounds: ROUNDS_PER_GAME,
      questionsPerRound: QUESTIONS_PER_ROUND,
      totalQuestions: TOTAL_QUESTIONS_NEEDED,
      rounds: roundsData,
      createdAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in fetchQuestionsInRounds:', error);
    throw error;
  }
}

export async function fetchMatchQuestions(matchId) {
  try {
    const { data: rounds, error: roundsError } = await supabase
      .from('match_rounds')
      .select('round_id, round_number, difficulty_id')
      .eq('match_id', matchId)
      .order('round_number', { ascending: true });

    if (roundsError) {
      console.error('Error fetching match rounds:', roundsError);
      throw new Error('Failed to fetch match rounds');
    }
    if (!rounds || rounds.length === 0) {
      throw new Error('No rounds found for this match');
    }

    const roundsData = [];
    let questionsPerRoundDetected = null;
    let totalQuestions = 0;

    for (const r of rounds) {
      const { data: rq, error: rqErr } = await supabase
        .from('round_questions')
        .select(`
          question_id,
          time_limit_seconds,
          questions (
            question_id,
            prompt,
            cat_id,
            diff_id,
            question_options (
              answer_option,
              is_correct
            )
          )
        `)
        .eq('match_round_id', r.round_id);

      if (rqErr) {
        console.error('Error fetching round questions:', rqErr);
        throw new Error('Failed to fetch round questions');
      }

      const normalized = (rq || []).map(row => {
        const q = row?.questions || {};
        return {
          id: q.question_id,
          prompt: q.prompt,
          category: q.cat_id ?? null,
          difficulty: q.diff_id ?? r.difficulty_id ?? null,
          options: (q.question_options || []).map(opt => ({
            text: opt.answer_option,
            correct: opt.is_correct
          }))
        };
      });

      if (questionsPerRoundDetected == null) {
        questionsPerRoundDetected = normalized.length || QUESTIONS_PER_ROUND;
      }
      totalQuestions += normalized.length;

      roundsData.push({
        roundNumber: r.round_number,
        difficulty: r.difficulty_id,
        questions: normalized
      });
    }

    return {
      success: true,
      totalRounds: rounds.length,
      questionsPerRound: questionsPerRoundDetected ?? QUESTIONS_PER_ROUND,
      totalQuestions,
      rounds: roundsData,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in fetchMatchQuestions:', error);
    throw error;
  }
}

export async function fetchSpecificRound(roundNumber) {
  if (roundNumber < 1 || roundNumber > ROUNDS_PER_GAME) {
    throw new Error(`Invalid round number: ${roundNumber}. Must be between 1 and ${ROUNDS_PER_GAME}`);
  }

  const gameData = await fetchQuestionsInRounds();
  return gameData.rounds[roundNumber - 1];
}

export function getGameConfig() {
  return {
    roundsPerGame: ROUNDS_PER_GAME,
    questionsPerRound: QUESTIONS_PER_ROUND,
    totalQuestionsNeeded: TOTAL_QUESTIONS_NEEDED,
    availableDifficulties: Object.keys(difficultyMap)
  };
}

export default {
  fetchQuestionsInRounds,
  fetchSpecificRound,
  getGameConfig
};
