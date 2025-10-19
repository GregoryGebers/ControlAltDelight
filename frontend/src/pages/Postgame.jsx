import './Postgame.css';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function Postgame() {
    const navigate = useNavigate();
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchScores = async () => {
            try {
                const matchId = localStorage.getItem('match_id');
                if (!matchId) {
                    setError('No match selected.');
                    setLoading(false);
                    return;
                }
                const res = await fetch(`/api/game/endscores?match_id=${encodeURIComponent(matchId)}`);
                if (!res.ok) {
                    const t = await res.text();
                    throw new Error(t || `Request failed (${res.status})`);
                }
                const data = await res.json();
                const list = Array.isArray(data?.scores) ? data.scores : (Array.isArray(data) ? data : []);
                setScores(list);
            } catch (e) {
                setError(e?.message || 'Failed to load scores');
            } finally {
                setLoading(false);
            }
        };
        fetchScores();
    }, []);

    const handleDone = () => {
        navigate('/');
    }
    
    return (
        <div className='postgame-container'>
            <h1>POST-GAME SUMMARY</h1>

            {loading && (
                <div className='table'>Loading scores…</div>
            )}

            {!loading && error && (
                <div className='table' style={{ color: 'var(--accent, #c00)' }}>{error}</div>
            )}

            {!loading && !error && (
                <div className='table'>
                    <table className="mymatches-table"> {/* From MyMatches.css */}
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Username</th>
                                <th>Average Answer Time</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scores.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center' }}>No scores available</td>
                                </tr>
                            )}
                            {scores.map((row) => (
                                <tr key={`${row.username}-${row.rank}`}>
                                    <td>{row.rank}</td>
                                    <td>{row.username}</td>
                                    <td>{row.averageAnswerTime != null ? `${row.averageAnswerTime} seconds` : '—'}</td>
                                    <td>{row.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div 
                className='button'
                onClick={handleDone}
            >
                DONE
            </div>
        </div>
    )
}

export default Postgame;