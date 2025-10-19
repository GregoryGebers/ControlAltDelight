import { useEffect, useState } from 'react'
import Navbar from './Navbar'
import Profile from "./pages/Profile"
import MyMatches from "./pages/MyMatches"
import Leaderboard from "./pages/Leaderboard"
import Login from "./pages/Login"
import CreateMatch from "./pages/CreateMatch"
import Questions from "./pages/Admin"
import Matches_Admin from "./pages/Matches_admin"
import MatchLobby from "./pages/MatchLobby"
import Postgame from "./pages/Postgame"
import Match  from './pages/Match'
import { Route, Routes, Outlet, Navigate } from "react-router-dom"
import './App.css'


function HomeRoute({ isAdmin }) {
    if (isAdmin) {
        return <Navigate to="/questionbank" replace />;
    }
    return <Leaderboard />;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(
        localStorage.getItem('isAuthenticated') === 'true'
    );

    // API call to determine if a username is an admin or not
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async() => {
            if (!isAuthenticated) {
                setIsAdmin(false);
                return;
            }

            try {
                const token = localStorage.getItem('token');
                console.log('Token being sent:', token);

                if (!token) {
                    setIsAdmin(false);
                    return;
                }

                const res = await fetch('/api/isAdmin', {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    console.error('Failed to check admin status');
                    setIsAdmin(false);
                    return;
                }

                const data = await res.json();

                if (data.ok) {
                    setIsAdmin(data.isAdmin);
                    console.log('Admin status:', data.isAdmin);
                } else {
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error('Error checking admin status:', err);
                setIsAdmin(false);
            }
        }

        checkAdminStatus();
    }, [isAuthenticated]);

    // Layout with navbar
    const NavbarLayout = () => (
        <>
            <Navbar isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} isAdmin={isAdmin}/>
            <div className='container'>
                <Outlet />  {/* This is where child routes will be rendered */}
            </div>
        </>
    );

    // Layout without navbar (for sign-in page)
    const PlainLayout = () => (
        <div className='container'>
            <Outlet />
        </div>
    );

    return (
        <Routes>
            {/* Routes with navbar */}
            <Route element={<NavbarLayout />}>
                <Route path="/" element={<HomeRoute isAdmin={isAdmin} />} />
                <Route path='/profile' element={<Profile />} />
                <Route path='/mymatches' element={<MyMatches />} />
                <Route path='/mymatches/creatematch' element={<CreateMatch />} />
                <Route path='/questionbank' element={<Questions />} />
                <Route path='/matchesadmin' element={<Matches_Admin />} />
                <Route path='/mymatches/matchlobby' element={<MatchLobby />} />
                <Route path='/mymatches/match' element={<Match />} />
                <Route path='/mymatches/postgame' element={<Postgame />} />
            </Route>
            
            {/* Routes without navbar */}
            <Route element={<PlainLayout />}>
                <Route path='/signin' element={<Login />} />
            </Route>
        </Routes>
    );
}

export default App