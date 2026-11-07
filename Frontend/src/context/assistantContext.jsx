import { createContext, useContext, useMemo, useRef, useState } from "react";

const AssistantContext = createContext(null);

export function AssistantProvider({ children }) {
  const [screenContext, setScreenContext] = useState({
    currentSection: "dashboard",
    activeFilters: null,
    selectedComplaint: null,
    availableActions: [],
  });

  const actionHandlersRef = useRef(new Map());

  function registerAction(type, handler) {
    actionHandlersRef.current.set(type, handler);
    return () => {
      actionHandlersRef.current.delete(type);
    };
  }

  function dispatchAction(action) {
    if (!action || !action.type) return false;
    const handler = actionHandlersRef.current.get(action.type);
    if (typeof handler === "function") {
      try {
        handler(action.params || {});
        return true;
      } catch (err) {
        console.error(`Failed to execute assistant action "${action.type}":`, err);
        return false;
      }
    }
    return false;
  }

  const value = useMemo(
    () => ({
      screenContext,
      setScreenContext,
      registerAction,
      dispatchAction,
    }),
    [screenContext],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  const context = useContext(AssistantContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      screenContext: { currentSection: "dashboard" },
      setScreenContext: () => {},
      registerAction: () => () => {},
      dispatchAction: () => false,
    };
  }
  return context;
}
