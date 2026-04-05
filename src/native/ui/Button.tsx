import React from 'react'
import { TouchableOpacity, ActivityIndicator, View } from 'react-native'
import { styled } from 'nativewind'
import { Typography } from './Typography'

const StyledTouchableOpacity = styled(TouchableOpacity)

interface ButtonProps {
  onPress: () => void
  title: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  className?: string
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = ''
}) => {
  const baseClasses = 'flex-row items-center justify-center rounded-lg px-4 py-2'
  const variants = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border bg-transparent',
    ghost: 'bg-transparent',
    destructive: 'bg-destructive text-destructive-foreground'
  }

  const sizes = {
    sm: 'px-3 py-1',
    md: 'px-4 py-2',
    lg: 'px-6 py-3'
  }

  const textVariants = {
    primary: 'text-primary-foreground font-semibold',
    secondary: 'text-secondary-foreground font-semibold',
    outline: 'text-foreground font-medium',
    ghost: 'text-foreground font-medium',
    destructive: 'text-destructive-foreground font-semibold'
  }

  return (
    <StyledTouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#000' : '#fff'} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Typography className={textVariants[variant]}>{title}</Typography>
        </>
      )}
    </StyledTouchableOpacity>
  )
}
