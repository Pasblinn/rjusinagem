import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2'

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-900',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 dark:border-slate-600',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-400',
    outline: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }

  const widthClass = fullWidth ? 'w-full' : ''

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
