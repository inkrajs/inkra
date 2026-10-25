import { useInkraLocale } from '../i18n/index.js';
import {
  Group as ResizableGroupPrimitive,
  Panel as ResizablePanelPrimitive,
  Separator as ResizableSeparatorPrimitive,
  useGroupCallbackRef,
  useGroupRef,
  usePanelCallbackRef,
  usePanelRef,
} from 'react-resizable-panels';
import { useCallback, useReducer } from 'react';
import type { Ref } from 'react';
import type {
  GroupImperativeHandle,
  GroupProps,
  Layout,
  LayoutChangedMeta,
  PanelImperativeHandle,
  PanelProps,
  SeparatorProps,
} from 'react-resizable-panels';

import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';

const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function layoutsEqual(current: Layout, requested: Layout) {
  const currentIds = Object.keys(current);
  const requestedIds = Object.keys(requested);
  return currentIds.length === requestedIds.length
    && requestedIds.every((id) => Math.abs((current[id] ?? -1) - requested[id]) < 0.001);
}

export type ResizableOrientation = 'horizontal' | 'vertical';
export type ResizableLayout = Layout;
export type ResizableLayoutChangeMeta = LayoutChangedMeta;
export type ResizableRootRef = GroupImperativeHandle;
export type ResizablePanelRef = PanelImperativeHandle;

export interface ResizableRootProps extends Omit<
  GroupProps,
  'defaultLayout' | 'elementRef' | 'groupRef' | 'onLayoutChange' | 'onLayoutChanged' | 'orientation' | 'resizeTargetMinimumSize'
> {
  orientation?: ResizableOrientation;
  layout?: ResizableLayout;
  defaultLayout?: ResizableLayout;
  onLayoutChange?: (layout: ResizableLayout) => void;
  onLayoutCommit?: (layout: ResizableLayout, meta: ResizableLayoutChangeMeta) => void;
  rootRef?: Ref<HTMLDivElement>;
  apiRef?: Ref<ResizableRootRef>;
  resizeTargetMinimumSize?: GroupProps['resizeTargetMinimumSize'];
}

function ResizableRoot({
  apiRef,
  className,
  defaultLayout,
  layout,
  onLayoutChange,
  onLayoutCommit,
  orientation = 'horizontal',
  resizeTargetMinimumSize = { coarse: 44, fine: 12 },
  rootRef,
  ...props
}: ResizableRootProps) {
  const [group, setGroup] = useGroupCallbackRef();
  const [layoutRevision, refreshControlledLayout] = useReducer((value: number) => value + 1, 0);
  const setApiRef = useCallback((value: ResizableRootRef | null) => {
    setGroup(value);
    assignRef(apiRef, value);
  }, [apiRef, setGroup]);
  const handleLayoutChange = useCallback((nextLayout: ResizableLayout) => {
    onLayoutChange?.(nextLayout);
    if (layout !== undefined) refreshControlledLayout();
  }, [layout, onLayoutChange]);

  useBrowserLayoutEffect(() => {
    if (!group || layout === undefined || layoutsEqual(group.getLayout(), layout)) return;
    group.setLayout(layout);
  }, [group, layout, layoutRevision]);

  return <ResizableGroupPrimitive
    {...props}
    className={classes('inkra-resizable', className)}
    data-orientation={orientation}
    defaultLayout={layout ?? defaultLayout}
    elementRef={rootRef}
    groupRef={setApiRef}
    onLayoutChange={handleLayoutChange}
    onLayoutChanged={onLayoutCommit}
    orientation={orientation}
    resizeTargetMinimumSize={resizeTargetMinimumSize}
  />;
}

export type ResizablePanelProps = PanelProps;

function ResizablePanel({ className, ...props }: ResizablePanelProps) {
  return <ResizablePanelPrimitive {...props} className={classes('inkra-resizable__panel', className)} />;
}

export interface ResizableHandleProps extends SeparatorProps {
  label?: string;
  lineSeed?: string | number;
}

function ResizableHandle(inkraProps: ResizableHandleProps) {
  const { t } = useInkraLocale();
  const {
  'aria-label': ariaLabel,
  children,
  className,
  label = t('resizable.label'),
  lineSeed = 'inkra-resizable-handle',
  ...props
} = inkraProps;
  return <ResizableSeparatorPrimitive
    {...props}
    aria-label={ariaLabel ?? label}
    className={classes('inkra-resizable__handle', className)}
  >
    <PencilSurface
      aria-hidden="true"
      as="span"
      className="inkra-resizable__handle-focus"
      seed={`${lineSeed}-focus`}
      variant="outline"
    />
    <span aria-hidden="true" className="inkra-resizable__handle-mark">
      <PencilLine
        className="inkra-resizable__handle-line inkra-resizable__handle-line--horizontal"
        seed={`${lineSeed}-horizontal`}
      />
      <PencilLine
        className="inkra-resizable__handle-line inkra-resizable__handle-line--vertical"
        orientation="vertical"
        seed={`${lineSeed}-vertical`}
      />
      {children}
    </span>
  </ResizableSeparatorPrimitive>;
}

export const Resizable = /* @__PURE__ */ Object.freeze({
  Root: ResizableRoot,
  Panel: ResizablePanel,
  Handle: ResizableHandle,
});

export {
  useGroupCallbackRef as useResizableRootCallbackRef,
  useGroupRef as useResizableRootRef,
  usePanelCallbackRef as useResizablePanelCallbackRef,
  usePanelRef as useResizablePanelRef,
};
