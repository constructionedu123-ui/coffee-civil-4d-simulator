import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  FileCheck,
  Scale,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { StructuralElement, InspectionCheckItem } from './types';
import { fireRfiApprovedConfetti } from '../../utils/confetti';

interface ElementDrawerProps {
  element: StructuralElement | null;
  onClose: () => void;
  onSelectPrev?: () => void;
  onSelectNext?: () => void;
  currentWeek: number;
}

export const ElementDrawer: React.FC<ElementDrawerProps> = ({
  element,
  onClose,
  onSelectPrev,
  onSelectNext,
  currentWeek,
}) => {
  if (!element) return null;

  // Local checklist state so user can interactively toggle check items
  const [checklist, setChecklist] = useState<InspectionCheckItem[]>(element.rfi.checkItems);
  const [isApproved, setIsApproved] = useState<boolean>(element.rfi.status === 'APPROVED');

  useEffect(() => {
    setChecklist(element.rfi.checkItems);
    setIsApproved(element.rfi.status === 'APPROVED');
  }, [element.id]);

  // Status at current timeline week
  const getStatus = () => {
    if (currentWeek < element.startWeek) return { label: 'SCHEDULED', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    if (currentWeek < element.endWeek) return { label: 'UNDER ACTIVE POUR', color: 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse' };
    return { label: 'COMPLETED & CURED', color: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
  };

  const status = getStatus();

  const handleToggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] bg-[#0b1120]/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col text-slate-200 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-mono font-bold text-xs">
            {element.pierId}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sky-400 text-xs">{element.id}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>
                {status.label}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5">{element.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onSelectPrev && (
            <button
              onClick={onSelectPrev}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Previous Element"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {onSelectNext && (
            <button
              onClick={onSelectNext}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Next Element"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition ml-1"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* Timeline Phasing Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Construction Phasing Window:</span>
            </span>
            <span className="font-mono font-bold text-white">
              Week {element.startWeek} — Week {element.endWeek}
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                currentWeek >= element.endWeek
                  ? 'bg-emerald-500 w-full'
                  : currentWeek >= element.startWeek
                  ? 'bg-amber-500 w-2/3 animate-pulse'
                  : 'bg-slate-800 w-0'
              }`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Mobilization</span>
            <span>Pouring / Curing</span>
            <span>Structural Handover</span>
          </div>
        </div>

        {/* Concrete Specification Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Concrete & Material Specification</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Compressive Strength</span>
              <div className="text-xs font-mono font-bold text-sky-300 mt-0.5">
                {element.concreteSpec.grade}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Slump Tolerance</span>
              <div className="text-xs font-mono font-bold text-white mt-0.5">
                {element.concreteSpec.slump}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Max Coarse Aggregate</span>
              <div className="text-xs font-mono font-bold text-white mt-0.5">
                {element.concreteSpec.maxAggregate}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Water-Cement Ratio (w/c)</span>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {element.concreteSpec.wcRatio || 0.40}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400">Cement Binder Classification</span>
            <div className="text-xs font-semibold text-slate-200 mt-0.5">
              {element.concreteSpec.cementType}
            </div>
          </div>
        </div>

        {/* Volume & Reinforcement Weights */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Material Take-Off Quantities</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Volume</span>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {element.volumeM3} <span className="text-[10px] text-slate-400">m³</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Steel Rebar</span>
              <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
                {(element.steelKg / 1000).toFixed(1)} <span className="text-[10px] text-slate-400">Ton</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400">Formwork</span>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {element.formworkM2} <span className="text-[10px] text-slate-400">m²</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2 text-[10px] text-slate-400 flex justify-between">
            <span>Reinforcement Ratio:</span>
            <span className="font-mono text-slate-200 font-semibold">
              {(element.steelKg / (element.volumeM3 || 1)).toFixed(1)} kg / m³
            </span>
          </div>
        </div>

        {/* Quality Inspection Checksheet (RFI Approval Status) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RFI Quality Checksheet</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {element.rfi.status}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            {/* RFI Meta details */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px]">RFI Document No:</span>
                <div className="font-mono font-bold text-sky-400">{element.rfi.number}</div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px]">Inspection Date:</span>
                <div className="font-mono text-slate-300">{element.rfi.date}</div>
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pre-Pour Inspection Items:
              </span>
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleCheck(item.id)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/20"
                    />
                    <span
                      className={`text-[11px] leading-relaxed select-none ${
                        item.checked ? 'text-slate-300' : 'text-slate-500 line-through'
                      }`}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Formal Engineering Sign-Offs */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium text-slate-300">Contractor QC:</span>
                <span className="text-slate-400 truncate">{element.rfi.leadQc}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-medium text-slate-300">Supervising Consultant:</span>
                <span className="text-slate-400 truncate">{element.rfi.consultant}</span>
              </div>
            </div>

            {/* QA/QC Sign-Off & Pour Permit Action */}
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setChecklist((prev) => prev.map((item) => ({ ...item, checked: true })));
                  setIsApproved(true);
                  fireRfiApprovedConfetti();
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg ${
                  isApproved
                    ? 'bg-emerald-600/90 text-white shadow-emerald-600/20 hover:bg-emerald-500'
                    : 'bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 shadow-sky-500/20'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isApproved ? 'RFI Signed & Pour Permit Issued ✓' : 'Sign Off RFI & Issue Pour Permit'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
