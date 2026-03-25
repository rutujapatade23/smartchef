import React from 'react';

interface NutritionCardProps {
  label: string;
  value: string | number;
  unit: string;
  color: string;
}

const NutritionCard: React.FC<NutritionCardProps> = ({ label, value, unit, color }) => {
  return (
    <div className={`p-4 rounded-2xl border border-ink/5 bg-white shadow-sm flex flex-col items-center justify-center text-center`}>
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 mb-1">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-2xl font-bold`} style={{ color }}>{value}</span>
        <span className="text-xs font-medium text-ink/60">{unit}</span>
      </div>
    </div>
  );
};

export default NutritionCard;
