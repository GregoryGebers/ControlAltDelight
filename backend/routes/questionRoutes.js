// Tables in DB - still need to do update for all and delete for most
// Categories [x]
// difficulties [x]
// question options [x]
// questions [x]
// responses []
// round questions []

import express from 'express';
import {createAnonClient, supabaseAdmin} from '../database/config/supabaseClient.js';
import { requireUser } from '../backendapp.js';
import 'dotenv/config';

const router = express.Router();

const easy = '89f0cf9d-c8ad-4476-b91a-1816fb0eaad2';
const medium = '2038298b-5cb1-4d94-b836-a8ca22331989';
const hard = 'de1fbc8c-bbb3-4034-a31a-84ad324f5fab';

const difficultyMap = {
  'easy': easy,
  'medium': medium,
  'hard': hard
};

// Function to get or create category
async function getCategoryId(categoryName) {
  try {
    // try to find existing category
    const { data: existingCategory, error: findError } = await supabaseAdmin
      .from('categories')
      .select('cat_id')
      .eq('name', categoryName)
      .single();

    if (existingCategory) {
      return existingCategory.cat_id;
    }

    // if not found, create new category
    const { data: newCategory, error: createError } = await supabaseAdmin
      .from('categories')
      .insert([{ name: categoryName }])
      .select('cat_id')
      .single();

    if (createError) {
      console.error('Error creating category:', createError);
      throw createError;
    }

    return newCategory.cat_id;
  } catch (error) {
    console.error('Error in getCategoryId:', error);
    throw error;
  }
}

