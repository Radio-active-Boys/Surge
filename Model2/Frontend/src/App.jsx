// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUserTypeStore } from './utils/storeUserType';
import Navbar from './Navbar';

// Advanced
import ModelBuilderPage from './pages/ModelBuilderPage';
import AnalysisPage from './pages/AnalysisPage';
import ResultsPage from './pages/ResultsPage';

// Lite
import ModelBuilderPageLite from './pages/ModelBuilderPageLite';
import AnalysisPageLite from './pages/AnalysisPageLite';

function App() {
  const status = useUserTypeStore(state => state.status);

  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        {/* Model Builder */}
        <Route
          path="/"
          element={
            status === 'lite'
              ? <ModelBuilderPageLite />
              : <ModelBuilderPage />
          }
        />

        {/* Analysis */}
        <Route
          path="/analysis"
          element={
            status === 'lite'
              ? <AnalysisPageLite />
              : <AnalysisPage />
          }
        />
          <Route
            path="/recorder"
            element={<ResultsPage />}
          />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
