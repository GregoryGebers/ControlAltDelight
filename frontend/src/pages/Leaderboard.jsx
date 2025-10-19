import "../index.css";
import "./Leaderboard.css";
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import { useState, useEffect, useCallback } from 'react';

function Leaderboard() {
    const dropdown_place = ["Rank Ascending", "Rank Descending"];
    const dropdown_date = ["Daily", "Weekly", "Yearly"];
    const [searchName, setSearchName] = useState('');
    const [sortRank, setSortRank] = useState('Rank Descending');
    const [sortDate, setSortDate] = useState('Yearly');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(false);


    const fetchLeaderboard = useCallback(async () => {
        try {
            setLoading(true);
            console.log(localStorage.getItem("uid"));
            console.log(localStorage.getItem("token"));
            const res = await fetch('/api/getLeaderBoardScores', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    period: sortDate,
                    name: searchName,
                    sort: sortRank
                })
            });
            const data = await res.json();

            if (res.ok) {
                setLeaderboardData(data.leaderboard || []);
            } else {
                console.error('Error:', data.error +  data.detail);
                setLeaderboardData([]);
            }
        } catch (err) {
            console.error("fetch error:", err);
            setLeaderboardData([]);
        } finally {
            setLoading(false);
        }
    }, [sortDate, searchName, sortRank]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return (
        <div className='leaderboard-container'>
            <h1>leaderboard</h1>

            <div className='sorting-container'>
                <Dropdown 
                    buttonText={sortRank === '' ? 'Sort by Rank' : sortRank} 
                    givenWidth="300px"
                    content={
                        <>
                            {
                                dropdown_place.map(item => (
                                    <DropdownItem key={item} onClick={() => setSortRank(item)}>
                                        {item}
                                    </DropdownItem>
                                ))
                            }
                        </>
                    }
                />
                <div className='sort-term'>
                    <input 
                        className='input-search'
                        placeholder="Search Users..."
                        type='text'
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                    />
                </div>

                <Dropdown 
                    buttonText={sortDate === '' ? 'Sort by Date' : sortDate} 
                    content={
                        <>
                            {
                                dropdown_date.map(item => (
                                    <DropdownItem key={item} onClick={() => setSortDate(item)}>
                                        {item}
                                    </DropdownItem>
                                ))
                            }
                        </>
                    }
                />
            </div>
            <div className='table'>
                {loading ? (
                    <p>Loading leaderboard...</p> ) :
                    leaderboardData.length === 0 ? (
                        <p>No leaderboard data found.</p>
                    )  :  (
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Match</th>
                            <th>Category</th>
                            <th>Username</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboardData.map((row, idx) => (
                            <tr key={`${row.username}-${idx}`}>
                                <td>{idx + 1}</td>
                                <td>{row.match_title || row.matchTitle || '—'}</td>
                                <td>{row.category || '—'}</td>
                                <td>{row.username}</td>
                                <td>{row.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </div>
        </div>
    )
}

export default Leaderboard
/* CHECK: I edited this out, relook at whether to bring this back later.

<select
    className={`sort-position ${!sortRank ? "placeholder" : ""}`}
    value={sortRank}
    onChange={(e) => setSortRank(e.target.value)}
>
    <option value="" disabled hidden>Sort by Rank...</option>
    <option value="Ascending">Rank Ascending</option>
    <option value="Descending">Rank Descending</option>
</select>



<select
    className={`sort-date ${!sortDate ? "placeholder" : ""}`}
    value={sortDate}
    onChange={(e) => setSortDate(e.target.value)}
>
    <option value="" disabled hidden>Filter by Date...</option>
    <option value="None">No Filter</option>
    <option value="Daily">Filter Daily</option>
    <option value="Weekly">Filter Weekly</option>
    <option value="Yearly">Filter Yearly</option>
</select>
*/      