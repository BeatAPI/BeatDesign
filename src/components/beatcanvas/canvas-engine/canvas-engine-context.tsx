import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import type { BeatCanvasEditor } from '../react-flow/beatcanvas-react-flow-types';

type CanvasEngineContextValue = {
  editor: BeatCanvasEditor;
  revision: number;
};

const CanvasEngineContext = createContext<CanvasEngineContextValue | null>(
  null
);

export function CanvasEngineProvider({
  editor,
  revision,
  children,
}: {
  editor: BeatCanvasEditor;
  revision: number;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ editor, revision }),
    [editor, revision]
  );

  return (
    <CanvasEngineContext.Provider value={value}>
      {children}
    </CanvasEngineContext.Provider>
  );
}

export function useCanvasEngine() {
  const context = useContext(CanvasEngineContext);
  if (!context) {
    throw new Error('CanvasEngineProvider is missing.');
  }
  return context;
}

export function useCanvasEngineValue<T>(
  selector: (editor: BeatCanvasEditor) => T,
  dependencies: readonly unknown[] = []
) {
  const { editor, revision } = useCanvasEngine();
  // The editor exposes an imperative compatibility surface while React Flow is
  // controlled by React state. `revision` invalidates derived overlay values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => selector(editor), [editor, revision, ...dependencies]);
}
