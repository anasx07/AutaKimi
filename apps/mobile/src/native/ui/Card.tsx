import React from 'react'
import { View, ViewProps } from 'react-native'
interface CardProps extends ViewProps {
  className?: string
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => {
  return (
    <View
      className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </View>
  )
}

export const CardHeader: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <View className={`p-4 border-b border-border ${className}`} {...props}>
    {children}
  </View>
)

export const CardContent: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <View className={`p-4 ${className}`} {...props}>
    {children}
  </View>
)

export const CardFooter: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <View className={`p-4 border-t border-border ${className}`} {...props}>
    {children}
  </View>
)
