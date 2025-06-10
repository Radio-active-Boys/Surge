 // src/components/common/CommandPreview.jsx
import { useState } from 'react';

const CommandPreview = ({ json }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const renderCommand = (cmd) => {
    return `${cmd.command} ${cmd.args.join(' ')}`;
  };

  return (
    <div className="command-preview">

      {Object.entries(json).map(([category, items]) => (
        <div key={category} className="command-category">
          <div 
            className="category-header" 
            onClick={() => toggleCategory(category)}
          >
            <h4>{category.replace('_', ' ')}</h4>
            <span>{expandedCategories[category] ? '▲' : '▼'}</span>
          </div>
          
          {expandedCategories[category] && (
            <div className="commands-list">
              {items.map((item, index) => (
                <div key={index} className="command-item">
                  <code>{renderCommand(item)}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CommandPreview;