/**
 * useCardUI Hook
 * Consolidates all UI state management for CaseCard component.
 */

import { useState, useCallback } from "react";

interface CardUIState {
  isHovered: boolean;
  hoverStartedFromButtons: boolean;
  isMenuOpen: boolean;
  isClicking: boolean;
  isTogglingFavorite: boolean;
  isTogglingPinned: boolean;
  isReopening: boolean;
}

interface CardUIActions {
  setHovered: (hovered: boolean) => void;
  setHoverStartedFromButtons: (started: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  triggerClickAnimation: () => void;
  setTogglingFavorite: (toggling: boolean) => void;
  setTogglingPinned: (toggling: boolean) => void;
  setReopening: (reopening: boolean) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleButtonAreaEnter: () => void;
  handleButtonAreaLeave: () => void;
}

type UseCardUIReturn = CardUIState & CardUIActions;

/**
 * Hook to manage all CaseCard UI states.
 * Consolidates 7 separate useState hooks into a single cohesive hook.
 */
export function useCardUI(): UseCardUIReturn {
  const [state, setState] = useState<CardUIState>({
    isHovered: false,
    hoverStartedFromButtons: false,
    isMenuOpen: false,
    isClicking: false,
    isTogglingFavorite: false,
    isTogglingPinned: false,
    isReopening: false,
  });

  const setHovered = useCallback((hovered: boolean) => {
    setState((prev) => ({ ...prev, isHovered: hovered }));
  }, []);

  const setHoverStartedFromButtons = useCallback((started: boolean) => {
    setState((prev) => ({ ...prev, hoverStartedFromButtons: started }));
  }, []);

  const setMenuOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isMenuOpen: open }));
  }, []);

  const triggerClickAnimation = useCallback(() => {
    setState((prev) => ({ ...prev, isClicking: true }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, isClicking: false }));
    }, 150);
  }, []);

  const setTogglingFavorite = useCallback((toggling: boolean) => {
    setState((prev) => ({ ...prev, isTogglingFavorite: toggling }));
  }, []);

  const setTogglingPinned = useCallback((toggling: boolean) => {
    setState((prev) => ({ ...prev, isTogglingPinned: toggling }));
  }, []);

  const setReopening = useCallback((reopening: boolean) => {
    setState((prev) => ({ ...prev, isReopening: reopening }));
  }, []);

  const handleMouseEnter = useCallback(() => {
    setState((prev) => {
      if (prev.hoverStartedFromButtons) return prev;
      return { ...prev, isHovered: true };
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setState((prev) => {
      if (prev.isMenuOpen) return prev;
      return { ...prev, isHovered: false, hoverStartedFromButtons: false };
    });
  }, []);

  const handleButtonAreaEnter = useCallback(() => {
    setState((prev) => ({ ...prev, hoverStartedFromButtons: true }));
  }, []);

  const handleButtonAreaLeave = useCallback(() => {
    setState((prev) => ({ ...prev, hoverStartedFromButtons: false }));
  }, []);

  return {
    ...state,
    setHovered,
    setHoverStartedFromButtons,
    setMenuOpen,
    triggerClickAnimation,
    setTogglingFavorite,
    setTogglingPinned,
    setReopening,
    handleMouseEnter,
    handleMouseLeave,
    handleButtonAreaEnter,
    handleButtonAreaLeave,
  };
}
