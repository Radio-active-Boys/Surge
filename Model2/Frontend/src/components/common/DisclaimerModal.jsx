// src/components/common/DisclaimerModal.jsx
import React from 'react';
import './DisclaimerModal.css';

export default function DisclaimerModal({ onConfirm, onCancel }) {
  return (
    <div className="disclaimer-overlay">
      <div className="disclaimer-modal">
        <h2>Switch to Advanced Mode</h2>
        <p>
          Advanced Mode is designed for experienced users who are familiar with the internal
          commands and tagging system of OpenSees. Incorrect usage may result in unstable
          structural models or invalid analysis outcomes.
        </p>
        <p>
          If you are unfamiliar with OpenSees syntax, we recommend reviewing the
          <a
            href="https://openseespydoc.readthedocs.io/en/latest/"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenSeesPy documentation ↗
          </a>
           before proceeding.
        </p>

        <div className="modal-actions">
          <button className="btn-confirm" onClick={onConfirm}>Yes, I Understand</button>
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
