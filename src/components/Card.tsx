import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export function Card({ children, className = '', padding = 'md', onClick }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const clickableClass = onClick ? 'cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700' : ''

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-lg shadow-sm dark:shadow-none border border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-neutral-100 transition-colors ${paddingClasses[padding]} ${clickableClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
