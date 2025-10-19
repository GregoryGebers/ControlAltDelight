import "../index.css";
import './MyMatches.css';
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';
import { useState, useEffect, useCallback } from 'react';

function MyMatches() {
    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();
    const dropdown_category = ["General Knowledge", "Science", "Entertainment", "Sports", "Geography", "Politics", "None"];
    const [chosenCategory, setChosenCategory] = useState('None');
    const [searchName, setSearchName] = useState("");
    const [loading, setLoading] = useState(false);
    const [matchData, setMatchData] = useState([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const matchesPerPage = 5;
    const totalPages = Math.ceil(matchData.length / matchesPerPage);
    const currentMatches = matchData.slice(
        currentPage * matchesPerPage,
        currentPage * matchesPerPage + matchesPerPage
    );

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 0) setCurrentPage(currentPage - 1);
    };

    const handleCreateMatch = () => navigate('/mymatches/creatematch');

    const handleJoinLatest = () => {
        if (!socket || !isConnected) {
            alert('Not connected to server. Please try again.');
            return;
        }
        socket.emit('join_latest_match', {}, (res) => {
            if (res?.ok && res.matchId) {
                navigate('/mymatches/matchlobby', { state: { matchId: res.matchId } });
            } else {
                alert(res?.error || 'No open matches to join');
            }
        });
    };

    const searchMatch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/searchMatch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ title: searchName, cat: chosenCategory })
            });
            const data = await res.json();
            if (res.ok) {
                setMatchData(data.formattedMatches || []);
                setCurrentPage(0); // Reset page on new search
            } else {
                console.error('Error:', data.error +  data.detail);
                setMatchData([]);
            }
        } catch (err) {
            console.error("fetch error:", err);
            setMatchData([]);
        } finally {
            setLoading(false);
        }
    }, [searchName, chosenCategory]);

    useEffect(() => { searchMatch(); }, [searchMatch]);
    useEffect(() => { (async () => await searchMatch())(); }, []);

    return (
        <div className='mymatches-container'>
            <h1>my matches</h1>

            <div className='sorting-container'>
                <div className='sort-term-matches'>
                    <input 
                        className='input-search'
                        type='text'
                        placeholder='Search Matches...'
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                    />
                </div>

                <Dropdown 
                    buttonText={chosenCategory === 'None' ? 'Filter Category' : chosenCategory}
                    givenWidth="285px"
                    content={
                        <>
                            {dropdown_category.map(item => (
                                <DropdownItem key={item} onClick={() => setChosenCategory(item)}>
                                    {item}
                                </DropdownItem>
                            ))}
                        </>
                    }
                />
            </div>

            <div className='table'>
                {loading ? (
                    <p>Loading matches...</p>
                ) : currentMatches.length === 0 ? (
                    <p>No match data found.</p>
                ) : (
                    <>
                        <table className="mymatches-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Match ID</th>
                                    <th>Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentMatches.map((row) => (
                                    <tr key={row.match_id || row.title}>
                                        <td>{row.status}</td>
                                        <td>{row.title}</td>
                                        <td>{row.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Symbols */}
                        <div className="pagination-symbols">
                            <span
                                className={`page-symbol ${currentPage === 0 ? 'disabled' : ''}`}
                                onClick={handlePrevPage}
                            >
                                ◄
                            </span>
                            <span className="page-count">
                                {currentPage + 1} / {totalPages || 1}
                            </span>
                            <span
                                className={`page-symbol ${currentPage >= totalPages - 1 ? 'disabled' : ''}`}
                                onClick={handleNextPage}
                            >
                                ►
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className='match-button-container'>
                <div className='button blue' onClick={handleJoinLatest}>
                    Join Existing Match
                </div>
                <div className='button blue' onClick={handleCreateMatch}>
                    Create New Match
                </div>
            </div>
        </div>
    );
}

export default MyMatches;
