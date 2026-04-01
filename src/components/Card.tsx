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
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  const clickableClass = onClick ? 'cursor-pointer' : ''

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border border-gray-200 ${paddingClasses[padding]} ${clickableClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
