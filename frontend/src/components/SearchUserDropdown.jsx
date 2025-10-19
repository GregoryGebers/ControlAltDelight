import React, { useState, useEffect, useRef  } from "react";
import './SearchUserDropdown.css';

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

export default function SearchUserDropdown({ content, givenWidth='220px', hasContent }) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef();

    const handleSelection = () => {
        setOpen(false);
    };

    useEffect(() => {
        setOpen(hasContent);
    }, [hasContent]);

    return (
        <div className="search-dropdown" ref={dropdownRef}>
            <div 
                className={`search-dropdown-content ${open ? "content-open" : null}`}
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