import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export interface ThemeColors {
    isDark: boolean;
    surface: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    surfaceVariant: string;
    onSurface: string;
    onSurfaceVariant: string;
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    secondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    tertiary: string;
    error: string;
    errorContainer: string;
    outline: string;
    outlineVariant: string;
    cardBorder: string;
}

export const DarkTheme: ThemeColors = {
    isDark: true,
    surface: '#000000',                  // Apple OLED Black
    surfaceContainerLowest: '#0A0A0C',
    surfaceContainerLow: '#121215',
    surfaceContainer: '#1C1C1E',          // Apple System Gray 6 (Dark)
    surfaceContainerHigh: '#2C2C2E',      // Apple System Gray 5 (Dark)
    surfaceContainerHighest: '#3A3A3C',   // Apple System Gray 4 (Dark)
    surfaceVariant: '#2C2C2E',
    onSurface: '#FFFFFF',                 // White
    onSurfaceVariant: '#8E8E93',          // Apple SF Secondary
    primary: '#0A84FF',                   // Apple Electric Blue
    onPrimary: '#FFFFFF',
    primaryContainer: '#30D158',          // Apple Mint Green
    secondary: '#5E5CE6',                 // Apple Indigo
    secondaryContainer: '#1C1C1E',
    onSecondaryContainer: '#0A84FF',
    tertiary: '#98989D',
    error: '#FF453A',                     // Apple System Red
    errorContainer: '#3A0D0B',
    outline: '#38383A',
    outlineVariant: '#2C2C2E',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
};

export const LightTheme: ThemeColors = {
    isDark: false,
    surface: '#F2F2F7',                  // Apple iOS Light Background
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#FFFFFF',
    surfaceContainer: '#FFFFFF',          // Pure White card
    surfaceContainerHigh: '#E5E5EA',      // Apple System Gray 5 (Light)
    surfaceContainerHighest: '#D1D1D6',   // Apple System Gray 4 (Light)
    surfaceVariant: '#E5E5EA',
    onSurface: '#000000',                 // Deep Black
    onSurfaceVariant: '#6C6C70',          // Apple SF Secondary (Light)
    primary: '#007AFF',                   // Apple iOS Vibrant Blue
    onPrimary: '#FFFFFF',
    primaryContainer: '#34C759',          // Apple Mint Green (Light)
    secondary: '#5856D6',                 // Apple Indigo
    secondaryContainer: '#E5E5EA',
    onSecondaryContainer: '#007AFF',
    tertiary: '#8E8E93',
    error: '#FF3B30',                     // Apple System Red (Light)
    errorContainer: '#FFD8D6',
    outline: '#C6C6C8',
    outlineVariant: '#E5E5EA',
    cardBorder: 'rgba(0, 0, 0, 0.06)',
};

export const ThemeContext = createContext<ThemeColors>(DarkTheme);

export const useTheme = () => useContext(ThemeContext);
