import "../index.css";
import './Admin.css'
import './MyMatches.css';
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Matches_Admin() {
    const navigate = useNavigate();
    const dropdown_category = ["General Knowledge", "Science", "Entertainment", "Sports", "Geography", "Politics", "None"];
    
    const [chosenCategory, setChosenCategory] = useState('None');
    const [searchTerm, setSearchTerm] = useState('');
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [playersData, setPlayersData] = useState({});
    const [editingMatchId, setEditingMatchId] = useState(null);
    const [selectedUsersToRemove, setSelectedUsersToRemove] = useState({});

    // Fetch matches when category or search term changes
    useEffect(() => {
        fetchMatches();
    }, [chosenCategory, searchTerm]);

    const fetchMatches = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/searchMatch', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                title: searchTerm,
                cat: chosenCategory
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            console.log('Raw response:', text);
            
            const data = text ? JSON.parse(text) : {};
            
            if (data.ok) {
                const filteredMatches = (data.formattedMatches || []).filter(
                    match => match.status === 'lobby' || match.status === 'in progress'
                );
                setMatches(filteredMatches);
                console.log('Total matches from API:', data.formattedMatches?.length || 0);
                console.log('Filtered matches (lobby/in_progress):', filteredMatches.length);
                
                console.log('Fetching players now...')
                // Wait for all player fetches to complete
                await Promise.all(
                    filteredMatches.map(match => fetchMatchPlayers(match.match_id))
                );
            } else {
                setError('Failed to fetch matches');
            }
        } catch (err) {
            setError('Error fetching matches: ' + err.message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatchPlayers = async (matchId) => {
        try {
            console.log('Fetching players for match:', matchId);
            const response = await fetch('/api/getLobby', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    match_id: matchId
                })
            });

            if (!response.ok) {
                console.error(`HTTP error fetching players for match ${matchId}! status: ${response.status}`);
                return;
            }

            const text = await response.text();
            const data = text ? JSON.parse(text) : {};
            
            if (data.ok) {
                setPlayersData(prev => ({
                    ...prev,
                    [matchId]: data.results
                }));
            }
        } catch (err) {
            console.error(`Error fetching players for match ${matchId}:`, err);
        }
    };

    const handleEditUsers = (matchId) => {
        setEditingMatchId(matchId);
        setSelectedUsersToRemove({});
    };

    const handleCancelEdit = () => {
        setEditingMatchId(null);
        setSelectedUsersToRemove({});
    };

    const handleUserSelection = (matchId, username, isSelected) => {
        setSelectedUsersToRemove(prev => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [username]: isSelected
            }
        }));
    };

    const removeSelectedUsers = async (matchId) => {
        const usersToRemove = selectedUsersToRemove[matchId];
        if (!usersToRemove) return;

        const usernamesToRemove = Object.keys(usersToRemove).filter(username => usersToRemove[username]);
        
        if (usernamesToRemove.length === 0) {
            alert('Please select at least one user to remove');
            return;
        }

        if (!confirm(`Are you sure you want to remove ${usernamesToRemove.join(', ')} from this match?`)) {
            return;
        }

        try {
            // Get user IDs from usernames
            const currentPlayers = playersData[matchId] || [];
            const usersToRemoveData = currentPlayers.filter(player => 
                usernamesToRemove.includes(player.username)
            );

            // Remove each selected user
            const removePromises = usersToRemoveData.map(async (user) => {
                const response = await fetch('/api/removePlayerFromMatch', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        match_id: matchId,
                        user_id: user.id // You'll need to store user IDs in your playersData
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to remove user ${user.username}`);
                }

                return response.json();
            });

            await Promise.all(removePromises);
            
            // Refresh the player data
            await fetchMatchPlayers(matchId);
            
            // Reset editing state
            setEditingMatchId(null);
            setSelectedUsersToRemove(prev => {
                const newState = { ...prev };
                delete newState[matchId];
                return newState;
            });
            
            alert('Users successfully removed from match');
            
        } catch (err) {
            console.error('Error removing users:', err);
            alert('Error removing users: ' + err.message);
        }
    };

    const getReadyPlayersList = (matchId) => {
        const players = playersData[matchId];
        if (!players || players.length === 0) return 'No players';
        
        const readyPlayers = players.filter(p => p.is_ready);
        return `${readyPlayers.length}/${players.length} ready`;
    };

    const handleCategoryChange = (category) => {
        setChosenCategory(category);
    };

    const renderPlayerManagement = (match) => {
        const players = playersData[match.match_id] || [];
        
        if (editingMatchId === match.match_id) {
            return (
                <div className="player-management">
                    <div className="player-list-edit">
                        <h4>Select users to remove:</h4>
                        {players.map((player, index) => (
                            <div key={index} className="player-checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={selectedUsersToRemove[match.match_id]?.[player.username] || false}
                                        onChange={(e) => handleUserSelection(match.match_id, player.username, e.target.checked)}
                                    />
                                    {player.username} {player.is_ready ? '(Ready)' : '(Not Ready)'}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
             <div>{getReadyPlayersList(match.match_id)}</div>
        );
    };

    return (
        <div className='matches-container'>
            <h1>matches</h1>

            <div className='sorting-container'>
                <div className='sort-term-matches'>
                    <input 
                        className='input-search'
                        type='text'
                        placeholder='Search Matches...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className='sort-date'>
                    <Dropdown 
                        buttonText={chosenCategory === 'None' ? 'Filter Category' : chosenCategory}
                        givenWidth="300px"
                        content={
                        <>
                            {dropdown_category.map(item => (
                            <DropdownItem 
                                key={item} 
                                onClick={() => handleCategoryChange(item)}
                            >
                                {item}
                            </DropdownItem>
                            ))}
                        </>
                        }
                    />
                </div>
            </div>

            {loading && <div className="loading-message">Loading matches...</div>}
            {error && <div className="error-message">{error}</div>}

            <div className='table'>
                <table className="common-table">
                    <thead>
                        <tr>
                        <th>Status</th>
                        <th>Match Title</th>
                        <th>Match ID</th>
                        <th>Category</th>
                        <th>Players</th>
                        <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matches.length === 0 ? (
                            <tr>
                                <td>
                                    {loading ? 'Loading...' : 'No matches found'}
                                </td>
                            </tr>
                            ) : (
                            matches.map(match => (
                                <tr key={match.match_id}>
                                    <td>{match.status === 'lobby' ? 'Upcoming' : 'Current'}</td>
                                    <td>{match.title}</td>
                                    <td>{match.match_id}</td>
                                    <td>{match.category}</td>
                                    <td>
                                        {editingMatchId === match.match_id ? (
                                            renderPlayerManagement(match)
                                        ) : (
                                            <div>{getReadyPlayersList(match.match_id)}</div>
                                        )}
                                    </td>
                                    <td>
                                        {editingMatchId === match.match_id ? (
                                            <div className="edit-actions">
                                                <button 
                                                    className="button-admin"
                                                    onClick={() => removeSelectedUsers(match.match_id)}
                                                >
                                                    Remove Selected
                                                </button>
                                                <button 
                                                    className="button-admin"
                                                    onClick={handleCancelEdit}
                                                    style={{marginTop: '4px'}}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className="button-admin"
                                                onClick={() => handleEditUsers(match.match_id)}
                                            >
                                                Edit Users
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Matches_Admin;