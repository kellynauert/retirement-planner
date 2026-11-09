interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, subtitle, children, className = '', noPadding }: CardProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-800">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'blue' | 'amber' | 'red' | 'indigo';
}

const accentColors = {
  green: 'text-emerald-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  indigo: 'text-indigo-400',
};

export function StatCard({ label, value, sub, accent = 'indigo' }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accentColors[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
