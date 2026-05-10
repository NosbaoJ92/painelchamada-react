import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 🔘 Botão reutilizável
const Button = ({ children, onClick, colorClass, disabled = false }) => {
  const defaultClasses =
    "w-full text-white font-bold py-3 px-4 rounded-xl transition duration-300 shadow-md";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${defaultClasses} ${
        disabled
          ? "bg-gray-400 cursor-not-allowed shadow-inner"
          : colorClass
      } hover:scale-[1.01]`}
    >
      {children}
    </button>
  );
};

// 🧩 Card para seções de configuração
const Card = ({ title, children, className = "" }) => (
  <div
    className={`p-4 bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}
  >
    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 text-center">
      {title}
    </h3>
    {children}
  </div>
);

// ⚙️ Toggle moderno com animação
const ConfigToggle = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition">
    <div className="flex flex-col">
      <span className="text-gray-800 font-semibold">{label}</span>
      <span className="text-xs text-gray-500 mt-1">{description}</span>
    </div>

    {/* Botão toggle moderno */}
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ease-in-out ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

// 🧠 Tela principal de configuração
const TelaConfiguracao = () => {
  const navigate = useNavigate();

  const [tempConfig, setTempConfig] = useState({
    showControls: true,
    showEmission: true,
    showQueue: true,
    showHistory: true,
  });

  // Estado do toggle geral
  const [allSelected, setAllSelected] = useState(true);

  // 🔄 Carregar configurações do localStorage ao abrir
  useEffect(() => {
    const savedConfig = localStorage.getItem("operadorConfig");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setTempConfig(parsed);
      // Atualiza o toggle geral conforme os valores salvos
      const allTrue = Object.values(parsed).every((v) => v === true);
      setAllSelected(allTrue);
    }
  }, []);

  // 🧩 Alternar configuração individual
  const handleToggle = (key) => {
    setTempConfig((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      const allTrue = Object.values(updated).every((v) => v === true);
      setAllSelected(allTrue);
      return updated;
    });
  };

  // 🟢 Toggle geral: marca ou desmarca todos
  const handleToggleAll = () => {
    const newValue = !allSelected;
    setAllSelected(newValue);
    setTempConfig({
      showControls: newValue,
      showEmission: newValue,
      showQueue: newValue,
      showHistory: newValue,
    });
  };

  // 💾 Salvar no localStorage e voltar ao operador
  const handleSave = async () => {
    localStorage.setItem("operadorConfig", JSON.stringify(tempConfig));
    alert("✅ Configurações salvas! Voltando ao módulo operador...");
    setTimeout(() => navigate("/operador"), 600);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      {/* Cabeçalho */}
      <header className="bg-blue-800 text-white flex justify-between items-center px-6 py-4 shadow-lg mb-8 rounded-xl">
        <h1 className="text-3xl font-extrabold">Configurações do Painel</h1>
        <Button
          onClick={() => navigate("/operador")}
          colorClass="bg-yellow-500 hover:bg-yellow-600 !w-auto !py-2 !px-4 !text-sm !shadow-none !font-medium"
        >
          Voltar
        </Button>
      </header>

      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto space-y-8">
        <Card title="Ajustes de Visualização do Operador" className="space-y-4">
          {/* Toggle geral */}
          <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-md border border-gray-200">
            <div className="flex flex-col">
              <span className="text-gray-800 font-semibold">
                Marcar / Desmarcar Todos
              </span>
              <span className="text-xs text-gray-500 mt-1">
                Ativa ou desativa todas as opções abaixo.
              </span>
            </div>

            {/* Toggle principal */}
            <button
              type="button"
              onClick={handleToggleAll}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ease-in-out ${
                allSelected ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                  allSelected ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Toggles individuais */}
          <ConfigToggle
            label="Controle de Chamadas"
            description="Exibe os botões 'Chamar Prioritária'/'Finalizar Atendimento'."
            checked={tempConfig.showControls}
            onChange={() => handleToggle("showControls")}
          />
          <ConfigToggle
            label="Emissão de Senha Física"
            description="Exibe botões para imprimir senhas (Normal e Prioritária)."
            checked={tempConfig.showEmission}
            onChange={() => handleToggle("showEmission")}
          />
          <ConfigToggle
            label="Visualização da Fila"
            description="Ativa a aba de visualização da fila atual."
            checked={tempConfig.showQueue}
            onChange={() => handleToggle("showQueue")}
          />
          <ConfigToggle
            label="Histórico de Chamadas"
            description="Ativa a aba de histórico de atendimentos."
            checked={tempConfig.showHistory}
            onChange={() => handleToggle("showHistory")}
          />
        </Card>

        <Button
          onClick={handleSave}
          colorClass="bg-blue-600 hover:bg-blue-700 !py-3"
        >
          SALVAR CONFIGURAÇÕES
        </Button>
      </div>
    </div>
  );
};

export default TelaConfiguracao;
