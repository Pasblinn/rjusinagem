import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  fullWidth?: boolean
  options: { value: string; label: string }[]
}

export function Select({
  label,
  error,
  fullWidth = true,
  options,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <select
        className={`px-4 py-3 text-base border-2 rounded-lg transition-all
          ${error ? 'border-red-500' : 'border-gray-300'}
          focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-sm text-red-600 font-medium">{error}</span>
      )}
    </div>
  )
}
