import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const AssistantContext = createContext(null);

export function AssistantProvider({ children }) {
  const [screenContext, setScreenContext] = useState({
    currentSection: "dashboard",
    pageTitle: "Dashboard",
    activeFilters: null,
    selectedComplaint: null,
    visibleComplaints: [],
    formState: null,
    interactiveElements: [],
    availableActions: [],
  });

  const actionHandlersRef = useRef(new Map());

  const registerAction = useCallback((type, handler) => {
    actionHandlersRef.current.set(type, handler);
    return () => {
      actionHandlersRef.current.delete(type);
    };
  }, []);

  const executeAction = useCallback((action) => {
    if (!action || !action.type) return false;
    let handled = false;
    const handler = actionHandlersRef.current.get(action.type);
    if (typeof handler === "function") {
      try {
        handler(action.params || {});
        handled = true;
      } catch (err) {
        console.error(`Failed to execute registered handler for "${action.type}":`, err);
      }
    }

    const detail = action.params || {};

    // Standard normalized custom event names for legacy and component listeners
    if (action.type === "filter") {
      window.dispatchEvent(new CustomEvent("fixflow:set-filters", { detail }));
    } else if (action.type === "clearFilters") {
      window.dispatchEvent(new CustomEvent("fixflow:clear-filters"));
    } else if (action.type === "openComplaint") {
      window.dispatchEvent(new CustomEvent("fixflow:open-complaint", { detail }));
    } else if (action.type === "fillForm") {
      window.dispatchEvent(new CustomEvent("fixflow:fill-complaint-form", { detail }));
    } else if (action.type === "openForm") {
      window.dispatchEvent(new CustomEvent("fixflow:open-form", { detail }));
    } else if (action.type === "switchTab" || action.type === "switchQueue") {
      window.dispatchEvent(new CustomEvent("fixflow:switch-tab", { detail }));
    } else if (action.type === "selectBuilding") {
      window.dispatchEvent(new CustomEvent("fixflow:select-building", { detail }));
    } else if (action.type === "selectFloor") {
      window.dispatchEvent(new CustomEvent("fixflow:select-floor", { detail }));
    } else if (action.type === "updateStatus") {
      window.dispatchEvent(new CustomEvent("fixflow:update-status", { detail }));
    } else if (action.type === "exportReport") {
      window.dispatchEvent(new CustomEvent("fixflow:export-report", { detail }));
    }

    // Generic kebab-cased event and universal event
    const kebabName = `fixflow:${action.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
    window.dispatchEvent(new CustomEvent(kebabName, { detail }));
    window.dispatchEvent(new CustomEvent("fixflow:action", { detail: action }));

    return handled;
  }, []);

  const dispatchAction = useCallback(
    (action) => executeAction(action),
    [executeAction],
  );

  const dispatchActions = useCallback(
    async (actions) => {
      if (!Array.isArray(actions) || actions.length === 0) return;
      for (let i = 0; i < actions.length; i++) {
        executeAction(actions[i]);
        if (i < actions.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    },
    [executeAction],
  );

  const value = useMemo(
    () => ({
      screenContext,
      setScreenContext,
      registerAction,
      dispatchAction,
      dispatchActions,
    }),
    [screenContext, registerAction, dispatchAction, dispatchActions],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAssistantContext() {
  const context = useContext(AssistantContext);
  if (!context) {
    return {
      screenContext: { currentSection: "dashboard" },
      setScreenContext: () => {},
      registerAction: () => () => {},
      dispatchAction: () => false,
      dispatchActions: async () => {},
    };
  }
  return context;
}
