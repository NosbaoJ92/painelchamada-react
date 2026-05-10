// OperatorPanel.jsx
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { useSpring, animated } from "react-spring";
import { Helmet } from "react-helmet";

/**
 * OperatorPanel - Tela do operador corrigida e completa.
 * - Usa socketRef (não cria socket global).
 * - Lê operadorConfig do localStorage (ex.: TelaConfiguracao salva como "operadorConfig").
 * - Mantém toda a lógica original (chamar, rechamar, finalizar, emitir senha, sincronização de filas).
 * - Evita problemas de stale state usando refs onde necessário.
 */

// configurar URL via env
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3001";

/* --------------------------
   Componentes reutilizáveis
   -------------------------- */
const Card = ({ title, children, className = "" }) => (
  <div className={`p-4 bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}>
    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 text-center">{title}</h3>
    {children}
  </div>
);

const Button = ({ children, onClick, colorClass, disabled = false, isCalling = false }) => {
  const defaultClasses = "w-full text-white font-bold py-4 px-4 rounded-xl transition duration-300 shadow-md";
  const disabledClasses = "bg-gray-400 cursor-not-allowed shadow-inner";

  const animationStyle = useSpring({
    scale: disabled ? 1 : isCalling ? 1.03 : 1,
    config: { friction: 12, tension: 400 },
  });

  return (
    <animated.button
      style={animationStyle}
      onClick={onClick}
      disabled={disabled}
      className={`${defaultClasses} ${disabled ? disabledClasses : colorClass} ${isCalling ? "animate-pulse" : "hover:scale-[1.02]"}`}
    >
      {children}
    </animated.button>
  );
};

/* --------------------------
   Views: Queue & History
   -------------------------- */
const QueueView = ({ normalQueue, priorityQueue }) => (
  <div className="flex flex-row md:flex-row gap-6">
    <div className="w-1/2 p-3 bg-green-50 rounded-lg border-2 border-green-300">
      <h4 className="text-xl font-bold text-green-700 mb-3 text-center">NORMAIS ({normalQueue.length})</h4>
      <div className="h-64 overflow-y-auto space-y-1">
        {normalQueue.length > 0 ? normalQueue.map((senha, idx) => (
          <div key={`n-${idx}-${senha.numero}`} className="p-2 bg-white rounded-md shadow-sm text-gray-700 text-lg font-mono flex justify-between items-center">
            <span className="text-lg font-semibold">N{String(senha.numero).padStart(2, "0")}</span>
            <span className="text-sm text-gray-500">#{idx + 1}</span>
          </div>
        )) : <p className="text-center text-gray-500 py-6">Fila Normal Vazia!</p>}
      </div>
    </div>

    <div className="w-1/2 p-3 bg-red-50 rounded-lg border-2 border-red-300">
      <h4 className="text-xl font-bold text-red-700 mb-3 text-center">PRIORITÁRIAS ({priorityQueue.length})</h4>
      <div className="h-64 overflow-y-auto space-y-1">
        {priorityQueue.length > 0 ? priorityQueue.map((senha, idx) => (
          <div key={`p-${idx}-${senha.numero}`} className="p-2 bg-white rounded-md shadow-sm text-red-700 text-lg font-mono flex justify-between items-center">
            <span className="text-xl font-extrabold">P{String(senha.numero).padStart(2, "0")}</span>
            <span className="text-sm text-gray-500">#{idx + 1}</span>
          </div>
        )) : <p className="text-center text-gray-500 py-6">Fila Prioritária Vazia!</p>}
      </div>
    </div>
  </div>
);

const HistoryView = ({ callHistory }) => {
  const displayHistory = callHistory.slice(0, 50);
  const formatTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "N/A";

  return (
    <div className="p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
      <h4 className="text-xl font-bold text-gray-700 mb-3 text-center">Últimas Chamadas ({callHistory.length})</h4>
      <div className="h-64 overflow-y-auto space-y-2">
        {displayHistory.length > 0 ? displayHistory.map((entry, i) => {
          const isPriority = entry.tipo === "prioritaria";
          const ticketDisplay = entry.ticket ? entry.ticket : `${isPriority ? "P" : "N"}${String(entry.numero).padStart(2, "0")}`;
          return (
            <div key={`${entry.timestamp}-${i}`} className={`p-3 rounded-lg shadow-sm flex justify-between items-center ${isPriority ? "bg-red-100 border-l-4 border-red-500" : "bg-blue-100 border-l-4 border-blue-500"}`}>
              <div className="flex flex-col">
                <span className={`text-xl font-extrabold ${isPriority ? "text-red-800" : "text-blue-800"}`}>{ticketDisplay}</span>
                <span className="text-xs text-gray-600">{isPriority ? "PRIORITÁRIO" : "NORMAL"}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-700 block">Guichê {entry.guiche}</span>
                <span className="text-xs text-gray-500">{formatTime(entry.timestamp)}</span>
              </div>
            </div>
          );
        }) : <p className="text-center text-gray-500 py-6">Nenhum registro de atendimento.</p>}
      </div>
    </div>
  );
};

/* --------------------------
   Component Principal
   -------------------------- */
function OperatorPanel() {
  const { guicheId } = useParams();
  const navigate = useNavigate();

  // guichê (carrega do localStorage se existir)
  const [guiche, setGuiche] = useState(() => {
    const saved = localStorage.getItem("guiche");
    if (guicheId) return Number(guicheId);
    return saved ? parseInt(saved, 10) : 1;
  });

  // filas / histórico / estado
  const [normalQueue, setNormalQueue] = useState([]);
  const [priorityQueue, setPriorityQueue] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [currentOperatorCall, setCurrentOperatorCall] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [socketStatus, setSocketStatus] = useState("conectando");
  const [systemMessage, setSystemMessage] = useState("");
  const [activeTab, setActiveTab] = useState("queue");

  // config: lida com operadorConfig salvo pela TelaConfiguracao
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("operadorConfig");
    if (!saved) return { showControls: true, showEmission: true, showQueue: true, showHistory: true };
    try { return JSON.parse(saved); } catch { return { showControls: true, showEmission: true, showQueue: true, showHistory: true }; }
  });

  // refs para evitar stale closures
  const socketRef = useRef(null);
  const currentOperatorCallRef = useRef(currentOperatorCall);
  const normalQueueRef = useRef(normalQueue);
  const priorityQueueRef = useRef(priorityQueue);

  useEffect(() => { currentOperatorCallRef.current = currentOperatorCall; }, [currentOperatorCall]);
  useEffect(() => { normalQueueRef.current = normalQueue; }, [normalQueue]);
  useEffect(() => { priorityQueueRef.current = priorityQueue; }, [priorityQueue]);

  // salva guiche localmente quando muda
  useEffect(() => {
    localStorage.setItem("guiche", String(guiche));
  }, [guiche]);

  // se mudar operadorConfig externamente (ex.: voltou da tela de configuração), atualiza config
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "operadorConfig") {
        try {
          setConfig(JSON.parse(e.newValue));
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // util
  const displayMessage = (msg) => {
    setSystemMessage(msg);
    setTimeout(() => setSystemMessage(""), 5000);
  };

  /* --------------------------
     Socket: criar / configurar listeners
     -------------------------- */
  useEffect(() => {
    // cria socket uma vez (ou quando guiche troca)
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("conectado");
      // opcional: registrar guiche no servidor, se desejar
      // socket.emit('registrar_operador', { guiche });
    });

    socket.on("disconnect", () => setSocketStatus("desconectado"));

    socket.on("connect_error", (err) => {
      console.error("[Socket] connect_error", err?.message);
      setSocketStatus("erro");
    });

    // estado inicial recebido do servidor
    socket.on("estado_inicial", (data) => {
      if (!data) return;
      setNormalQueue(Array.isArray(data.normalQueue) ? data.normalQueue : []);
      setPriorityQueue(Array.isArray(data.priorityQueue) ? data.priorityQueue : []);
      setCallHistory(Array.isArray(data.callHistory) ? data.callHistory : []);
      if (data.currentOperatorCall) {
        setCurrentOperatorCall(data.currentOperatorCall);
      }
      setIsCalling(false);
    });

    // filas atualizadas (broadcast)
    socket.on("filas_atualizadas", (data) => {
      setNormalQueue(Array.isArray(data.normalQueue) ? data.normalQueue : []);
      setPriorityQueue(Array.isArray(data.priorityQueue) ? data.priorityQueue : []);
    });

    // chamada realizada (qualquer guichê)
    socket.on("senha_chamada", (payload) => {
      const called = payload && payload.currentCalled ? payload.currentCalled : payload;
      if (!called) return;

      const cur = currentOperatorCallRef.current;
      const isSame = cur && cur.tipo === called.tipo && String(cur.numero) === String(called.numero);

      if (!isSame) {
        setNormalQueue(prev => prev.filter(s => !(s.tipo === called.tipo && String(s.numero) === String(called.numero))));
        setPriorityQueue(prev => prev.filter(s => !(s.tipo === called.tipo && String(s.numero) === String(called.numero))));
      }

      setIsCalling(false);
    });

    // histórico adicionado
    socket.on("historico_adicionado", (entry) => {
      if (!entry) return;
      setCallHistory(prev => [entry, ...prev].slice(0, 200));
    });

    // erro do servidor
    socket.on("erro_servidor", (err) => {
      displayMessage(`Erro servidor: ${err?.message || "Erro desconhecido"}`);
      setIsCalling(false);
    });

    // confirmação de guichê livre
    socket.on("guiche_livre_confirmado", (data) => {
      if (data && Number(data.guiche) === Number(guiche)) {
        setCurrentOperatorCall(null);
        currentOperatorCallRef.current = null;
        setIsCalling(false);
      }
    });

    // cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [guiche]); // recria se guiche mudar

  // sync guicheId param
  useEffect(() => {
    if (guicheId) setGuiche(Number(guicheId));
  }, [guicheId]);

  /* --------------------------
     Actions (emit events using socketRef.current)
     -------------------------- */
  const chamarProximaSenha = (tipo) => {
    if (isCalling) return;
    if (currentOperatorCallRef.current) {
      displayMessage("Finalize o atendimento atual antes de chamar o próximo!");
      return;
    }

    setIsCalling(true);

    // pega filas atuais via refs para garantir valor mais recente
    const newNormal = [...normalQueueRef.current];
    const newPriority = [...priorityQueueRef.current];

    let prox = null;
    if (tipo === "prioritaria" && newPriority.length > 0) prox = newPriority.shift();
    else if (tipo === "normal" && newNormal.length > 0) prox = newNormal.shift();

    if (!prox) {
      displayMessage(`Não há mais senhas ${tipo} na fila!`);
      setIsCalling(false);
      return;
    }

    // atualiza local (otimista)
    setCurrentOperatorCall(prox);
    currentOperatorCallRef.current = prox;
    setNormalQueue(newNormal);
    setPriorityQueue(newPriority);
    normalQueueRef.current = newNormal;
    priorityQueueRef.current = newPriority;

    // envia para servidor
    if (!socketRef.current || socketRef.current.disconnected) {
      displayMessage("Socket não conectado.");
      setIsCalling(false);
      return;
    }

    socketRef.current.emit("chamar_senha", { tipo: prox.tipo, numero: prox.numero, guiche });
    socketRef.current.emit("sincronizar_filas_apos_chamada", { normalQueue: newNormal, priorityQueue: newPriority });
  };

  const finalizarAtendimento = () => {
    const cur = currentOperatorCallRef.current;
    if (!cur) return;
    const ticket = `${cur.tipo === "prioritaria" ? "P" : "N"}${String(cur.numero).padStart(2, "0")}`;

    if (!socketRef.current || socketRef.current.disconnected) {
      displayMessage("Socket não conectado.");
      return;
    }

    socketRef.current.emit("finalizar_atendimento", { ticket, tipo: cur.tipo, numero: cur.numero, guiche, timestamp: new Date().toISOString() });

    // atualiza localmente também
    const entry = { guiche, ticket, tipo: cur.tipo, numero: cur.numero, timestamp: new Date().toISOString() };
    setCallHistory(prev => [entry, ...prev].slice(0, 200));
    setCurrentOperatorCall(null);
    currentOperatorCallRef.current = null;
    setIsCalling(false);
  };

  const reChamarSenha = () => {
    const cur = currentOperatorCallRef.current;
    if (!cur) return displayMessage("Nenhuma senha em atendimento para ser rechamada.");
    setIsCalling(true);
    if (!socketRef.current || socketRef.current.disconnected) return displayMessage("Socket não conectado.");
    socketRef.current.emit("chamar_senha", { tipo: cur.tipo, numero: cur.numero, guiche });
    setTimeout(() => setIsCalling(false), 600);
  };

  const emitirSenhaFisica = (tipo) => {
    if (isCalling) return;
    if (!socketRef.current || socketRef.current.disconnected) return displayMessage("Socket não conectado.");
    socketRef.current.emit("emitir_senha_usuario", tipo, (response) => {
      if (!response || response.error) return displayMessage(`Erro ao emitir senha física: ${response?.message || "Erro desconhecido"}`);
      const ticket = response.ticket || response;
      const numeroStr = String(ticket.numero ?? ticket.number).padStart(3, "0");
      const tipoLabel = (ticket.tipo === "prioritaria" || tipo === "prioritaria") ? "P" : "N";
      const ticketCode = `${tipoLabel}${numeroStr}`;
      const dataStr = ticket.data ? `${ticket.data}, ${ticket.hora || ""}` : new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

      const conteudoImpressao = `
        <!doctype html>
        <html>
        <head><meta charset="utf-8"><title>Senha ${ticketCode}</title>
        <style>
          @media print { body { margin:0; -webkit-print-color-adjust: exact; } .wrapper{padding:20px;} }
          body { font-family: Arial, Helvetica, sans-serif; color: #222; }
          .box { width: 320px; margin: 0 auto; text-align: center; padding: 18px; border: 2px dashed #333; }
          h2 { margin: 0 0 8px 0; font-size: 18px; font-weight: 700; }
          .ticket { font-size: 56px; margin: 8px 0; font-weight: 800; color: ${tipoLabel === 'P' ? '#b91c1c' : '#2563eb'}; }
          .cat { margin-top:6px; font-size:14px; color:#555; font-weight:600; }
          .meta { margin-top:10px; font-size:12px; color:#666; }
          .foot { margin-top:12px; font-size:10px; color:#999; }
        </style>
        </head><body>
          <div class="wrapper">
            <div style="text-align: left; font-size: 12px; color:#333; margin-bottom:8px;">${dataStr}</div>
            <div class="box">
              <h2>Unidade de Atendimento</h2>
              <div class="ticket">${ticketCode}</div>
              <div class="cat">${ticket.categoria || (tipoLabel==='P' ? 'PRIORITÁRIA' : 'NORMAL')}</div>
              <div class="meta">Emitida em: ${dataStr}</div>
              <div class="foot">© Joabson Nogueira - Sistema de Atendimento</div>
            </div>
          </div>
        </body></html>
      `;

      const printWindow = window.open("", "_blank");
      if (!printWindow) return displayMessage("Permita pop-ups para imprimir a senha.");
      printWindow.document.open();
      printWindow.document.write(conteudoImpressao);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
      displayMessage(`Senha ${ticketCode} emitida com sucesso!`);
    });
  };

  /* --------------------------
     UI helpers / render
     -------------------------- */
  const currentTicketInfo = currentOperatorCall ? "Ocupado" : "Livre";
  const statusCardStyle = useSpring({ backgroundColor: currentOperatorCall ? "#eff6ff" : "#f7fee7", borderColor: currentOperatorCall ? "#60a5fa" : "#84cc16", config: { duration: 400 } });

  const renderTabButton = (label, tabKey, titleText) => (
    <button key={tabKey} onClick={() => setActiveTab(tabKey)}
      className={`px-4 py-2 text-sm font-medium transition duration-300 ${activeTab === tabKey ? 'border-b-4 border-blue-600 text-blue-800 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100'} rounded-t-lg`} title={titleText}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:p-8 font-sans">
      <Helmet><title>Módulo do Operador - Unidade</title></Helmet>

      <header className="bg-blue-800 text-white flex justify-between items-center px-6 py-3 shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Painel do Operador</h1>
          <p className="text-sm text-gray-300">Guichê {guiche}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${socketStatus === 'conectado' ? 'bg-green-500' : socketStatus === 'erro' ? 'bg-red-500' : 'bg-gray-400'}`} title={`Status: ${socketStatus}`} />
          <button onClick={() => navigate('/configurar')}>⚙️</button>
        </div>
      </header>

      {systemMessage && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 my-4 rounded shadow-md"><p>{systemMessage}</p></div>}

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex flex-wrap gap-6">
          <Card title="Meu Guichê Atual" className="flex-1">
            <input type="number" min="1" value={guiche} onChange={(e) => setGuiche(parseInt(e.target.value) || 1)}
              className="w-full text-center text-3xl font-extrabold p-3 mt-2 border-2 border-blue-500 rounded-lg" />
          </Card>

          <animated.div style={statusCardStyle} className="flex-1 text-center p-4 rounded-xl shadow-lg border-2">
            <h3 className="font-semibold mb-2 text-gray-700 border-b pb-2">STATUS DO ATENDIMENTO</h3>
            <p className={`text-3xl font-extrabold ${currentOperatorCall ? 'text-blue-800' : 'text-green-600'}`}>{currentTicketInfo}</p>
            <p className="font-medium mt-2 text-gray-600">{currentOperatorCall ? 'Em Atendimento' : 'Pronto para Atender'}</p>
          </animated.div>
        </div>

        {/* Visualização */}
        {(config.showQueue || config.showHistory) && (
          <Card title="Visualização de Atendimentos" className="w-full">
            <div className="flex border-b border-gray-200 mb-4">
              {config.showQueue && renderTabButton('Fila Atual', 'queue', 'Ver a fila atual')}
              {config.showHistory && renderTabButton('Histórico', 'history', 'Ver histórico de atendimentos')}
            </div>

            {activeTab === 'queue' && config.showQueue && <QueueView normalQueue={normalQueue} priorityQueue={priorityQueue} />}
            {activeTab === 'history' && config.showHistory && <HistoryView callHistory={callHistory} />}
          </Card>
        )}

        {/* Controle de Chamadas */}
        {config.showControls && (
          <Card title="Controle de Chamadas" className="flex flex-col gap-4">
            {currentOperatorCall ? (
              <div className="flex gap-4">
                <Button onClick={reChamarSenha} colorClass="bg-yellow-500 hover:bg-yellow-600" isCalling={isCalling}>RECHAMAR SENHA</Button>
                <Button onClick={finalizarAtendimento} colorClass="bg-red-600 hover:bg-red-700" disabled={isCalling}>FINALIZAR ATENDIMENTO</Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button onClick={() => chamarProximaSenha('prioritaria')} colorClass="bg-red-600 hover:bg-red-700" disabled={isCalling || priorityQueue.length === 0} isCalling={isCalling}>CHAMAR PRIORITÁRIA ({priorityQueue.length})</Button>
                <Button onClick={() => chamarProximaSenha('normal')} colorClass="bg-green-600 hover:bg-green-700" disabled={isCalling || normalQueue.length === 0} isCalling={isCalling}>CHAMAR NORMAL ({normalQueue.length})</Button>
              </div>
            )}
          </Card>
        )}

        {/* Emissão de Senha Física */}
        {config.showEmission && (
          <Card title="Emissão de Senha Física" className="flex flex-col gap-4">
            <div className="flex gap-4">
              <Button onClick={() => emitirSenhaFisica('normal')} colorClass="bg-blue-600 hover:bg-blue-700" disabled={isCalling}>Emitir Senha Normal</Button>
              <Button onClick={() => emitirSenhaFisica('prioritaria')} colorClass="bg-red-500 hover:bg-red-600" disabled={isCalling}>Emitir Senha Prioritária</Button>
            </div>
            <p className="text-xs text-gray-500 p-2 bg-gray-200 rounded text-center">Utilize para pessoas sem celular ou que necessitam da senha impressa.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default OperatorPanel;
