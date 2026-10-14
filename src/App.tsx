import React from 'react';
import { ConstructionSandbox } from './components/ConstructionSandbox/ConstructionSandbox';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0a0f1d] text-slate-100 font-sans">
      <ConstructionSandbox />
    </div>
  );
};

export default App;
