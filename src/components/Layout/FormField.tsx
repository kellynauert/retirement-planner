interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, hint, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
}

export function Input({ prefix, suffix, className = '', ...props }: InputProps) {
  if (prefix || suffix) {
    return (
      <div className="flex rounded-lg overflow-hidden border border-gray-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
        {prefix && (
          <span className="flex items-center px-3 bg-gray-800 text-gray-400 text-sm border-r border-gray-700 select-none">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`flex-1 bg-gray-800 text-white px-3 py-2 text-sm outline-none min-w-0 ${className}`}
        />
        {suffix && (
          <span className="flex items-center px-3 bg-gray-800 text-gray-400 text-sm border-l border-gray-700 select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      {...props}
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export function Select({ options, className = '', ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
