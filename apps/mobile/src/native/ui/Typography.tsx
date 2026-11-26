import React from 'react'
import { Text, TextProps } from 'react-native'
interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'muted'
  className?: string
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'text-foreground'
  const variants = {
    h1: 'text-2xl font-bold tracking-tight',
    h2: 'text-xl font-semibold tracking-tight',
    h3: 'text-base font-semibold',
    body: 'text-sm',
    small: 'text-xs',
    muted: 'text-xs text-muted-foreground'
  }

  return (
    <Text className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Text>
  )
}
