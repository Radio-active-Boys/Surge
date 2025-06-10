import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ModelBuilderPage from './pages/ModelBuilderPage';
import AnalysisPage from './pages/AnalysisPage';
import ResultsPage from './pages/ResultsPage';
import Navbar from './Navbar'; 

function App() {
  return (
    <BrowserRouter>
      <Navbar /> 
      <Routes>
        <Route path="/" element={<ModelBuilderPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/recorder" element={<ResultsPage />} />
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
