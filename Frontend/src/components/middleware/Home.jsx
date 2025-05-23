// Home.jsx
import React, { useEffect, useState } from 'react';
import JsonModal from './JsonModal.jsx';
import './Home.css';
import Model from '../model/Model.jsx';
import Analysis from '../analysis/Analysis.jsx';
import Results from '../results/Result.jsx';

const Home = () => {
  const [activeTab, setActiveTab] = useState('Model');
  const [showModal, setShowModal] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'Model':
        return <Model />;
      case 'Result':
        return <Results />;
      case 'Analysis':
        return <Analysis />;
      default:
        return null;
    }
  };

  return (
    <div className="container">
      <div className="tabs">
        {['Model', 'Analysis', 'Result'].map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        <button
          className="preview-button"
          onClick={() => setShowModal(true)}
        >
          JSON
        </button>
      </div>

      <div >
        {renderContent()}
      </div>
      <JsonModal show={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default Home;