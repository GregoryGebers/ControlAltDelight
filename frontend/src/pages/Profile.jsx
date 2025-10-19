import './Profile.css'
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

function Profile() {
    const [gamesPlayed, setGamesPlayed] = useState("0");
    const [highScore, setHighScore] = useState("0");
    const [memberSince, setMemberSince] = useState("today");
    const[profile, setProfile] = useState("");
    const[username, setUsername] = useState("");
    const[password, setPassword] = useState('');
    const navigate = useNavigate();
    const [showPopup, setShowPopup] = useState(false);
    const [popupType, setPopupType] = useState("");
    const menuRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [matchHistory, setMatchHistory] = useState([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const matchesPerPage = 2;
    const totalPages = Math.ceil(matchHistory.length / matchesPerPage);
    const currentMatches = matchHistory.slice(
        currentPage * matchesPerPage,
        currentPage * matchesPerPage + matchesPerPage
    );

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 0) setCurrentPage(currentPage - 1);
    };

    const generateRandomAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(2, 10);
        const newAvatar = `https://api.dicebear.com/9.x/big-smile/svg?seed=${randomSeed}`;
        setProfile(newAvatar);
    }
    
    const updateProfile = async () => {
        try {
            closePopup();
            setLoading(true);
            const res = await fetch('/api/updateUser', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    username: username,
                    Avatar_url: profile,
                    password: password
                })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('Error:', data.error +  data.detail);
            }
            if (!data.reauthenticated) {
                    localStorage.removeItem("match_id");
                    localStorage.setItem("isAuthenticated", "false");
                    localStorage.removeItem("uid");
                    navigate('/')
                }
          } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);
        }
    }

    const fetchUser = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/getUserById', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                setUsername(data.results.username || "User");
                setProfile(data.results.Avatar_url|| null);
                setMemberSince(data.results.created_at || "today");
            } else {
                console.error('Error:', data.error + data.detail);
            }
        } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        if (!username || !profile) return; // guard against empty values
        updateProfile();
    }, [profile]);

    useEffect(() => {
        
        fetchUser();
        fetchHistory();
        
    }, [])
    

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/getMatchHistory', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                setMatchHistory(data.results || []);
                setHighScore(data.highScore || 0);
                setGamesPlayed(data.gamesPlayed || 0);
                setCurrentPage(0);
            } else {
                console.error('Error:', data.error + data.detail);
                setMatchHistory([]);
            }
        } catch (err) {
            console.error("fetch error:", err);
            setMatchHistory([]);
        } finally {
            setLoading(false);
        }
    };



    const handleProfileEdit = () => {
        setPopupType("edit");
        setShowPopup(true);
    };

    const handleProfileDelete = () => {
        setPopupType("delete");
        setShowPopup(true);
    };

    const closePopup = () => {
        setShowPopup(false);
        setPassword("");
        setPopupType("");
    };

    const DeleteUser = async() => {
        try {
            closePopup();
            setLoading(true);
            const res = await fetch('/api/deleteUser', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.removeItem("match_id");
                localStorage.setItem("isAuthenticated", "false");
                localStorage.removeItem("uid");
                navigate('/')

            } else {
                console.error('Error:', data.error +  data.detail);

            }
        } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);
        }
    };


    const changeUsername = (e) => setUsername(e.target.value);
    const changePassword = (e) => setPassword(e.target.value);

    return (
        <div className='profile-container'>
            <h1>profile</h1>
            <div className='profile-content'>

                {/* MATCH HISTORY SECTION */}
                <div className='match-history-container'>
                    <div className='bold'>MATCH HISTORY</div>
                    <div className='table'>
                    {loading ? (
                        <p>Loading match history...</p>
                    ) : (
                        <>
                        <table className="match-history-table">
                            <thead>
                            <tr>
                                <th>Match Name</th>
                                <th>Score</th>
                            </tr>
                            </thead>
                            <tbody>
                            {currentMatches.length > 0 ? (
                                currentMatches.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.title}</td>
                                    <td>{row.points}</td>
                                </tr>
                                ))
                            ) : (
                                <tr><td colSpan="2">No matches to display</td></tr>
                            )}
                            </tbody>
                        </table>

                        {/* Pagination Symbols DIRECTLY under table */}
                        <div className="profile-pagination-symbols">
                            <span
                            className={`page-symbol ${currentPage === 0 ? 'disabled' : ''}`}
                            onClick={handlePrevPage}>
                            ◄
                            </span>
                            <span className="page-count">{currentPage + 1} / {totalPages || 1}</span>
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
                    <h4>Games Played: {gamesPlayed}</h4>
                    <h4>High Score: {highScore}</h4>
                </div>

                {/* PROFILE INFO SECTION */}
                <div className='profile-info'>
                    <div className='information-container'>
                        <img src={profile} className="profile-image" alt="Profile Avatar" />
                        <div className='profile-text'>
                            <div className='bold'>{username}</div>
                            <h4>Member Since: {memberSince}</h4>
                        </div>
                    </div>

                    <div className='profile-buttons' onClick={generateRandomAvatar}>
                        New Avatar
                    </div>
                    <div className='profile-buttons' onClick={(e) => { e.stopPropagation(); handleProfileEdit(); }}>
                        Edit Profile
                    </div>
                    <div className='profile-buttons' onClick={(e) => { e.stopPropagation(); handleProfileDelete(); }}>
                        Delete Profile
                    </div>
                </div>
            </div>

            { showPopup && (
               <div className='popup-overlay'> 
               <div className='popup-box' ref={menuRef}>
                {popupType==="delete" ? (
                    <>
                    <div className='bold'> CONFIRMATION </div>
                    <h4> Are you sure you want to delete this profile? </h4>
                    <p> This is irriversible, all profile data will be permanently deleted </p>
                    <div className = 'popup-buttons'> 
                        <div className= 'buttons' onClick={DeleteUser}> Delete </div>
                        <div className= 'buttons' onClick={closePopup}> Cancel </div>
                    </div>
                    </>
                ) : (
                    <>
                    <div className='bold'>EDIT PROFILE</div>

                    <div className='edit-form'>

                        <div className='form-row'>
                            <label htmlFor='username' className = 'edit-text'>Username:</label>
                            <input 
                                type='text' 
                                id='username' 
                                className='input-box'
                                value={username} 
                                onChange={changeUsername} 
                            />
                        </div>

                        <div className='form-row'>
                            <label htmlFor='password' className = 'edit-text'>Password:</label>
                            <input 
                                type='password' 
                                id='password' 
                                value={password} 
                                className='input-box'
                                onChange={changePassword}
                            />
                        </div>
                    </div>

                    <div className='popup-buttons'> 
                        <div className='buttons' onClick={updateProfile}>Save</div>
                        <div className='buttons' onClick={closePopup}>Cancel</div>
                    </div>
                    </>


                )}
               </div>
               </div>
            )
            }
        </div>
    );
}

export default Profile;
