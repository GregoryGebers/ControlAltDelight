import "../index.css";
import './MatchLobby.css';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';
import Match from './Match';

/**
 * Match Lobby Page
 * 
 * This function is the page which the user goes to when waiting for match to start or waiting to start the matchs
 * 
 * @returns {JSX.Element} MatchLobby page with elements
 */

function MatchLobby() {
    const navigate = useNavigate();
    const location = useLocation();
    const { socket, isConnected } = useSocket();
    const [isStarting, setIsStarting] = useState(false);
    const [matchId, setMatchId] = useState(location?.state?.matchId || null);
    const [players, setPlayers] = useState([]);
    const [hostId, setHostId] = useState(null);


    const [matchData, setMatchData] = useState([]);
    const [loading, setLoading] = useState([false]);

    
     const handleMatchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/getLobby', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    match_id: localStorage.getItem("match_id")
                })
            });
            const data = await res.json();

            if (res.ok) {
                setMatchData(data.results)
                console.log('Loading players into mnatch', data);
            } else {
                console.error('Error:', data.error +  data.detail);
            }
        } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
            (async () => {
            await handleMatchData();
        })();
        }, []);
    useEffect(() => {
        if (!socket) return;

        // Listen for match start confirmation and first question

        const onPlayerJoin = () => {
            handleMatchData();
            console.log(matchData + " HEY")
        }
        socket.on('question_loaded', (questionData) => {
            console.log('First question loaded, navigating to match...', questionData);
            // Small delay to ensure the question data is processed
            setTimeout(() => {
                navigate('/mymatches/match');
            }, 100);
        });

        socket.on('match_start_error', (data) => {
            console.error('Error starting match:', data.error);
            setIsStarting(false);
            alert(`Error starting match: ${data.error}`);
        });

        // Lobby state updates
        const onLobby = (state) => {
            if (state?.matchId && (!matchId || matchId === state.matchId)) {
                setMatchId(localStorage.getItem("match_id"));
                setPlayers(state.players || []);
                setHostId(state.hostId || null);
            }
        };
        socket.on('lobby_state', onLobby);
        socket.on('player_join', onPlayerJoin);
        if (matchId) {
            socket.emit('get_lobby_state', { matchId }, (res) => {
                if (res?.ok) {
                    setPlayers(res.players || []);
                    setHostId(res.hostId || null);
                }
            });
        }

        return () => {
            socket.off('player_join');
            socket.off('question_loaded');
            socket.off('match_start_error');
            socket.off('lobby_state', onLobby);
        };
    }, [socket, navigate, matchId, handleMatchData]);

    // If the match is cancelled before it starts
    const handleCancelMatch = () => {
        navigate('/mymatches');
    }

    // If the match is started
    const handleStartMatch = () => {
        if (!socket || !isConnected) {
            alert('Not connected to server. Please try again.');
            return;
        }
        
        if (isStarting) {
            return; // Prevent multiple clicks
        }
        
        setIsStarting(true);
        console.log('Emitting start_match event...');
        socket.emit('start_match');
    }

    return (
        <div className='game-container'>
            <h1>match lobby</h1>

            <div className='match-id'>
                {matchId ? `Match ID: ${matchId}` : 'Joining lobby...'}
            </div>

            <div className='table'>
                 {loading ? (
                    <table className="mymatches-table">
                    <thead>
                        <tr>
                            <th>Player List</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                            <tr>
                                <td>{"NA"}</td>
                                <td>{"NA"}</td>
                            </tr>
                    </tbody>
                </table>
                    )  :  (
                <table className="mymatches-table">
                    <thead>
                        <tr>
                            <th>Player List</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                         {matchData.map((row) => (
                            <tr>
                                <td>{row.username ?? "NA"}</td>
                                <td>{row.is_ready === undefined ? "NA" : row.is_ready ? "Yes" : "No"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </div>

            <div className='button_container'>
                <div 
                    className='button'
                    onClick={handleStartMatch}
                    style={{ 
                        opacity: isStarting ? 0.6 : 1,
                        cursor: isStarting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isStarting ? 'Starting...' : 'Start Match'}
                </div>

                <div 
                    className='button'
                    onClick={handleCancelMatch}
                >
                    Cancel Match
                </div>
            </div>
        </div>
    )
}

export default MatchLobby