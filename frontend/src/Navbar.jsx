import React, { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import "./index.css";
import "./Navbar.css"
import bell_icn from './assets/bell.svg';
import SmallLogoAdmin from './assets/Small_Logo_Admin.svg';
import SmallLogo from './assets/Small_Logo.svg';
import Notifications from "./components/Notifications";
import NotificationsItem from "./components/NotificationsItem";
import { useSocket } from './hooks/useSocket';


/**
 * Navigation Bar Component
 * 
 * This function sets up the links to the diferent pages of my website
 * It is the top navigation bar in the website and controls the links
 * @param {boolean} isAuthenticated - whether user is logged in or not (determines button types)
 * @param {function} setIsAuthenticated - able to change Authentication state
 * @returns {JSX.Element} Navigation bar with sidebar
 */

export default function Navbar( { isAuthenticated, setIsAuthenticated, isAdmin } ) {
    useEffect(() => {
    if (isAdmin) {
        document.body.classList.add("admin-background");
    } else {
        document.body.classList.remove("admin-background");
    }
    }, [isAdmin]);

    // Called when user clicks logout button.

    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();
    const [notification, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    // Called when user clicks logout button
    const handleLogout = async() => {

        try {
            const res = await fetch('/api/logout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('uid');
                setIsAuthenticated(false);
                navigate("/")
                window.location.reload();
            } else {
                console.error('Error:', data.error + data.detail);
            }
        } catch (err) {
            console.error("fetch error:", err);
        } 
        try {
            if (socket && socket.connected) {
                socket.disconnect();
            }
        } catch (e) {
            console.warn('Socket disconnect on logout failed:', e);
        }      
    };

    const handleJoin = async (match_id, invitation_id) => {
        try {
            console.log('accepting match')
            const res = await fetch('/api/acceptInvite', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    invitation_id: invitation_id,
                    match_id: match_id
                })
            });
            const data = await res.json();
            if (!res.ok) {
                 console.error('acceptInvite failed:', data);
            }
            removeNotification(invitation_id);
            localStorage.setItem("match_id", match_id)
            navigate('/mymatches/matchlobby')
        } catch (err) {
             console.error("fetch error:", err);
        }

    }

    const handleDecline = async (match_id, invitation_id) => {
        try {
            console.log('Declining match')
            const res = await fetch('/api/declineInvite', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
                body: JSON.stringify({
                    invitation_id: invitation_id,
                    match_id: match_id
                })
            });
            
            localStorage.removeItem("match_id")
            removeNotification(invitation_id);
        } catch (err) {
             console.error("fetch error:", err);
        }
        // UPDATE: remove notification from the list
    }

    const fetchNotifications = async () => {
     try {
            setLoading(true);
            if (localStorage.getItem("isAuthenticated") === "false") {
                setNotifications([]);
                return;
            }
           const res = await fetch('/api/getNotifications', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'
                },
                credentials: "include",
            });
            const data = await res.json();
            console.log("3 nav")
            if (res.ok) {
                console.log("4 nav" +  data.results.message)
                setNotifications(data.results || []);
            } else {
                console.error('Error:', data.error +  data.detail);
                setNotifications([]);
            }
        } catch (err) {
            console.error("fetch error:", err);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }


    const removeNotification = (invitationId) => {
        setNotifications(prev => prev.filter(n => n.invitation_id !== invitationId));
    };

    useEffect(() => {
        (async () => {
            await fetchNotifications();
        })();
    }, []);

     useEffect(() => {
        if (!socket) return;
        const onNotify = () => {
            fetchNotifications();
        }
        socket.on('notification_sent', onNotify);
        return () => socket.off('notification_sent', onNotify);
    }, [socket, fetchNotifications]);

    return (
        <nav className={isAdmin ? "navbar-admin" : "navbar"}>
            <div>
                <img
                src={isAdmin ? SmallLogoAdmin : SmallLogo}
                alt="Logo"
                className="small-logo"
                />
            </div>

            <div className="nav-links-container">
                {isAdmin ? (
                    <>
                        <ul className="nav-links">
                            <li>
                                <NavLink to="/questionbank" className={({ isActive }) => `button blue ${isActive ? 'active' : ''}`}>
                                    Questions
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/matchesadmin" className={({ isActive }) => `button blue ${isActive ? 'active' : ''}`}>
                                    Matches
                                </NavLink>
                            </li>
                        </ul>

                        <div className="auth-buttons">
                            {localStorage.getItem("isAuthenticated") === "true" ? (
                                <div className="profile-logout-container">
                                    <div className="button blue" onClick={handleLogout}>Logout</div>
                                </div>
                            ) : (
                                <div className="signin-container">
                                    <Link to="/signin" className="nav-link signin">Sign In</Link>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {
                            <Notifications 
                                content={(closeDropdown) => (
                                    <>
                                        {
                                            notification.map(item => (
                                                <NotificationsItem 
                                                    key={item.invitation_id}
                                                    onJoin={() => handleJoin(item.match_id, item.invitation_id)}
                                                    onDecline={() => handleDecline(item.match_id, item.invitation_id)}
                                                    closeDropdown={closeDropdown}
                                                >
                                                    {item.message}
                                                </NotificationsItem>
                                            ))
                                        }
                                    </>
                                )}
                                givenWidth='400px'
                            />
                        }
                        
                        <ul className="nav-links">
                            <li>
                                <NavLink to="/" className={({ isActive }) => `button peach ${isActive ? 'active' : ''}`}>
                                    Leaderboard
                                </NavLink>
                            </li>
                        </ul>

                        <div className="auth-buttons">
                            {localStorage.getItem("isAuthenticated") === "true" ? (
                                <div className="auth-container">                
                                    <NavLink to="/mymatches" className={({ isActive }) => `button peach ${isActive ? 'active' : ''}`}>
                                        My Matches
                                    </NavLink>
            
                                    <NavLink to="/profile" className={({ isActive }) => `button peach ${isActive ? 'active' : ''}`}>
                                        Profile
                                    </NavLink>

                                    <button className="button blue" onClick={handleLogout}>Logout</button>
                                </div>
                            ) : (
                                <NavLink to="/signin" className={({ isActive }) => `button blue ${isActive ? 'active' : ''}`}>
                                    Sign In
                                </NavLink>
                            )}
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
}
