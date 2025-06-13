import React from 'react';
import { NavLink } from 'react-router-dom';
import JsonTogglePanel from './components/common/Panel';
import './Navbar.css';

const Navbar = () => {
  return (
    <>
      <header className="navbar">
        <div className="navbar-container">
          <nav className="nav-links">
            <NavLink exact="true" to="/" className="nav-link">Model Builder</NavLink>
            <NavLink to="/analysis" className="nav-link">Analysis</NavLink>
            <NavLink to="/recorder" className="nav-link">Results</NavLink>
          </nav>
        </div>
      </header>

      <JsonTogglePanel />
    </>
  );
};

export default Navbar;
