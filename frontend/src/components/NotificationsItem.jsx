import React, { useState, useEffect } from "react";
import "../index.css";
import './NotificationsItem.css';

/**
 * Dropdown Item Component
 * 
 * A component that represents a single item within a dropdown menu..
 * 
 * @param {ReactNode} children - The content to be put inside the dropdown item
 * @param {function} onJoin - Callback function triggered when join is clicked
 * @param {function} onDecline - Callback function triggered when decline is clicked
 * @returns {JSX.Element} A dropdown item styling and click handling
 */
export default function NotificationsItem({ children, onJoin, onDecline, closeDropdown }) {
    const handleJoin = () => {
        if (onJoin) onJoin();
        if (closeDropdown) closeDropdown();
    }

    const handleDecline = () => {
        if (onDecline) onDecline();
    }

    return (
        <div className="notifications-item">
            <div className="notification-message">{children}</div>
            <div className="notification-actions">
                <div
                    className="join-btn"
                    onClick={handleJoin}
                >
                    Join
                </div>

                <div
                    className="decline-btn"
                    onClick={handleDecline}
                >
                    Decline
                </div>
            </div>
        </div>
    )
}