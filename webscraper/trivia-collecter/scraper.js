import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import axios from 'axios';
import he from 'he';
import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';

// Setup command line
const argv = yargs(hideBin(process.argv))
  .option('output', {
    type: 'string', 
    default: 'questions.json',
    description: 'Output file name'
  })
  .parse();


const CATEGORIES = {
  'General Knowledge': 9,
  'Science & Nature': 17,
  'Entertainment': 11,
  'Geography': 22,
  'Sports': 21,
  'Politics': 24
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUESTIONS_PER_CAT = 500;

// Helper functions
function cleanText(text) {
  return he.decode(String(text)).replace(/\s+/g, ' ').trim();
}

function generateId(question, answers, correctIndex) {
  const content = `${question}|${answers.join('|')}|${correctIndex}`;
  return createHash('sha256').update(content.toLowerCase()).digest('hex');
}

// Fetch questions from API
async function getQuestions(categoryId, difficulty, count) {
  try {
    const response = await axios.get('https://opentdb.com/api.php', {
      params: {
        amount: count,
        category: categoryId,
        difficulty: difficulty
        // No type specified - get both multiple choice and true/false
      },
      timeout: 15000
    });

    if (response.data.response_code !== 0) {
        if (response.data.response_code === 1) {
        console.log(`No ${difficulty} questions available for category ${categoryId}`);
      }
      return [];}

    return response.data.results.map(item => {
      // Handle both question types
      const allAnswers = item.type === 'boolean' 
        ? ['True', 'False']
        : [...item.incorrect_answers, item.correct_answer];
      
      const cleanedAnswers = allAnswers.map(cleanText);
      const correctIndex = cleanedAnswers.findIndex(
        ans => ans.toLowerCase() === cleanText(item.correct_answer).toLowerCase()
      );

      return {
        question: cleanText(item.question),
        category: cleanText(item.category),
        difficulty: item.difficulty,
        answers: cleanedAnswers,
        correctIndex: correctIndex,
        type: item.type
      };
    });
    
  } catch (error) {
    console.log(`Failed to get ${difficulty} questions for category ${categoryId}`);
    return [];
  }
}

// Main function
async function collectQuestions() {
  const allQuestions = [];
  const seenIds = new Set();

  console.log('Starting question collection...');

  const BATCH_SIZE = 50;
  for (const [categoryName, categoryId] of Object.entries(CATEGORIES)) {
    console.log(`Getting questions for: ${categoryName}`);
    for (const difficulty of DIFFICULTIES) {
      let collected = 0;
      let attempts = 0;
      while (collected < QUESTIONS_PER_CAT && attempts < 20) {
        const batchSize = Math.min(BATCH_SIZE, QUESTIONS_PER_CAT - collected);
        const questions = await getQuestions(categoryId, difficulty, batchSize);
        let added = 0;
        for (const q of questions) {
          // Skip true/false questions
          if (q.type === 'boolean') continue;
          // Skip if answers array is empty or contains blank options
          if (!Array.isArray(q.answers) || q.answers.length === 0) continue;
          if (q.answers.some(ans => !ans || ans.trim() === '')) continue;
          const id = generateId(q.question, q.answers, q.correctIndex);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allQuestions.push({
              id: id,
              ...q
            });
            added++;
          }
        }
        collected += added;
        attempts++;
        if (questions.length === 0) {
          console.log(`No more ${difficulty} questions available for category ${categoryName}`);
          break;
        }
        // Delay for rate limits.
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
      if (collected < QUESTIONS_PER_CAT) {
        console.log(`Only collected ${collected} ${difficulty} questions for category ${categoryName}`);
      }
    }
  }

  return allQuestions;
}

// Save to file
async function saveQuestions(questions, filename) {
  const output = {
    totalQuestions: questions.length,
    questions: questions
  };

  await writeFile(filename, JSON.stringify(output, null, 2));
  console.log(`Saved ${questions.length} questions to ${filename}`);
}

// Run 
async function main() {
  try {
    const questions = await collectQuestions();
    
    if (questions.length === 0) {
      console.log('No questions were collected');
      return;
    }

    await saveQuestions(questions, argv.output);
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();