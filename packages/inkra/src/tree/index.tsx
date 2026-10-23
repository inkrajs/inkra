import {
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
} from 'react-aria-components/Tree';
import type {
  Key,
  Selection,
  TreeItemProps as AriaTreeItemProps,
  TreeProps as AriaTreeProps,
} from 'react-aria-components/Tree';
import { Button as AriaButton } from 'react-aria-components/Button';
import { forwardRef } from 'react';
import type { CSSProperties, ForwardedRef, HTMLAttributes, ReactElement, ReactNode, RefAttributes } from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

const chevronIcon = [{ d: 'M 7 10 L 12 15 L 17 10' }] as const;

export type TreeKey = Key;
export type TreeSelection = Selection;

export type TreeRootProps<T extends object = object> = Omit<AriaTreeProps<T>, 'className' | 'style' | 'renderEmptyState'> & {
  className?: string;
  style?: CSSProperties;
  emptyState?: ReactNode;
  /** Indentation per level in CSS pixels. Nonfinite values use 24. */
  indent?: number;
  size?: 'sm' | 'md' | 'lg';
};

function TreeRootInner<T extends object>({
  className,
  style,
  indent = 24,
  size = 'md',
  emptyState = 'No items',
  selectionMode = 'single',
  selectionBehavior = 'toggle',
  ...props
}: TreeRootProps<T>, ref: ForwardedRef<HTMLDivElement>) {
  return <AriaTree
    {...props}
    ref={ref}
    className={['inkra-tree', className].filter(Boolean).join(' ')}
    data-size={size}
    style={{ '--inkra-tree-indent': `${Number.isFinite(indent) ? Math.max(0, indent) : 24}px`, ...style } as CSSProperties}
    selectionMode={selectionMode}
    selectionBehavior={selectionBehavior}
    renderEmptyState={() => <div className="inkra-tree__empty">{emptyState}</div>}
  />;
}

const TreeRoot = forwardRef(TreeRootInner) as <T extends object = object>(props: TreeRootProps<T> & RefAttributes<HTMLDivElement>) => ReactElement | null;

export type TreeItemProps<T = object> = Omit<AriaTreeItemProps<T>, 'className'> & { className?: string };

const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(function TreeItem({ className, ...props }, ref) {
  return <AriaTreeItem {...props} ref={ref} className={['inkra-tree__item', className].filter(Boolean).join(' ')} />;
});

export interface TreeItemContentState {
  level: number;
  isExpanded: boolean;
  hasChildItems: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

export interface TreeItemContentProps {
  children: ReactNode | ((state: TreeItemContentState) => ReactNode);
  className?: string;
  icon?: ReactNode | ((state: TreeItemContentState) => ReactNode);
  disclosureIcon?: ReactNode | ((state: TreeItemContentState) => ReactNode);
  expandLabel?: string;
  collapseLabel?: string;
}

const TreeItemContent = forwardRef<Element, TreeItemContentProps>(function TreeItemContent({
  children,
  className,
  icon,
  disclosureIcon,
  expandLabel = 'Expand item',
  collapseLabel = 'Collapse item',
}, ref) {
  return <AriaTreeItemContent ref={ref}>{({
    hasChildItems,
    isExpanded,
    isSelected,
    isFocusVisible,
    isDisabled,
    level,
    id,
  }) => {
    const state = { isExpanded, hasChildItems, isSelected, isDisabled, level };
    const resolvedIcon = typeof icon === 'function' ? icon(state) : icon;
    const resolvedDisclosure = typeof disclosureIcon === 'function' ? disclosureIcon(state) : disclosureIcon;
    return <div
      className={['inkra-tree__item-content', className].filter(Boolean).join(' ')}
      data-expanded={isExpanded || undefined}
      data-selected={isSelected || undefined}
      data-disabled={isDisabled || undefined}
      data-has-icon={resolvedIcon != null || undefined}
      style={{ '--inkra-tree-level': level } as CSSProperties}
    >
      {isSelected && <PencilSurface aria-hidden="true" as="span" className="inkra-tree__selection" variant="selection" seed={`tree-${String(id)}-selection`} />}
      {isFocusVisible && <PencilSurface aria-hidden="true" as="span" className="inkra-tree__focus" variant="outline" seed={`tree-${String(id)}-focus`} />}
      {hasChildItems ? <AriaButton slot="chevron" className="inkra-tree__disclosure" aria-label={isExpanded ? collapseLabel : expandLabel}>
        {({ isFocusVisible: disclosureFocused }) => <>
          {disclosureFocused && <PencilSurface as="span" aria-hidden="true" className="inkra-tree__disclosure-focus" variant="outline" />}
          <span className="inkra-tree__disclosure-icon" aria-hidden="true">
            {disclosureIcon === undefined ? <PencilIcon className="inkra-tree__chevron" paths={chevronIcon} size={18} sourceSize={24} /> : resolvedDisclosure}
          </span>
        </>}
      </AriaButton> : <span className="inkra-tree__disclosure-spacer" aria-hidden="true" />}
      {resolvedIcon != null && <span className="inkra-tree__icon" aria-hidden="true">{resolvedIcon}</span>}
      <span className="inkra-tree__copy">{typeof children === 'function' ? children(state) : children}</span>
    </div>;
  }}</AriaTreeItemContent>;
});

export interface TreeItemTitleProps extends HTMLAttributes<HTMLSpanElement> {}
const TreeItemTitle = forwardRef<HTMLSpanElement, TreeItemTitleProps>(function TreeItemTitle({ className, children, ...props }, ref) {
  return <span {...props} ref={ref} className={['inkra-tree__title', className].filter(Boolean).join(' ')}>{typeof children === 'string' ? <PencilText>{children}</PencilText> : children}</span>;
});

export interface TreeItemDescriptionProps extends HTMLAttributes<HTMLSpanElement> {}
const TreeItemDescription = forwardRef<HTMLSpanElement, TreeItemDescriptionProps>(function TreeItemDescription({ className, children, ...props }, ref) {
  return <span {...props} ref={ref} className={['inkra-tree__description', className].filter(Boolean).join(' ')}>{children}</span>;
});

export const Tree = {
  Root: TreeRoot,
  Item: TreeItem,
  ItemContent: TreeItemContent,
  ItemTitle: TreeItemTitle,
  ItemDescription: TreeItemDescription,
};
