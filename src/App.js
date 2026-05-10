import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated } from 'react-spring';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import soundFile from './audio/chamada-senha.mp3';
import { Helmet } from 'react-helmet';


const logoSaude = new URL("./assets/logosaude.png", import.meta.url).href;

// --- NOVO: Lista de unidades disponíveis ---
const UNIDADES_DISPONIVEIS = [
  { id: 'unidade_a', nome: 'Unidade de Saúde A' },
  { id: 'unidade_b', nome: 'Unidade de Saúde B' },
  { id: 'unidade_c', nome: 'Unidade de Saúde C' },
];

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  "https://painel-chamada-jxey.onrender.com";

function App() {
  const [currentCalled, setCurrentCalled] = useState(null);
  const [historicoChamadas, setHistoricoChamadas] = useState({});
  const [callHistory, setCallHistory] = useState([]);

  useEffect(() => {
    console.log("Histórico atualizado:", callHistory);
  }, [callHistory]);

  const [waitingQueue, setWaitingQueue] = useState([]);
  const [isPulsating, setPulsating] = useState(false);
  const [audioAllowed, setAudioAllowed] = useState(false);
  const [clock, setClock] = useState('');
  const [socketStatus, setSocketStatus] = useState('desconectado'); // desconectado, conectado, erro, conectando
  
  // --- NOVOS ESTADOS PARA A UNIDADE ---
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(UNIDADES_DISPONIVEIS[0].id);
  const [painelIniciado, setPainelIniciado] = useState(false);
  // ------------------------------------

  const speak = (text) => {
    if (!audioAllowed || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  const audioRef = useRef(null);

  // --- FUNÇÃO PARA INICIAR O PAINEL ---
  const iniciarPainel = () => {
    // 🔔 Cria o áudio e guarda a referência
    audioRef.current = new Audio(soundFile);
    audioRef.current.volume = 1;

    // 🔓 Desbloqueia o áudio com interação real
    audioRef.current.play()
      .then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      })
      .catch(() => {});

    // 🔓 Desbloqueia TTS
    const unlock = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlock);

    setAudioAllowed(true);
    setPainelIniciado(true);
  };

  // -------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour12: false });
      setClock(time);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const socketRef = useRef(null);

  const normalizarChamadas = (lista) => {
    return (lista || []).map(item => ({
      ...item,
      hora: item.hora || new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }));
  };

  

  useEffect(() => {
    if (!painelIniciado) return;
    console.log("SOCKET_URL:", SOCKET_URL);
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      withCredentials: true,
    });
    
    const socket = socketRef.current;

    console.log("🔌 Conectando ao servidor...");
    setSocketStatus('conectando');

    socket.on('connect', () => {
      console.log('🟢 Painel conectado.');
      setSocketStatus('conectado');
    });

    socket.on('disconnect', () => {
      console.log('🔴 Painel desconectado.');
      setSocketStatus('desconectado');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
      setSocketStatus('erro');
    });

    socket.on('estado_inicial', (data) => {
      setWaitingQueue(data.waitingQueue || []);
    });

    socket.on('filas_atualizadas', (data) => {
      setWaitingQueue(data.waitingQueue || []);
    });


    socket.on('senha_chamada', (data) => {
      const called = data.currentCalled;
      if (!called) return;

      const horaAtual = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      setCurrentCalled({ ...called, hora: horaAtual });

      // 🔔 DINGLE → 🗣️ VOZ
      if (audioAllowed && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});

        setTimeout(() => {
          speak(`Senha ${called.tipo} ${called.numero}, guichê ${called.guiche}`);
        }, 1500);
      } else {
        speak(`Senha ${called.tipo} ${called.numero}, guichê ${called.guiche}`);
      }

      setHistoricoChamadas(prev => {
        const senha = `${called.tipo}${called.numero}`;
        const registroAtual = prev[senha];

        return {
          ...prev,
          [senha]: {
            senha,
            quantidade: registroAtual ? registroAtual.quantidade + 1 : 1,
            ultimaHora: horaAtual
          }
        };
      });
    });

    // const historicoAgrupado = Object.values(
    //   (callHistory || []).reduce((acc, item) => {
    //     const senha = `${item.tipo}${item.numero}`;

    //     if (!acc[senha]) {
    //       acc[senha] = {
    //         senha,
    //         quantidade: 1,
    //         ultimaHora: item.hora
    //       };
    //     } else {
    //       acc[senha].quantidade += 1;
    //       acc[senha].ultimaHora = item.hora;
    //     }

    //     return acc;
    //   }, {})
    // );

    socket.on('historico_adicionado', (data) => {
      setCallHistory(prev => [data, ...prev]);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [painelIniciado, audioAllowed]);

  const pulseAnimation = useSpring({
    from: { fontSize: '12rem' }, 
    to: { fontSize: isPulsating ? '14rem' : '12rem' },
    config: { duration: 400 },
    reset: isPulsating,
  });

  // --- RENDERIZAÇÃO CONDICIONAL DO MODAL DE INÍCIO ---
  if (!painelIniciado) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col justify-center items-center z-50 text-white p-4">
        <Helmet>
          <link rel="icon" type="image/png" href={logoSaude} />
          <title>Iniciar Painel - Seleção de Unidade</title>
        </Helmet>
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg">
          <label htmlFor="unidade-select" className="block text-2xl font-medium text-gray-700 mb-3">
            Selecione a Unidade:
          </label>
          <select
            id="unidade-select"
            value={unidadeSelecionada}
            onChange={(e) => setUnidadeSelecionada(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-3 text-2xl border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-2xl rounded-md text-gray-800 border-2"
          >
            {UNIDADES_DISPONIVEIS.map((unidade) => (
              <option key={unidade.id} value={unidade.id}>
                {unidade.nome}
              </option>
            ))}
          </select>

          <p className="text-lg text-gray-500 mt-6 text-center">
            Ao clicar em iniciar, o painel será carregado para a unidade selecionada e o som será liberado.
          </p>

          <button
            onClick={iniciarPainel}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-2xl transition duration-300 shadow-lg transform hover:scale-[1.01]"
          >
            INICIAR PAINEL
          </button>
        </div>
      </div>
    );
  }
  // ----------------------------------------------------

  // Se o painel estiver iniciado, o restante do componente é renderizado
  const nomeUnidade = UNIDADES_DISPONIVEIS.find(u => u.id === unidadeSelecionada)?.nome || 'Unidade';

  const historicoAgrupado = Object.values(
    (callHistory || []).reduce((acc, item) => {
      const senha = `${item.tipo}${item.numero}`;

      const hora = item.hora || '--:--:--';

      if (!acc[senha]) {
        acc[senha] = {
          senha,
          quantidade: 1,
          ultimaHora: hora
        };
      } else {
        acc[senha].quantidade += 1;
        acc[senha].ultimaHora = hora;
      }

      return acc;
    }, {})
  );

  const historicoArray = Object.values(historicoChamadas).sort(
    (a, b) => b.ultimaHora.localeCompare(a.ultimaHora)
  );

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100">
      <Helmet>
        {/* Título atualizado com a unidade */}
        <title>Painel de Chamada - {nomeUnidade}</title>
        <meta name="description" content={`Painel digital de chamadas de senhas para a ${nomeUnidade}`} />
      </Helmet>


      {/* Cabeçalho */}
      <header className="bg-blue-800 text-white flex justify-between items-center px-6 py-3 shadow-lg">
        <h1 className="text-3xl font-light tracking-wide">PAINEL DE CHAMADA - {nomeUnidade.toUpperCase()}</h1>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-mono">{clock}</span>
          <span
            className={`w-3 h-3 rounded-full ${
              socketStatus === 'conectado' ? 'bg-green-500' :
              socketStatus === 'desconectado' ? 'bg-gray-400' :
              socketStatus === 'erro' ? 'bg-red-500' : 'bg-yellow-500'
            }`}
            title={`Status da conexão: ${socketStatus}`}
          ></span>
        </div>
      </header>

      <main className="flex flex-grow overflow-hidden">
        {/* Coluna Esquerda */}
        <section className="w-2/3 flex flex-col p-6 bg-white border-r border-gray-300">
          {/* Visor da Chamada (metade da altura) */}
          <div className="flex flex-col justify-center items-center border rounded-lg bg-green-50 shadow-sm h-2/3">
            <h2 className="text-2xl font-bold text-green-700 mb-3">
              CHAMADO EM ATENDIMENTO
            </h2>
            {currentCalled ? (
              <div className="flex flex-col items-center justify-center">
                <animated.div
                  className="font-black text-blue-800 text-[12rem] leading-none" 
                  style={pulseAnimation}
                >
                  {`${currentCalled.tipo}${currentCalled.numero}`}
                </animated.div>
                <p 
                  className="text-gray-700 text-5xl font-semibold mt-2"
                >
                  Guichê {currentCalled.guiche}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-2xl text-center mt-6">
                Aguardando próxima chamada...
              </p>
            )}
          </div>

          {/* Histórico + Lista de Espera lado a lado (metade inferior) */}
          <div className="flex flex-row gap-4 mt-6 h-1/3">
            {/* Histórico */}
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-bold text-gray-700 mb-2 text-center">
                HISTÓRICO DE CHAMADAS
              </h2>
              <div className="border rounded-lg p-3 bg-gray-50 overflow-y-auto flex-1">
                {historicoArray.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-gray-200 py-2 flex justify-between items-center text-sm"
                  >
                    <span className="text-blue-800 font-semibold">
                      {item.senha}{' '}
                      <span className="text-gray-500">({item.quantidade})</span>
                    </span>

                    <span className="text-gray-500">
                      {item.ultimaHora}
                    </span>
                  </div>
                ))}

              </div>
            </div>

            {/* Fila de Espera */}
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-bold text-gray-700 mb-2 text-center">
                LISTA DE ESPERA
              </h2>
              <div className="border rounded-lg p-3 bg-gray-50 overflow-y-auto flex-1">
                {waitingQueue.length > 0 ? (
                  waitingQueue.map((item, index) => (
                    <div
                      key={`${item.tipo}${item.numero}-${index}`} 
                      className={`p-2 mb-2 rounded-lg bg-white shadow-sm border-l-4 ${item.tipo === 'P' ? 'border-red-500' : 'border-green-500'} flex justify-between items-center`}
                    >
                      <div>
                        <p className="font-semibold text-blue-800 text-xl">
                          {`${item.tipo}${item.numero}`} 
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.tipo === 'P' ? 'Prioritário' : 'Normal'}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 self-center">
                        {item.hora || '—'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 mt-6">
                    Nenhuma senha na fila.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto text-center text-gray-400 text-xs pt-4">
            Desenvolvido por © Joabson Nogueira 2025
          </div>
        </section>


        {/* Coluna Direita */}
        <aside className="w-1/3 flex flex-col bg-gray-50">
          {/* Vídeo (Record News) */}
          <div className="p-4 border-b border-gray-300 bg-white shadow-md">
            {/* <iframe width="100%" height="277" src="https://www.youtube.com/embed/jfKfPfyJRdk" title="lofi hip hop radio 📚 beats to relax/study to" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> */}
            <iframe width="100%" height="277" src="https://www.youtube.com/embed/ABVQXgr2LW4?controls=0&autoplay=1&mute=1" title="SBT Ao Vivo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          </div>

          {/* QR Code */}
          <div className="p-4 bg-white border-t border-gray-300 text-center mt-auto">
            <h3 className="text-md font-semibold text-green-700 mb-2">RETIRE SUA SENHA PELO CELULAR OU RETIRE NO GUICHÊ</h3>
           <div className="flex justify-center mb-2">
              {(() => {
                const unidade = UNIDADES_DISPONIVEIS.find(u => u.id === unidadeSelecionada);
                if (!unidade) return null;

                return (
                  <div className="text-center">
                    <QRCodeSVG 
                      value={`https://painel-chamada-jxey.onrender.com/emitir?unidade=${unidade.id}`}
                      size={160} 
                      level="H" 
                    />
                  </div>
                );
              })()}
            </div>
            <p className="text-gray-600 text-sm">Aponte a câmera e emita sua senha digital.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;