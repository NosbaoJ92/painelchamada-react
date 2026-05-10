// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './index.css';
import App from './App'; // Painel Digital (Tela de Chamada)
import OperatorPanel from './OperatorPanel'; // Módulo do Operador
import UserApp from './UserApp'; // NOVO: Módulo de Emissão por Smartphone
import reportWebVitals from './reportWebVitals';

import TelaConfiguracao from './TelaConfiguracao';

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* Rota Padrão (pode redirecionar para o painel ou ser uma tela inicial) */}
        <Route path="/" element={<App />} /> 
        
        {/* Rota 1: TELA DE CHAMADA (TV/Monitor) */}
        <Route path="/painel" element={<App />} />
        
        {/* Rota 2: MÓDULO DO OPERADOR (Computador de Atendimento) */}
        <Route path="/operador" element={<OperatorPanel />} />
        <Route path="/operador/:guicheId" element={<OperatorPanel />} />

        {/* Rota 3: EMISSÃO DE SENHA (Smartphone do Usuário) */}
        <Route path="/emitir"  element={<UserApp />} />

        <Route path="/configurar"  element={<TelaConfiguracao />} />

      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

reportWebVitals();