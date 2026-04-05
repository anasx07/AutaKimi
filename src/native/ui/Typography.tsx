import React from 'react'
import { Text, TextProps } from 'react-native'
import { styled } from 'nativewind'

const StyledText = styled(Text)

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
    h1: 'text-3xl font-bold',
    h2: 'text-2xl font-semibold',
    h3: 'text-xl font-medium',
    body: 'text-base',
    small: 'text-sm',
    muted: 'text-sm text-muted-foreground'
  }

  return (
    <StyledText className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </StyledText>
  )
}
