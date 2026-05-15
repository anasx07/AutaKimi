import React from 'react'
import { View, ViewProps } from 'react-native'
import { styled } from 'nativewind'

const StyledView = styled(View)

interface CardProps extends ViewProps {
  className?: string
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => {
  return (
    <StyledView
      className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </StyledView>
  )
}

export const CardHeader: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <StyledView className={`p-4 border-b border-border ${className}`} {...props}>
    {children}
  </StyledView>
)

export const CardContent: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <StyledView className={`p-4 ${className}`} {...props}>
    {children}
  </StyledView>
)

export const CardFooter: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <StyledView className={`p-4 border-t border-border ${className}`} {...props}>
    {children}
  </StyledView>
)
