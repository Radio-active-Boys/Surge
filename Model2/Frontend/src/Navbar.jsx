// src/Navbar.jsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import mainLogo from './assets/mainLogo.svg';
import { useUserTypeStore } from './utils/storeUserType';
import JsonTogglePanel from './components/common/Panel';
import DisclaimerModal from './components/common/DisclaimerModal';
import './Navbar.css';

export default function Navbar() {
  const { status, setStatus } = useUserTypeStore();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleAdvancedClick = () => {
    if (status !== 'advanced') {
      setShowDisclaimer(true);
    }
  };

  const confirmSwitch = () => {
    setStatus('advanced');
    setShowDisclaimer(false);
  };

  const cancelSwitch = () => {
    setShowDisclaimer(false);
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">
          <div className="navbar-logo">
            <img src={mainLogo} alt="FrameX Logo" />
          </div>

          <nav className="nav-links">
            <NavLink to="/" className="nav-link">Model Builder</NavLink>
            <NavLink to="/analysis" className="nav-link">Analysis</NavLink>
            <NavLink to="/recorder" className="nav-link">Results</NavLink>
          </nav>

          <div className="mode-toggle">
            <button
              className={`mode-option ${status === 'lite' ? 'active' : ''}`}
              onClick={() => setStatus('lite')}
            >
              Lite
            </button>
            <button
              className={`mode-option ${status === 'advanced' ? 'active' : ''}`}
              onClick={handleAdvancedClick}
            >
              Advanced
            </button>
          </div>
        </div>
      </header>

      {showDisclaimer && (
        <DisclaimerModal
          onConfirm={confirmSwitch}
          onCancel={cancelSwitch}
        />
      )}
      <JsonTogglePanel />
    </>
  );
}
