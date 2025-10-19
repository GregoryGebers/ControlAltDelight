import React, { useState, useEffect, useRef  } from "react";
import './Dropdown.css';
import chevron_up from '../assets/chevron-up.jpg';
import chevron_down from '../assets/chevron-down.jpg';

/**
 * Dropdown selection Component
 * 
 * This function creates the dropdown menu that is used for sorting purposes.
 * @param {string} buttonText - text to go on the dropdown button
 * @param {JSX.element} content - content in the dropdown
 * @param {string} givenWidth - the width of the dropdown bar, default is 220px
 * 
 * @returns {JSX.Element} - Dropdown menu component
 */

export default function Dropdown({ buttonText, content, givenWidth='220px' }) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef();

    // Setting the dropdown to be either closed or open
    const toggleDropdown = () => {
        setOpen(!open);
    };

    const handleSelection = () => {
        setOpen(false);
    };

    // If the user clicks on anywhere else on the page, close the dropdown menu
    useEffect(() => {
        const handler = (event) => {
            if (open && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("click", handler);

        return () => {
            document.removeEventListener("click", handler);
        };
    }, [open]);

    return (
        <div className="dropdown" ref={dropdownRef}>
            {/* Dropdown main bar with images up/down */}
            <div 
                className={`dropdown-btn ${open ? "button-open" : null}`} 
                onClick={toggleDropdown}
                style={{ width: givenWidth}}
            >
                {buttonText}
                <span className="toggle-icon">
                    {open ?
                        <img 
                            src={chevron_up} 
                            className="dropdown-down" 
                            alt="Toggle dropdown"
                        /> :
                        <img 
                            src={chevron_down} 
                            className="dropdown-down" 
                            alt="Toggle dropdown"
                        />
                    }
                </span>
            </div>
            {/* Dropdown content */}
            <div 
                className={`dropdown-content ${open ? "content-open" : null}`}
                style={{ 
                    width: givenWidth,
                    '--given-width': givenWidth
                }}
                onClick={handleSelection}
            >
                {content}
            </div>
        </div>
    )
}