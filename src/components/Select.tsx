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
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <select
        className={`px-3 py-2 text-sm border rounded-md transition-colors
          bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-neutral-700'}
          focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400
          disabled:bg-gray-50 dark:disabled:bg-neutral-800 disabled:cursor-not-allowed disabled:text-gray-500
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
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>
      )}
    </div>
  )
}
