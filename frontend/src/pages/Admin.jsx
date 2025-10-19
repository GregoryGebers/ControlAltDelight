import "../index.css";
import './Admin.css'
import './MyMatches.css';
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

function Questions() {
    const dropdown_category = ["General Knowledge", "Science", "Entertainment", "Sports", "Geography", "Politics", "None"];
    const dropdown_difficulty = ["Easy", "Medium", "Hard", "None"];
    const [chosenCategory, setChosenCategory] = useState('None');
    const [chosenDifficulty, setChosenDifficulty] = useState('None');
    const [questions, setQuestions] = useState([]);
    const [filteredQuestions, setFilteredQuestions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // const [editing, setEditing] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState(null);


    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async() => {
        try {
            setLoading(true);
            const res = await fetch('/api/questions');

            if (!res.ok) {
                throw new Error('Failed to fetch questions');
            }

            const data = await res.json();

            setQuestions(data);
            setFilteredQuestions(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching questions:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let filtered = questions;

        if (chosenCategory !== 'None') {
            filtered = filtered.filter(q => 
                q.category?.toLowerCase() === chosenCategory.toLowerCase()
            );
        }

        if (chosenDifficulty !== 'None') {
            filtered = filtered.filter(q => 
                q.difficulty?.toLowerCase() === chosenDifficulty.toLowerCase()
            );
        }

        if (searchTerm.trim()) {
            filtered = filtered.filter(q =>
                q.prompt?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredQuestions(filtered);
    }, [chosenCategory, chosenDifficulty, searchTerm, questions]);

   const handleEditStart = (question) => {
        setEditingQuestion({
            ...question,
            // Create a copy of options for editing
            options: question.options ? [...question.options] : []
        });
    };

    const handleEditCancel = () => {
        setEditingQuestion(null);
    };
    
    const handleEditSave = async () => {
        if (!editingQuestion) return;

        // Validate data before sending
        if (!editingQuestion.difficulty) {
            alert('Error: Difficulty is missing!');
            return;
        }

        if (!editingQuestion.category) {
            alert('Error: Category is missing!');
            return;
        }

        if (!editingQuestion.options || editingQuestion.options.length === 0) {
            alert('Error: Options are missing!');
            return;
        }

        const payload = {
            prompt: editingQuestion.prompt,
            category: editingQuestion.category,
            difficulty: editingQuestion.difficulty.toLowerCase().trim(),
            options: editingQuestion.options.map(opt => opt.text),
            correctIndex: editingQuestion.options.findIndex(opt => opt.correct)
        };

        console.log('Payload being sent:', payload);

        try {
            const res = await fetch(`/api/questions/${editingQuestion.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            console.log('Response from server:', result);

            if (!res.ok) {
                throw new Error(result.error || 'Failed to update question');
            }

            // Update local state with normalized difficulty
            const updatedQuestion = {
                ...editingQuestion,
                difficulty: editingQuestion.difficulty.toLowerCase()
            };

            setQuestions(prev => prev.map(q => 
                q.id === editingQuestion.id ? updatedQuestion : q
            ));

            setEditingQuestion(null);
            alert('Question successfully updated!');
        } catch (err) {
            console.error('Error updating question:', err);
            alert('Failed to update question: ' + err.message);
        }
    };
    
    const handleQuestionEdit = () => {
        //How will we handle deleting or manually editing the table of questions in the database? 
    };

    const handlePromptChange = (newPrompt) => {
        setEditingQuestion(prev => ({
            ...prev,
            prompt: newPrompt
        }));
    };
    
    const handleCorrectAnswerChange = (correctIndex) => {
        setEditingQuestion(prev => ({
            ...prev,
            options: prev.options.map((opt, index) => ({
                ...opt,
                correct: index === correctIndex
            }))
        }));
    };

    const handleOptionChange = (index, newText) => {
        setEditingQuestion(prev => ({
            ...prev,
            options: prev.options.map((opt, i) => 
                i === index ? { ...opt, text: newText } : opt
            )
        }));
    };

    const getCorrectAnswer = (options) => {
        if (!options || options.length === 0) return 'N/A';
        const correctOption = options.find(opt => opt.correct);
        return correctOption ? correctOption.text : 'N/A';
    };

    const handleQuestionDelete = async (questionId) => {
        if(!confirm('Are you sure you want to delete this question?')) {
            return;
        }

        try {
            const res = await fetch(`/api/questions/${questionId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                throw new Error('Failed to delete question');
            }

            setQuestions(prev => prev.filter(q => q.id !== questionId));
            alert('Question succesfully deleted!');
        } catch (err) {
            console.error('Error deleting question:', err);
            alert('Failed to delete question: ' + err.message);
        }
    }

    const isEditing = (questionId) => {
        return editingQuestion && editingQuestion.id === questionId;
    };

    return (
        <div className='matches-container'>
            <h1>questions</h1>

            <div className='sorting-container'>
                <div className='sort-term-matches'>
                    <input 
                        className='input-search'
                        type='text'
                        placeholder='Search Questions...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className='sort-category'>
                    <Dropdown 
                        buttonText={chosenCategory === 'None' ? 'Filter Category' : chosenCategory}
                        givenWidth="300px"
                        content={
                            <>
                                {
                                    dropdown_category.map(item => (
                                        <DropdownItem 
                                            key={item} 
                                            onClick={() => setChosenCategory(item)}
                                        >
                                            {item}
                                        </DropdownItem>
                                    ))
                                }
                            </>
                        }
                    />
                </div>

                <div className='sort-difficulty'>
                    <Dropdown 
                        buttonText={chosenDifficulty === 'None' ? 'Filter Difficulty' : chosenDifficulty}
                        givenWidth="250px"
                        content={
                            <>
                                {
                                    dropdown_difficulty.map(item => (
                                        <DropdownItem 
                                            key={item} 
                                            onClick={() => setChosenDifficulty(item)}
                                        >
                                            {item}
                                        </DropdownItem>
                                    ))
                                }
                            </>
                        }
                    />
                </div>

            </div>

            {/* <div className='buttons-container'>
                <div className='button blue'>
                    Load More Questions
                </div>
                
                <div 
                    className='button blue' 
                    onClick={() => setEditing(!editing)}
                >
                    {!editing ? ('Edit Questions'):('Save Questions')}
                </div>
            </div> */}

            {loading && (
                <p>Loading questions...</p> 
            )}

            {error && (
                <p>Error: {error}</p> 
            )}

            {!loading && !error && (
                <div className='table'>
                    {/* INSERT Questions DATA HERE - backend call for questions table. want to display entuire table and make it scrollable. Dont know how to do that*/}
                    <table className="common-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Difficulty</th>
                                <th>Question</th>
                                <th>Answer</th>
                                <th>All Options</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQuestions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{textAlign: 'center'}}>No questions found.</td>
                                </tr>
                            ) : (
                                filteredQuestions.map((question) => (
                                    <tr key={question.id}>
                                        <td>{question.category || 'N/A'}</td>
                                        <td>{question.difficulty || 'N/A'}</td>
                                        <td>
                                            {isEditing(question.id) ? (
                                                <textarea 
                                                    value={editingQuestion.prompt || ''}
                                                    onChange={(e) => handlePromptChange(e.target.value)}
                                                    rows="3"
                                                    style={{width: '100%'}}
                                                />
                                            ) : (
                                                question.prompt || 'N/A'
                                            )}
                                        </td>
                                        <td>
                                            {getCorrectAnswer(question.options)}
                                        </td>
                                        <td>
                                            {isEditing(question.id) ? (
                                                <div className="options-editor">
                                                    {editingQuestion.options.map((option, index) => (
                                                        <div key={index} className="option-row">
                                                            <input
                                                                type="radio"
                                                                name={`correct-${editingQuestion.id}`}
                                                                checked={option.correct}
                                                                onChange={() => handleCorrectAnswerChange(index)}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={option.text}
                                                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                                                style={{marginLeft: '8px', width: '200px'}}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <ul style={{margin: 0, paddingLeft: '20px', textAlign: 'left'}}>
                                                    {question.options && question.options.map((option, index) => (
                                                        <li 
                                                            key={index}
                                                            style={{
                                                                fontWeight: option.correct ? 'bold' : 'normal',
                                                                color: option.correct ? 'green' : 'inherit'
                                                            }}
                                                        >
                                                            {option.text}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                        <td>
                                            {isEditing(question.id) ? (
                                                <div className="edit-actions">
                                                    <div 
                                                        className="button-small green"
                                                        onClick={handleEditSave}
                                                    >
                                                        Save
                                                    </div>
                                                    <div 
                                                        className="button-small gray"
                                                        onClick={handleEditCancel}
                                                        style={{marginTop: '4px'}}
                                                    >
                                                        Cancel
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="normal-actions">
                                                    <div 
                                                        className="button-small blue"
                                                        onClick={() => handleEditStart(question)}
                                                    >
                                                        Edit
                                                    </div>
                                                    <div 
                                                        className="button-small red"
                                                        onClick={() => handleQuestionDelete(question.id)}
                                                        style={{marginTop: '4px'}}
                                                    >
                                                        Delete
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
    </div>

)
}

export default Questions
    