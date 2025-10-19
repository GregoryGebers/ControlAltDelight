import "../index.css";
import './CreateMatch.css';
import Dropdown from "../components/Dropdown";
import DropdownItem from "../components/DropdownItem";
import SearchUserDropdown from "../components/SearchUserDropdown";
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';

function CreateMatch() {
    const navigate = useNavigate();
    const dropdown_category = ["General Knowledge", "Science", "Entertainment: film", "Sports", "Geography", "Politics"];
    const difficulties = ["Easy", "Medium", "Hard"];
    const [roundDifficulties, setRoundDifficulties] = useState(['', '', '', '']);
    const [chosenCategory, setChosenCategory] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [chosenUser, setChosenUser] = useState('');
    const [matchTitle, setMatchTitle] = useState('');
    const [possibleUser, setPossibleUser] = useState([]);
    const { socket, isConnected } = useSocket();
    const [loading, setLoading] = useState(false);
    const userSearchRef = useRef(null);

    const [showUserDropdown, setShowUserDropdown] = useState(false);

    const handleDifficultyChange = (difficulty, round) => {
        setRoundDifficulties(prevDifficulties => {
            const newDifficulties = [...prevDifficulties];
            newDifficulties[round] = difficulty;
            return newDifficulties;
        });
    }
    
    const getPossibleUsers = async () => {
        try {
            setLoading(true);
            if (chosenUser.length == 0) {
                setLoading(false);
                setPossibleUser([]);
                return;
            }

             const res = await fetch('/api/searchUsers', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    username: chosenUser,
                    alreadySelected: selectedUsers,
                }) 
            });
            const data = await res.json();

            if (res.ok && data.users.length != 0) {
                console.log('adding users');
                console.log(data.users);
                setPossibleUser(data.users);
            } else {
                console.error('Error:', data.error +  data.detail);
            }

        } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);

        }   
        
    }
    useEffect(() => {
        getPossibleUsers();
    }, [chosenUser])

    const addSelectedUser = (user) => {
        if (user) {
            setSelectedUsers(prevUsers => {
                if (!prevUsers.includes(user)) {
                    return[...prevUsers, user];
                }
                return prevUsers;
            });
            setChosenUser('');
            setShowUserDropdown(false);
            setPossibleUser([]);
        }
        
    }

    const handleAddClick = () => {
        addSelectedUser();
    };

    const handleCreateNewMatch = async () => {
        // Basic validation
        try {
            setLoading(true);

            if (!matchTitle.trim()) {
            alert('Please enter a match title');
            return;
            }
        
            const hostUserId = `user_${Date.now()}`; //neeeds to change
            
            const matchData = {
                title: matchTitle.trim(),
                host_user_id: hostUserId,
                category: chosenCategory,
                invited_users: selectedUsers,
                round_difficulties: roundDifficulties
            };


            console.log(localStorage.getItem("uid"));
            console.log(localStorage.getItem("token"));
            const res = await fetch('/api/createNewMatch', {
               method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    title: matchData.title,
                    category: matchData.category,
                    users: matchData.invited_users,
                    rounds: matchData.round_difficulties
                })
            });
            const data = await res.json();

            if (res.ok) {
                console.log('Creating match with data:', matchData);
                socket.emit('create_match', data.match);
                localStorage.setItem("match_id", data.match.match_id);
                navigate('/mymatches/matchlobby');
            } else {
                console.error('Error:', data.error +  data.detail);
            }
        } catch (err) {
            console.error("fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGameFinished = () => {
        navigate('/mymatches/postgame');
    }

    return (
        <div className='create-container'>
            <h1>match creator</h1>

            {/* Match Title Input */}
            <div className='match-title-section'>
                <label className='match-title-label' htmlFor='match-title-input'>
                    MATCH TITLE
                </label>
                <input 
                    id='match-title-input'
                    className='match-title-input'
                    type='text' 
                    placeholder='Enter match title...'
                    value={matchTitle}
                    onChange={(e) => setMatchTitle(e.target.value)}
                />
            </div>


            <div className='choices'>
                <div className='users-categories'>
                    {/* Users invited */}
                    <div className='users'>
                        <div className='writing'>
                            Invited Users
                        </div>
                        <div className='add-users'>
                            <input 
                                className="add-user-input"
                                type='text' 
                                placeholder='Search Users...'
                                value={chosenUser}
                                onChange={(e) => {
                                    setChosenUser(e.target.value)
                                    if(e.target.value.length > 0) {
                                        setShowUserDropdown(true)
                                    }
                                }}   
                                onFocus={() => {
                                    if(possibleUser.length > 0) {
                                        setShowUserDropdown(true);
                                    }
                                }}
                            />
                            <SearchUserDropdown
                                givenWidth="350px"
                                hasContent={possibleUser.length > 0}
                                content={
                                    <>
                                        {
                                            possibleUser.map((user, index) => (
                                                <DropdownItem 
                                                    key={index} 
                                                    onClick={() => addSelectedUser(user)}
                                                >
                                                    {user}
                                                </DropdownItem>
                                            ))
                                        }
                                    </>
                                }
                            />
                        </div>
                        <div className='current-added'>
                            {selectedUsers.length > 0 ? selectedUsers.join(', ') : 'No users added'}
                        </div>
                    </div>

                    {/* Quiz category editing */}
                    <div className='category'>
                        <div className='writing'>
                            Quiz Category
                        </div>

                        <Dropdown 
                            buttonText={chosenCategory === '' ? 'Filter Category' : chosenCategory}
                            givenWidth="350px"
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
                </div>

                {/* Round difficulty editing */}
                <div className='difficulty'>
                    <div className='writing'>
                        Difficulty Selection
                    </div>

                    {/* Round 1 */}
                    <div className='round'>
                        <div className='round-title'>
                            Round 1
                        </div>

                        <Dropdown 
                            buttonText={roundDifficulties[0] === '' ? 'Difficulty' : roundDifficulties[0]}
                            givenWidth="200px"
                            content={
                                <>
                                    {
                                        difficulties.map(item => (
                                            <DropdownItem 
                                                key={item} 
                                                onClick={() => handleDifficultyChange(item, 0)}
                                            >
                                                {item}
                                            </DropdownItem>
                                        ))
                                    }
                                </>
                            }
                        />
                    </div>

                    {/* Round 2 */}
                    <div className='round'>
                        <div className='round-title'>
                            Round 2
                        </div>

                        <Dropdown 
                            buttonText={roundDifficulties[1] === '' ? 'Difficulty' : roundDifficulties[1]}
                            givenWidth="200px"
                            content={
                                <>
                                    {
                                        difficulties.map(item => (
                                            <DropdownItem 
                                                key={item} 
                                                onClick={() => handleDifficultyChange(item, 1)}
                                            >
                                                {item}
                                            </DropdownItem>
                                        ))
                                    }
                                </>
                            }
                        />
                    </div>

                    {/* Round 3 */}
                    <div className='round'>
                        <div className='round-title'>
                            Round 3
                        </div>

                        <Dropdown 
                            buttonText={roundDifficulties[2] === '' ? 'Difficulty' : roundDifficulties[2]}
                            givenWidth="200px"
                            content={
                                <>
                                    {
                                        difficulties.map(item => (
                                            <DropdownItem 
                                                key={item} 
                                                onClick={() => handleDifficultyChange(item, 2)}
                                            >
                                                {item}
                                            </DropdownItem>
                                        ))
                                    }
                                </>
                            }
                        />
                    </div>

                    {/* Round 4 */}
                    <div className='round'>
                        <div className='round-title'>
                            Round 4
                        </div>

                        <Dropdown 
                            buttonText={roundDifficulties[3] === '' ? 'Difficulty' : roundDifficulties[3]}
                            givenWidth="200px"
                            content={
                                <>
                                    {
                                        difficulties.map(item => (
                                            <DropdownItem 
                                                key={item} 
                                                onClick={() => handleDifficultyChange(item, 3)}
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
            </div>

            <div className='button' onClick={handleCreateNewMatch}>
                Create New Match
            </div>
        </div>
    )
}

export default CreateMatch