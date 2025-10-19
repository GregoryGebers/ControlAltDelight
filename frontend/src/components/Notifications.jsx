import React, { useState, useEffect, useRef  } from "react";
import './Notifications.css';
import bell_icn from '../assets/bell.svg';

/**
 * Dropdown selection Component
 * 
 * This function creates the dropdown for the notifications
 * @param {JSX.element} content - able to change Authentication state
 * @param {string} givenWidth - the width of the dropdown bar, default is 220px
 * @param {JSX.element} open - set the state of the dropdown to open
 * 
 * @returns {JSX.Element} - Dropdown menu component
 */

export default function Notifications({ content, givenWidth='220px' }) {
    const [open, setOpen] = useState(false);
    const notificationsRef = useRef();

    const toggleDropdown = () => {
        setOpen(!open);
    };

    const closeDropdown = () => {
        setOpen(false)
    }

    // If the user clicks on anywhere else on the page, close the dropdown menu
    useEffect(() => {
        const handler = (event) => {
            if (open && notificationsRef.current && !notificationsRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("click", handler);

        return () => {
            document.removeEventListener("click", handler);
        };
    }, [open]);

    return (
        <div className="notifications" ref={notificationsRef}>
            {/* Dropdown main bar with images up/down */}
            <div 
                className={`button bell ${open ? "notifications-open" : null}`} 
                onClick={toggleDropdown}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="35"
                    height="35"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="bell_img"
                >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14.235 19c.865 0 1.322 1.024 .745 1.668a3.992 3.992 0 0 1 -2.98 1.332a3.992 3.992 0 0 1 -2.98 -1.332c-.552 -.616 -.158 -1.579 .634 -1.661l.11 -.006h4.471z" />
                    <path d="M12 2c1.358 0 2.506 .903 2.875 2.141l.046 .171l.008 .043a8.013 8.013 0 0 1 4.024 6.069l.028 .287l.019 .289v2.931l.021 .136a3 3 0 0 0 1.143 1.847l.167 .117l.162 .099c.86 .487 .56 1.766 -.377 1.864l-.116 .006h-16c-1.028 0 -1.387 -1.364 -.493 -1.87a3 3 0 0 0 1.472 -2.063l.021 -.143l.001 -2.97a8 8 0 0 1 3.821 -6.454l.248 -.146l.01 -.043a3.003 3.003 0 0 1 2.562 -2.29l.182 -.017l.176 -.004z" />
                </svg>
            </div>
            
            {/* Notifications content */}
            <div>
                <div 
                    className={`notifications-content ${open ? "content-open" : null}`}
                    style={{ 
                        width: givenWidth,
                        '--given-width': givenWidth
                    }}
                >
                    <div className="notification-text">notifications</div>
                    <div className="notification-underline"></div>
                    <div className="notifications-items-container">
                        {content(closeDropdown)}
                    </div>
                </div>
            </div>
        </div>
    )
}