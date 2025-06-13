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

  const renderCommand = (item) => {
    const namePart = item.name ? `${item.name} ` : '';
    return `${item.command} ${namePart}${item.args?.join(' ') || ''}`;
  };

  return (
    <div className="command-preview">
      {Object.entries(json).map(([category, items]) => {
        // Only render categories whose value is an array
        if (!Array.isArray(items)) return null;

        return (
          <div key={category} className="command-category">
            <div
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              <h4>{category.replace(/_/g, ' ')}</h4>
              <span>{expandedCategories[category] ? '▲' : '▼'}</span>
            </div>

            {expandedCategories[category] && (
              <div className="commands-list">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <div key={idx} className="command-item">
                      <code>{renderCommand(item)}</code>
                    </div>
                  ))
                ) : (
                  <div className="empty-msg">(no commands)</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CommandPreview;