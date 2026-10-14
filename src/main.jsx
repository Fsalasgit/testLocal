import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Catalog from './pages/Catalog.jsx';
import Admin from './pages/Admin.jsx';
import './styles.css';

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Catalog />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="*" element={<Catalog />} />
  </Routes></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
