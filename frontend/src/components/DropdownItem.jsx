import React, { useState, useEffect } from "react";
import './DropdownItem.css';

/**
 * Dropdown Item Component
 * 
 * A component that represents a single item within a dropdown menu..
 * 
 * @param {ReactNode} children - The content to be put inside the dropdown item
 * @param {function} onClick - Callback function triggered when the item is clicked
 * @returns {JSX.Element} A dropdown item styling and click handling
 */
export default function DropdownItem({ children, onClick }) {
    return (
        <div 
            className="dropdown-item"
            onClick={onClick}
        >
            {children}
        </div>
    )
}