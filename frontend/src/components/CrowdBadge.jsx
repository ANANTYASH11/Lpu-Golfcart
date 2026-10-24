import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';

export default function CrowdBadge({ level, passengerCount, capacity }) {
  const normLevel = (level || 'LOW').toUpperCase();

  let bgClasses = 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30';
  let dotColor = 'bg-emerald-400';
  let label = 'Low Crowd';

  if (normLevel === 'MODERATE') {
    bgClasses = 'bg-amber-950/70 text-amber-300 border-amber-500/30';
    dotColor = 'bg-amber-400';
    label = 'Moderate';
  } else if (normLevel === 'FULL') {
    bgClasses = 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse';
    dotColor = 'bg-rose-400';
    label = 'Full (Near Capacity)';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bgClasses}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {normLevel === 'FULL' ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Users className="w-3.5 h-3.5" />}
      <span>{label}</span>
      {passengerCount !== undefined && capacity !== undefined && (
        <span className="text-[10px] opacity-75 font-mono ml-0.5">({passengerCount}/{capacity})</span>
      )}
    </div>
  );
}
