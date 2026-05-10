import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';
import { Helmet } from 'react-helmet';

// Configurações do ambiente
const SOCKET_URL = 'http://localhost:3001';
const socket = io(SOCKET_URL);

// --- Componentes Reutilizáveis ---

const Card = ({ title, children, className = '' }) => (
  <div className={`p-4 bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}>
    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 text-center">{title}</h3>
    {children}
  </div>
);

const Button = ({ children, onClick, colorClass, disabled = false, isCalling = false }) => {
  const defaultClasses = "w-full text-white font-bold py-4 px-4 rounded-xl transition duration-300 shadow-md";
  const disabledClasses = "bg-gray-400 cursor-not-allowed shadow-inner";

  const animationStyle = useSpring({
    scale: disabled ? 1 : isCalling ? 1.05 : 1,
    config: { friction: 10, tension: 500 }
  });

  return (
    <animated.button
      style={animationStyle}
      onClick={onClick}
      disabled={disabled}
      className={`${defaultClasses} ${disabled ? disabledClasses : colorClass} ${isCalling ? 'animate-pulse' : 'hover:scale-[1.02]'}`}
    >
      {children}
    </animated.button>
  );
};

// --- Componentes de Visualização ---

const QueueView = ({ normalQueue, priorityQueue }) => (
  <div className="flex flex-row md:flex-row gap-6">
    <div className="w-1/2 md:w-1/2 p-3 bg-green-50 rounded-lg border-2 border-green-300">
      <h4 className="text-xl font-bold text-green-700 mb-3 text-center">NORMAIS ({normalQueue.length})</h4>
      <div className="h-64 overflow-y-auto space-y-1">
        {normalQueue.length > 0 ? normalQueue.map((senha, index) => (
          <div key={`n-${index}-${senha.numero}`} className="p-2 bg-white rounded-md shadow-sm text-gray-700 text-lg font-mono flex justify-between items-center">
            <span className="text-lg font-semibold">N{String(senha.numero).padStart(2, '0')}</span>
            <span className="text-sm text-gray-500">#{index + 1} na fila</span>
          </div>
        )) : <p className="text-center text-gray-500 py-6">Fila Normal Vazia!</p>}
      </div>
    </div>

    <div className="w-1/2 md:w-1/2 p-3 bg-red-50 rounded-lg border-2 border-red-300">
      <h4 className="text-xl font-bold text-red-700 mb-3 text-center">PRIORITÁRIAS ({priorityQueue.length})</h4>
      <div className="h-64 overflow-y-auto space-y-1">
        {priorityQueue.length > 0 ? priorityQueue.map((senha, index) => (
          <div key={`p-${index}-${senha.numero}`} className="p-2 bg-white rounded-md shadow-sm text-red-700 text-lg font-mono flex justify-between items-center">
            <span className="text-xl font-extrabold">P{String(senha.numero).padStart(2, '0')}</span>
            <span className="text-sm text-gray-500">#{index + 1} na fila</span>
          </div>
        )) : <p className="text-center text-gray-500 py-6">Fila Prioritária Vazia!</p>}
      </div>
    </div>
  </div>
);

const HistoryView = ({ callHistory }) => {
  const displayHistory = callHistory.slice(0, 50);
  const formatTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';

  return (
    <div className="p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
      <h4 className="text-xl font-bold text-gray-700 mb-3 text-center">Últimas Chamadas Finalizadas ({callHistory.length} total)</h4>
      <div className="h-64 overflow-y-auto space-y-2">
        {displayHistory.length > 0 ? displayHistory.map((entry, index) => {
          const isPriority = entry.tipo === 'prioritaria';
          const ticketDisplay = entry.ticket ? entry.ticket : `${isPriority ? 'P' : 'N'}${String(entry.numero).padStart(2, '0')}`;
          return (
            <div key={entry.timestamp + index} className={`p-3 rounded-lg shadow-sm flex justify-between items-center transition duration-200 ${isPriority ? 'bg-red-100 border-l-4 border-red-500' : 'bg-blue-100 border-l-4 border-blue-500'}`}>
              <div className="flex flex-col">
                <span className={`text-xl font-extrabold ${isPriority ? 'text-red-800' : 'text-blue-800'}`}>{ticketDisplay}</span>
                <span className="text-xs text-gray-600">{isPriority ? 'PRIORITÁRIO' : 'NORMAL'}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-700 block">Guichê {entry.guiche}</span>
                <span className="text-xs text-gray-500">{formatTime(entry.timestamp)}</span>
              </div>
            </div>
          );
        }) : <p className="text-center text-gray-500 py-6">Nenhum registro de atendimento ainda.</p>}
      </div>
    </div>
  );
};

// --- Componente Principal ---

function OperatorPanel() {
  const { guicheId } = useParams();
  const [guiche, setGuiche] = useState(Number(guicheId) || 1);
  const navigate = useNavigate();
  const [normalQueue, setNormalQueue] = useState([]);
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [currentOperatorCall, setCurrentOperatorCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [systemMessage, setSystemMessage] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [socketStatus, setSocketStatus] = useState('conectando');
  const socketRef = useRef(null);

  const displayMessage = (msg) => {
    setSystemMessage(msg);
    setTimeout(() => setSystemMessage(''), 5000);
  };

  // ======== Socket.IO ========
  useEffect(() => {
    socket.on('connect', () => setSocketStatus('conectado'));
    socket.on('disconnect', () => setSocketStatus('desconectado'));
    socket.on('connect_error', () => setSocketStatus('erro'));

    socket.on('estado_inicial', (data) => {
      setNormalQueue(data.normalQueue || []);
      setPriorityQueue(data.priorityQueue || []);
      setCallHistory(data.callHistory || []);
      setCurrentOperatorCall(data.currentOperatorCall || null);
      setIsCalling(false);
    });

    socket.on('filas_atualizadas', (data) => {
      setNormalQueue(data.normalQueue || []);
      setPriorityQueue(data.priorityQueue || []);
    });

    socket.on('historico_adicionado', (newEntry) => {
      setCallHistory(prev => [newEntry, ...prev]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('estado_inicial');
      socket.off('filas_atualizadas');
      socket.off('historico_adicionado');
    };
  }, []);

  const currentTicketInfo = currentOperatorCall ? 'Ocupado' : 'Livre';
  const statusCardStyle = useSpring({
    backgroundColor: currentOperatorCall ? '#eff6ff' : '#f7fee7',
    borderColor: currentOperatorCall ? '#60a5fa' : '#84cc16',
    config: { duration: 500 }
  });

  const renderTabButton = (label, tabKey) => (
    <button key={tabKey} onClick={() => setActiveTab(tabKey)}
      className={`px-4 py-2 text-sm font-medium transition duration-300 ${activeTab === tabKey ? 'border-b-4 border-blue-600 text-blue-800 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100'} rounded-t-lg`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:p-8 font-sans">
      <Helmet>
        <title>Módulo do Operador - Unidade</title>
        <meta name="description" content="Painel digital de chamadas de senhas para a unidade" />
      </Helmet>

      {/* ===== HEADER ===== */}
      <header className="bg-blue-800 text-white flex justify-between items-center px-6 py-3 shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Painel do Operador</h1>
          <p className="text-sm text-gray-300">Guichê {guiche}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            socketStatus === 'conectado' ? 'bg-green-500' :
            socketStatus === 'desconectado' ? 'bg-gray-400' :
            socketStatus === 'erro' ? 'bg-red-500' : 'bg-yellow-500'
          }`} title={`Status: ${socketStatus}`}></div>

          {/* ⚙️ Botão de Configuração (mantido, funcional) */}
          <button
            onClick={() => navigate('/configurar')}
            className="text-2xl hover:rotate-90 transition-transform duration-300"
            title="Abrir Configurações"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ===== MENSAGEM DO SISTEMA ===== */}
      {systemMessage && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded shadow-md font-medium" role="alert">
          <p>{systemMessage}</p>
        </div>
      )}

      {/* ===== CONTEÚDO ===== */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-wrap md:flex-row gap-6 mb-2">
          <Card title="Meu Guichê Atual" className="flex-1 w-full sm:w-1/2 md:w-1/3">
            <input id="guiche" type="number" min="1" value={guiche}
              onChange={(e) => setGuiche(parseInt(e.target.value) || 1)}
              className="w-full text-center text-3xl font-extrabold p-3 mt-2 border-2 border-blue-500 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
          </Card>

          <animated.div style={statusCardStyle} className="flex-1 w-full sm:w-1/2 md:w-2/3 text-center p-4 rounded-xl shadow-lg border-2">
            <h3 className="font-semibold mb-2 text-gray-700 border-b pb-2">STATUS DO ATENDIMENTO</h3>
            <p className={`text-3xl font-extrabold ${currentOperatorCall ? 'text-blue-800' : 'text-green-600'}`}>{currentTicketInfo}</p>
            <p className="font-medium mt-2 text-gray-600">{currentOperatorCall ? 'Em Atendimento' : 'Pronto para Atender'}</p>
          </animated.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-2">
          <Card title="Visualização de Atendimentos" className="w-full lg:col-span-3 mt-4">
            <div className="flex border-b border-gray-200 mb-4">
              {renderTabButton('Fila Atual', 'queue')}
              {renderTabButton('Histórico', 'history')}
            </div>
            {activeTab === 'queue' && <QueueView normalQueue={normalQueue} priorityQueue={priorityQueue} />}
            {activeTab === 'history' && <HistoryView callHistory={callHistory} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default OperatorPanel;
