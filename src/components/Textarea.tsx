import React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  fullWidth?: boolean
}

export function Textarea({
  label,
  error,
  fullWidth = true,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <textarea
        className={`px-4 py-3 text-base border-2 rounded-lg transition-all min-h-[100px]
          bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100
          placeholder-gray-400 dark:placeholder-slate-500
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-slate-700'}
          focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:border-sky-400 dark:focus:ring-sky-400/30
          disabled:bg-gray-100 dark:disabled:bg-slate-900 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
      )}
    </div>
  )
}
