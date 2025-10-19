import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../index.css";
import './Login.css';
import WelcomeLogo from '../assets/Welcome_Logo.svg';

/**
 * Login Page Component
 * 
 * This function creates and returns the login page in which the user can login using their details
 * The function also checks whether the users details are correct and doesn't allow them to log in 
 * with incorrect username or passsword (Currently set Username:bcon and Password:1234)
 * 
 * It also updates the isAuthenticated state in local storage so that the user has access to logged in functions
 * @returns {JSX.Element} - returns the Login Page component
 */
function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    // Used to set the bottom button of the login page, signup or login
    const [signup, setSignup] = useState(true);

    // When the user clicks the sign in button
    const handleSignIn = () => {
            (async () =>  {
                try {
                    await fetch("/api/health");
                    const res = await fetch('/api/loginattempt', {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({email: email, password: password, username: username}),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error("Signin failed:", err);
                        setError(err?.error || `Signup failed (${res.status})`);
                        return;
                    } 
                    console.log("SignIn ok:", data);

                    localStorage.setItem("isAuthenticated", "true");
                    localStorage.setItem("uid", data.uid);
                    
                    navigate("/");
                    window.location.reload();

                } catch (e) {
                    console.error(e);
                    setError("Network error");
                }
            
        })();
    }


    const handleSignUp= () => {
            (async () =>  {
                try {
                    await fetch("/api/health");
                    const res = await fetch('/api/newUser', {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({email: email, password: password, username: username}),
                        credentials: "include"
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error("Signup failed:", err);
                        setError(err?.error || `Signup failed (${res.status})`);
                        return;
                    } 
                    const data = await res.json();
                    console.log("Signup ok:", data);

                    localStorage.setItem("isAuthenticated", "true");
                    localStorage.setItem("uid", data.uid);

                    navigate("/");
                    window.location.reload();

                } catch (e) {
                    console.error(e);
                    setError("Network error");
                }
            
        })();
    }

    return (
        <div className="outer-container">
            <div className="login-container">
            <div>
                <img src={WelcomeLogo} alt="Logo" className="welcome-logo" />
            </div>
                {/* Input areas */}
                <div className="inputs">
                    <div className="input">
                        <div className="input-text">Username</div>
                        <input 
                            type="text" 
                            placeholder="Enter your username..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)} // Set username value if changed
                        />
                    </div>
                    <div className="input">
                        <div className="input-text">Email</div>
                        <input 
                            type="email" 
                            placeholder="Enter your email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)} // Set email value if changed
                        />
                    </div>
                    <div className="input">
                        <div className="input-text">Password</div>
                        <input 
                            type="password" 
                            placeholder="Enter your password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)} // Set password value if changed
                        />
                    </div>
                </div>
                
                {/* If there's an error in username or password */}
                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}
                
                {/* Sign in and back buttons */}
                <div className="submit-container">
                    <div 
                        className="button submit"
                        onClick={signup? handleSignIn : handleSignUp}
                    >
                        {signup ? "Login" : "Sign Up"}
                    </div>
                    <div className="bottom">
                        <div className="new-user">
                            {signup ? "New user?" : "Have an account?"}
                        </div>
                        <div
                            className="switch-login"
                            onClick={() => setSignup(!signup)}
                        >
                            {signup ? "Sign Up!" : "Login!"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login