// end point to get questions from db
router.get('/questions', async (req, res) => {
  try {
    const { difficulty, category } = req.query;
    
    let query = supabaseAdmin
      .from('questions')
      .select(`
        question_id,
        prompt,
        is_active,
        categories:cat_id ( cat_id, name ),
        difficulties:diff_id ( diff_id, type ),
        question_options ( answer_option, is_correct )
      `);
      
    // can filter on both 
    if (difficulty) {
      // filter by difficulty
      const difficultyId = difficultyMap[difficulty.toLowerCase()];
      if (difficultyId) {
        query = query.eq('diff_id', difficultyId);
      }
    }
    
    if (category) {
      // filter by category
      try {
        const categoryId = await getCategoryId(category);
        query = query.eq('cat_id', categoryId);
      } catch (error) {
        console.error('Error getting category ID:', error);
        return res.status(400).json({ error: 'Invalid category' });
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching questions:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const normalized = (data ?? []).map(q => ({
      id: q.question_id,
      prompt: q.prompt,
      isActive: q.is_active,
      category: q.categories ? q.categories.name : null,
      // difficulty: q.difficulties ? q.difficulties.type : null,
      difficulty: q.difficulties ? q.difficulties.type.toLowerCase() : null,
      options: (q.question_options ?? []).map(opt => ({
        text: opt.answer_option,
        correct: opt.is_correct
      }))
    }));

    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error in getAllQuestions endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// endpoint to get a single question by ID
router.get('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select(`
        question_id,
        prompt,
        is_active,
        categories:cat_id ( cat_id, name ),
        difficulties:diff_id ( diff_id, type ),
        question_options ( answer_option, is_correct )
      `)
      .eq('question_id', id)
      .single();

    if (error) {
      console.error('Error fetching question:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Question not found' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }

    const normalized = {
      id: data.question_id,
      prompt: data.prompt,
      isActive: data.is_active,
      category: data.categories ? data.categories.name : null,
      // difficulty: data.difficulties ? data.difficulties.type : null,
      difficulty: data.difficulties ? data.difficulties.type.toLowerCase() : null,
      options: (data.question_options ?? []).map(opt => ({
        text: opt.answer_option,
        correct: opt.is_correct
      }))
    };

    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error in getQuestion endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// endpoint to update a question and its answers
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, category, difficulty, options, correctIndex } = req.body;

    if (!prompt || !category || !difficulty || !options || !Array.isArray(options) || correctIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields: prompt, category, difficulty, options (array), and correctIndex' });
    }

    // Get category ID
    const categoryId = await getCategoryId(category);
    
    // Get difficulty ID
    const difficultyId = difficultyMap[difficulty.toLowerCase()];
    if (!difficultyId) {
      return res.status(400).json({ error: `Unknown difficulty: ${difficulty}` });
    }

    // Update the question
    const { data: updatedQuestion, error: questionError } = await supabase
      .from('questions')
      .update({
        cat_id: categoryId,
        diff_id: difficultyId,
        prompt: prompt,
      })
      .eq('question_id', id)
      .select()
      .single();

    if (questionError) {
      console.error('Error updating question:', questionError);
      return res.status(500).json({ error: 'Error updating question', details: questionError.message });
    }

    if (!updatedQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Delete existing options
    const { error: deleteError } = await supabase
      .from('question_options')
      .delete()
      .eq('question_id', id);

    if (deleteError) {
      console.error('Error deleting old options:', deleteError);
      return res.status(500).json({ error: 'Error updating question options' });
    }

    // Insert new options
    const answerOptions = options.map((option, index) => ({
      question_id: id,
      answer_option: option,
      is_correct: index === correctIndex
    }));

    const { data: newOptions, error: optionsError } = await supabase
      .from('question_options')
      .insert(answerOptions)
      .select();

    if (optionsError) {
      console.error('Error inserting new options:', optionsError);
      return res.status(500).json({ error: 'Error updating question options' });
    }

    res.status(200).json({
      ok: true,
      message: 'Question updated successfully',
      question: updatedQuestion,
      options: newOptions
    });
  } catch (error) {
    console.error('Error in updateQuestion endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to insert a single question with its answers
async function insertQuestion(questionData) {
  try {
    // get category ID
    const categoryId = await getCategoryId(questionData.category);
    
    // get difficulty ID
    const difficultyId = difficultyMap[questionData.difficulty.toLowerCase()];
    if (!difficultyId) {
      throw new Error(`Unknown difficulty: ${questionData.difficulty}`);
    }

    // insert the question
    const { data: questionRow, error: questionError } = await supabaseAdmin
      .from('questions')
      .insert([{
        cat_id: categoryId,
        diff_id: difficultyId,
        prompt: questionData.question || questionData.prompt,
        source_url: "https://opentdb.com/api.php",
        is_active: questionData.isActive || false
      }])
      .select('question_id')
      .single();

    if (questionError) {
      console.error('Error inserting question:', questionError);
      throw questionError;
    }

    // insert the answer options
    if (!questionData.options || !Array.isArray(questionData.options) || questionData.correctIndex === undefined) {
      throw new Error('Options array and correctIndex are required');
    }

    const answerOptions = questionData.options.map((option, index) => ({
      question_id: questionRow.question_id,
      answer_option: option,
      is_correct: index === questionData.correctIndex
    }));

    const { data: optionsData, error: optionsError } = await supabaseAdmin
      .from('question_options')
      .insert(answerOptions)
      .select();

    if (optionsError) {
      console.error('Error inserting answer options:', optionsError);
      throw optionsError;
    }

    return {
      question: questionRow,
      options: optionsData
    };
  } catch (error) {
    console.error('Error in insertQuestion:', error);
    throw error;
  }
}

// API endpoint to insert questions from JSON file
router.post('/insertQuestions', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    
    // Read the questions JSON file
    const questionsFile = await fs.readFile('../webscraper/trivia-collecter/questions.json', 'utf8');
    const questionsData = JSON.parse(questionsFile);
    
    const insertedQuestions = [];
    const errors = [];
    
    // process each question
    for (let i = 0; i < questionsData.questions.length; i++) {
      const originalData = questionsData.questions[i];
      
      // Map the scraped format to the expected format
      const questionData = {
        prompt: originalData.question,
        category: originalData.category,
        difficulty: originalData.difficulty,
        options: originalData.answers,
        correctIndex: originalData.correctIndex,
        isActive: true
      };
      
      try {
        const result = await insertQuestion(questionData);
        insertedQuestions.push({
          originalIndex: i,
          questionId: result.question.question_id,
          prompt: questionData.prompt,
          category: questionData.category,
          difficulty: questionData.difficulty
        });
        
        // Log progress
        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${questionsData.questions.length} questions`);
        }
      } catch (error) {
        console.error(`Error processing question ${i}:`, error);
        errors.push({
          index: i,
          question: questionData.prompt,
          error: error.message
        });
      }
    }
    
    return res.status(200).json({
      ok: true,
      message: `Successfully inserted ${insertedQuestions.length} questions`,
      totalProcessed: questionsData.questions.length,
      successCount: insertedQuestions.length,
      errorCount: errors.length,
      insertedQuestions,
      errors: errors.length > 0 ? errors : undefined
    });
      
  } catch (err) {
    console.error('Error in insertQuestions endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});

// endpoint to add a single question
router.post('/questions', async (req, res) => {
  try {
    const { prompt, category, difficulty, options, correctIndex, isActive } = req.body;

    if (!prompt || !category || !difficulty || !options || !Array.isArray(options) || correctIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields: prompt, category, difficulty, options (array), and correctIndex' });
    }

    const result = await insertQuestion({ prompt, category, difficulty, options, correctIndex, isActive });
    res.status(201).json({
      ok: true,
      message: 'Question created successfully',
      questionId: result.question.question_id,
      prompt: result.question.prompt,
      category,
      difficulty,
      options: result.options.map(opt => ({ text: opt.answer_option, correct: opt.is_correct }))
    });
  } catch (error) {
    console.error('Error in createQuestion endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to insert questions from request body
router.post('/insertQuestionsFromBody', async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        ok: false,
        error: "Questions array is required in request body"
      });
    }
    
    const insertedQuestions = [];
    const errors = [];
    
    // Process each question
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      
      try {
        const result = await insertQuestion(questionData);
        insertedQuestions.push({
          originalIndex: i,
          questionId: result.question.question_id,
          prompt: questionData.question,
          category: questionData.category,
          difficulty: questionData.difficulty
        });
      } catch (error) {
        console.error(`Error processing question ${i}:`, error);
        errors.push({
          index: i,
          question: questionData.question,
          error: error.message
        });
      }
    }
    
    return res.status(200).json({
      ok: true,
      message: `Successfully inserted ${insertedQuestions.length} questions`,
      totalProcessed: questions.length,
      successCount: insertedQuestions.length,
      errorCount: errors.length,
      insertedQuestions,
      errors: errors.length > 0 ? errors : undefined
    });
      
  } catch (err) {
    console.error('Error in insertQuestionsFromBody endpoint:', err);
    return res.status(500).json({
      ok: false, 
      error: "Server error: " + err.message
    });
  }
});

// endpoint to delete a question and its answers by ID
router.delete('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // delete the answer options
    const { error: optionsError } = await supabaseAdmin
      .from('question_options')
      .delete()
      .eq('question_id', id);

    if (optionsError) {
      console.error('Error deleting question options:', optionsError);
      return res.status(500).json({ error: 'Error deleting question options' });
    }

    // delete the question
    const { data, error: questionError } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('question_id', id)
      .select();

    if (questionError) {
      console.error('Error deleting question:', questionError);
      return res.status(500).json({ error: 'Error deleting question' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.status(200).json({
      ok: true,
      message: 'Question and its answers deleted successfully',
      deletedQuestion: data[0]
    });
  } catch (error) {
    console.error('Error in deleteQuestion endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;