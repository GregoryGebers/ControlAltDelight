import "../index.css";
import './Match.css';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';

/**
 * Match Page.
 * 
 * This function is the page that is used when the user is in a match.
 * 
 * @returns {JSX.Element} Match page with elements
 */
function Match() {

    const [audio] = useState(new Audio('/music.mp3'));
    const [isMuted, setIsMuted] = useState(false);

    const toggleMute = () => {
    audio.muted = !audio.muted;
    setIsMuted(!isMuted);
    };

    useEffect(() => {
        audio.loop = true; // keep playing
        audio.volume = 0.5; // optional: set to comfortable level
        audio.play().catch(err => console.log("Autoplay blocked:", err));

        // stop when leaving page
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [audio]);

    const menuRef = useRef(null);
    const navigate = useNavigate();
    const { socket } = useSocket();
    
    const [secondsLeft, setSecondsLeft] = useState(20);
    const [roundNumber, setRoundNumber] = useState(1);
    const [questionNumber, setQuestionNumber] = useState(1);
    const [currentPoints, setCurrentPoints] = useState(0);
    const [question, setQuestion] = useState('Loading question...');

    // Question options
    const [options, setOptions] = useState(['', '', '', '']);
    
    const [totalRounds, setTotalRounds] = useState(4);
    const [questionsPerRound, setQuestionsPerRound] = useState(7);

    // Calculating how much of the bars are filled
    const fillPercentage = (secondsLeft / 20) * 100;
    const fillPercentageGame = (((roundNumber - 1) * questionsPerRound + questionNumber) / (totalRounds * questionsPerRound)) * 100;

    const [showPopup, setShowPopup] = useState(false);
    const [popupType, setPopupType] = useState("");
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        if (!socket) return;

        socket.on('timer', (timerValue) => {
            console.log('Timer update received:', timerValue);
            setSecondsLeft(timerValue);
            if (timerValue === 0) {
                setSelectedAnswer(null);
                setHasAnswered(false);
                setCorrectAnswerIndex(null);
            }
        });

        // listen for question data
        socket.on('question_loaded', (questionData) => {
            console.log('Question loaded:', questionData);
            setRoundNumber(questionData.round);
            setQuestionNumber(questionData.questionNumber);
            setTotalRounds(questionData.totalRounds);
            setQuestionsPerRound(questionData.questionsPerRound);
            setQuestion(questionData.question);
            
            const newOptions = [...questionData.options];
            while (newOptions.length < 4) {
                newOptions.push('');
            }
            setOptions(newOptions.slice(0, 4));
        });

        socket.on('answer_result', (result) => {
            console.log('Answer result:', result);
            setCurrentPoints(result.newTotalScore);
            // Visual feedback: set correct answer index
            if (typeof result.correctAnswer === 'string') {
                const idx = options.findIndex(opt => opt === result.correctAnswer);
                setCorrectAnswerIndex(idx);
            }
        });

        // Personal score updates from server
        socket.on('my_score', (payload) => {
            try {
                if (typeof payload?.score === 'number') {
                    setCurrentPoints(payload.score);
                }
            } catch {
                // ignore
            }
        });

        // Listen for leaderboard updates
        socket.on('leaderboard_update', (lb) => {
            console.log('Leaderboard update:', lb);
            setLeaderboard(lb || []);
            // Update current score from the leaderboard
            try {
                const uname = localStorage.getItem('username');
                if (uname) {
                    const me = (lb || []).find(p => p.username === uname);
                    if (me) setCurrentPoints(me.score);
                }
            } catch {
                // ignore client-side username lookup errors
            }
        });

        socket.on('game_ended', () => {
            console.log('Game ended');
            navigate('/mymatches/postgame');
        });

        const readyTimer = setTimeout(() => {
            console.log('Match component ready, signaling backend to start timer');
            socket.emit('match_component_ready');
            // Ask for initial leaderboard snapshot
            socket.emit('get_leaderboard', {}, (resp) => {
                if (resp?.ok && Array.isArray(resp.leaderboard)) {
                    setLeaderboard(resp.leaderboard);
                    try {
                        const uname = localStorage.getItem('username');
                        if (uname) {
                            const me = resp.leaderboard.find(p => p.username === uname);
                            if (me) setCurrentPoints(me.score);
                        }
                    } catch {
                        // ignore client-side username lookup errors
                    }
                }
            });
        }, 500);

        return () => {
            clearTimeout(readyTimer);
            socket.off('timer');
            socket.off('question_loaded');
            socket.off('answer_result');
            socket.off('my_score');
            socket.off('leaderboard_update');
            socket.off('game_ended');
        };
    }, [socket, navigate, options]);

    const handleAnswerClick = (answerIndex) => {
        if (hasAnswered || !socket) return;
        
        const selectedAnswerText = options[answerIndex];
        setSelectedAnswer(answerIndex);
        setHasAnswered(true);
        
        // Submit answer to backend
        socket.emit('submit_answer', {
            answer: selectedAnswerText,
            timeRemaining: secondsLeft
        });
        
        console.log(`Submitted answer: ${selectedAnswerText} with ${secondsLeft} seconds remaining`);
    };

    const handleLeave = () => {
        setPopupType("leave");
        setShowPopup(true);
    };
    const handleLogout = () => {
        setPopupType("logout");
        setShowPopup(true);
    };
    
    const closePopup = () => {
        setShowPopup(false);
        setPopupType("");
    };

    const logout = () => {
        localStorage.removeItem('isAuthenticated');
        closePopup();
        navigate('/');
        window.location.reload();
    };

    const leave = () => {
        closePopup();
        navigate('/mymatches');
    }

    return (
        <div className='match-container'>
            {/* Timer and game info */}
            <div className='left'>
                <div className='timer'>
                    <div className='writing'>TIME REMAINING</div>

                    <div className='timer-seconds writing'>
                        <div className='timer-bar'>
                            <div 
                                className='timer-fill'
                                style={{ width: `${fillPercentage}%` }}
                            ></div>
                        </div>
                        {secondsLeft}
                    </div>
                </div>

                <div className='game-progress'>
                    <div className='writing'>GAME PROGRESS</div>

                    <div className='timer-seconds writing'>
                        <div className='timer-bar'>
                            <div 
                                className='timer-fill'
                                style={{ width: `${fillPercentageGame}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className='round writing'>
                        <span className="label">Round: </span>
                        <span className="number">{roundNumber}</span>
                    </div>

                    <div className='round writing'>
                        <span className="label">Question: </span>
                        <span className="number">{questionNumber}</span>
                    </div>

                    <div className='round writing'>
                        <span className="label">Points: </span>
                        <span className="number">{currentPoints}</span>
                    </div>
                </div>
            </div>

            {/* Question and Answers */}
            <div className='center'>
                <div className='question'>
                    <div className='question-box'>
                        {question}
                    </div>
                </div>

                <div className='answers'>
                    <div className='left-answers'>
                        {[0, 1].map(idx => {
                            let answerClass = 'answer';
                            if (selectedAnswer === idx) answerClass += ' selected';
                            if (hasAnswered) answerClass += ' disabled';
                            if (hasAnswered && correctAnswerIndex !== null) {
                                if (idx === correctAnswerIndex) {
                                    answerClass += ' correct';
                                } else if (selectedAnswer !== null && idx !== correctAnswerIndex) {
                                    answerClass += ' wrong';
                                }
                            }
                            return (
                                <div
                                    key={idx}
                                    className={answerClass}
                                    onClick={() => handleAnswerClick(idx)}
                                    style={{ cursor: hasAnswered ? 'not-allowed' : 'pointer' }}
                                >
                                    {options[idx]}
                                </div>
                            );
                        })}
                    </div>
                    <div className='right-answers'>
                        {[2, 3].map(idx => {
                            let answerClass = 'answer';
                            if (selectedAnswer === idx) answerClass += ' selected';
                            if (hasAnswered) answerClass += ' disabled';
                            if (hasAnswered && correctAnswerIndex !== null) {
                                if (idx === correctAnswerIndex) {
                                    answerClass += ' correct';
                                } else if (selectedAnswer !== null && idx !== correctAnswerIndex) {
                                    answerClass += ' wrong';
                                }
                            }
                            return (
                                <div
                                    key={idx}
                                    className={answerClass}
                                    onClick={() => handleAnswerClick(idx)}
                                    style={{ cursor: hasAnswered ? 'not-allowed' : 'pointer' }}
                                >
                                    {options[idx]}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Leaderboard and buttons */}
            <div className='right'>
                <div>
                    <div className='scoreboard'>
                        <div className='writing'>SCOREBOARD</div>
                    </div>

                    <div className='table'>
                        <table className="match-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>User</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', opacity: 0.7 }}>No scores yet</td>
                                    </tr>
                                ) : (
                                    leaderboard.map(row => (
                                        <tr key={`${row.username}-${row.rank}`}>
                                            <td>{row.rank}</td>
                                            <td>{row.username}</td>
                                            <td>{row.score}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* TODO: Create an overlay over the navbar that shows the leave match & logout button! */}
                <div className='game-buttons'> {/* TODO: Leave match should be peach coloured! */}
                    <div className='button black' onClick={toggleMute}>
                        {isMuted ? 'Unmute' : 'Mute Music'}
                    </div>
                    <div className='button black' onClick={handleLeave}>
                        Leave Match
                    </div>
                    <div className='button black' onClick={handleLogout}>
                        Logout
                    </div>
                </div>
            </div>

            { showPopup && (
                <div className='popup-overlay'> 
                    <div className='popup-box' ref={menuRef}>
                        {popupType==="logout" ? (
                            <>
                                <div className='bold'> CONFIRMATION </div>
                                <h4> Are you sure you want to leave the match and log out? </h4>
                                <p> By doing so you will forfeit your points and chance of winning! </p>
                                <div className = 'popup-buttons'> 
                                    <div className= 'buttons' onClick={logout}> Yes </div>
                                    <div className= 'buttons' onClick={closePopup}> No </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className='bold'> CONFIRMATION </div>
                                <h4> Are you sure you want to leave the match? </h4>
                                <p> By doing so you will forfeit your points and chance of winning! </p>
                                <div className = 'popup-buttons'> 
                                    <div className= 'buttons' onClick={leave}> Yes </div>
                                    <div className= 'buttons' onClick={closePopup}> No </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                )
            }
        </div>
    )
}

export default Match