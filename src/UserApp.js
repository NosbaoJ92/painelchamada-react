import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Helmet } from 'react-helmet';

// ===========================================================
// 🔧 Configuração dinâmica do Socket.IO via .env
// ===========================================================
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5
});

function UserApp() {
  const [senhaEmitida, setSenhaEmitida] = useState(null);
  const [aguardandoEmissao, setAguardandoEmissao] = useState(false);
  const [erroEmissao, setErroEmissao] = useState(null);
  const [chamadoParaGuiche, setChamadoParaGuiche] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const alertTimeoutRef = useRef(null);
  const senhaEmitidaRef = useRef(null);

  // Mantém a senha atual no ref
  useEffect(() => {
    senhaEmitidaRef.current = senhaEmitida;
  }, [senhaEmitida]);

  // ===========================================================
  // ⚙️ Configuração inicial do socket e eventos
  // ===========================================================
  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Conectado ao servidor Socket.IO:', SOCKET_URL);
      setIsSocketConnected(true);
    });
    socket.on('disconnect', () => setIsSocketConnected(false));
    socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão Socket.IO:', err.message);
      setIsSocketConnected(false);
    });

    // 🔔 Quando o guichê chama a senha
    socket.on('seu_guiche_chamado', (data) => {
      const minhaSenha = senhaEmitidaRef.current
        ? `${senhaEmitidaRef.current.tipo}${senhaEmitidaRef.current.numero}`
        : null;

      if (minhaSenha && data.ticket === minhaSenha) {
        setChamadoParaGuiche(data.guiche);

        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => {
          clearCallAlert();
        }, 30000);

        // Vibração
        if (navigator.vibrate) {
          navigator.vibrate([300, 150, 300, 150, 300]);
        }

        // Som
        const audio = new Audio('/audio/chamada-senha.mp3');
        audio.play().catch(() => {});

        // Notificação
        const notify = () => {
          new Notification('Sua Senha Foi Chamada!', {
            body: `Dirija-se ao Guichê ${data.guiche} agora.`,
            icon: '/icon.png'
          });
        };

        if (Notification.permission === 'granted') notify();
        else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') notify();
          });
        }
      }
    });

    // Solicita permissão de notificação
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('seu_guiche_chamado');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  const clearCallAlert = () => {
    setChamadoParaGuiche(null);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
  };

  // ===========================================================
  // 🚀 Emitir senha
  // ===========================================================
  const emitirSenha = (tipo) => {
    if (senhaEmitida || aguardandoEmissao) {
      setErroEmissao('⚠️ Você já possui uma senha ativa.');
      return;
    }

    setAguardandoEmissao(true);
    setErroEmissao(null);

    socket.emit('emitir_senha_usuario', tipo, (res) => {
      setAguardandoEmissao(false);
      if (res?.success && res.ticket) {
        setSenhaEmitida(res.ticket);
      } else {
        setErroEmissao('❌ Erro ao emitir senha. Tente novamente.');
      }
    });
  };

  // ===========================================================
  // 🔴 Tela de chamada
  // ===========================================================
  if (chamadoParaGuiche) {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh bg-red-700 text-white text-center p-6"
        style={{ animation: 'pulseBg 2s infinite alternate' }}
      >
        <style>{`
          @keyframes pulseBg {
            0% { background-color: #b91c1c; }
            100% { background-color: #dc2626; }
          }
        `}</style>

        <h1 className="text-5xl font-black mb-8 animate-bounce">🚨 SUA VEZ!</h1>

        <div className="bg-white text-red-700 rounded-3xl p-10 shadow-2xl animate-pulse">
          <p className="text-2xl font-medium mb-4">Dirija-se ao</p>
          <p className="text-7xl font-extrabold">{`Guichê ${chamadoParaGuiche}`}</p>
        </div>

        <p className="mt-10 text-2xl font-semibold">
          Senha: {senhaEmitida?.tipo}
          {senhaEmitida?.numero}
        </p>

        <button
          onClick={clearCallAlert}
          className="mt-10 bg-white text-red-700 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-100 transition"
        >
          Cheguei ao Guichê
        </button>
      </div>
    );
  }

  // ===========================================================
  // 🟦 Tela de espera
  // ===========================================================
  if (senhaEmitida) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-blue-50 p-6 text-center">
        <div
          className={`absolute top-0 right-0 m-4 p-2 rounded-full text-xs font-semibold ${
            isSocketConnected ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          {isSocketConnected ? 'ONLINE' : 'OFFLINE'}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-500 max-w-sm w-full">
          <p className="text-lg font-semibold text-gray-500 mb-2">Sua Senha</p>
          <p className="text-8xl font-black text-blue-800 tracking-wider">
            {senhaEmitida.tipo}
            {senhaEmitida.numero}
          </p>
          <p className="mt-4 text-sm text-gray-400">
            Tipo: {senhaEmitida.tipo === 'P' ? 'Prioritário' : 'Normal'}
          </p>
        </div>

        <h1 className="mt-12 text-3xl font-extrabold text-blue-700">
          Aguarde sua Chamada
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-md">
          Você será alertado automaticamente quando for sua vez.
        </p>
        <p className="mt-8 text-sm text-gray-400">
          <strong>Não feche esta página.</strong> Mantenha-a aberta.
        </p>
      </div>
    );
  }

  // ===========================================================
  // 🟩 Tela inicial
  // ===========================================================
  return (
    <div
      className="flex flex-col items-center justify-center h-dvh p-6 text-center bg-gray-50"
      style={{
        backgroundImage: `radial-gradient(#c6d9ff 1px, transparent 1px), radial-gradient(#c6d9ff 1px, #f9fafb 1px)`,
        backgroundSize: '30px 30px',
        backgroundPosition: '0 0, 15px 15px'
      }}
    >
      <div
        className={`absolute top-0 right-0 m-4 p-2 rounded-full text-xs font-semibold ${
          isSocketConnected ? 'bg-green-500' : 'bg-red-500'
        } text-white`}
      >
        {isSocketConnected ? 'ONLINE' : 'OFFLINE'}
      </div>

      <Helmet>
        <title>Emissão de Senha</title>
      </Helmet>

      <div className="p-8 bg-white rounded-xl shadow-2xl max-w-sm w-full relative z-10">
        <h1 className="text-3xl font-bold mb-4 text-blue-800 border-b pb-2 border-blue-200">
          Módulo de Emissão
        </h1>
        <p className="text-xl font-semibold mb-8 text-gray-700">
          Selecione o Tipo de Atendimento
        </p>

        <div className="flex flex-col gap-5">
          <button
            onClick={() => emitirSenha('normal')}
            disabled={aguardandoEmissao || !isSocketConnected}
            className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-xl shadow-lg transition transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {aguardandoEmissao ? 'Emitindo...' : 'ATENDIMENTO NORMAL'}
          </button>

          <button
            onClick={() => emitirSenha('prioritaria')}
            disabled={aguardandoEmissao || !isSocketConnected}
            className="w-full h-20 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl text-xl shadow-lg transition transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            PRIORITÁRIO
            <p className="text-xs mt-1 font-light">
              (Idosos, Gestantes, PCD, etc.)
            </p>
          </button>
        </div>

        {erroEmissao && (
          <p className="mt-6 text-red-600 font-bold">{erroEmissao}</p>
        )}
        {!isSocketConnected && (
          <p className="mt-6 text-red-600 font-bold">
            Conexão perdida. Verifique o Wi-Fi.
          </p>
        )}
      </div>

      <p className="mt-8 text-sm text-gray-400">
        Seu celular é o seu bilhete de chamada.
      </p>
    </div>
  );
}

export default UserApp;
