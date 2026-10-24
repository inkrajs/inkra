import { Combobox } from '@base-ui/react/combobox';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button.js';
import { Input } from '../form/Input.js';
import { InputAction } from '../form/InputAction.js';
import { mergeAriaIds, useFieldContext } from '../form/context.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PortalThemeBridge, PortalThemeProvider, usePortalTriggerRef } from '../overlay/themeBridge.js';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string;
}

interface SearchableSelectCommonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange' | 'dir'> {
  items: readonly SearchableSelectOption[];
  searchPlacement?: 'trigger' | 'popup';
  placeholder?: string;
  searchPlaceholder?: string;
  emptyContent?: ReactNode;
  clearable?: boolean;
  clearLabel?: string;
  openLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
  form?: string;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  collisionPadding?: number;
}

export type SearchableSelectProps = SearchableSelectCommonProps & (
  | { multiple?: false; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string | null) => void }
  | { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
);

const searchPaths = [{ d: 'M21 21l-4.5-4.5' }, { d: 'M18 10a8 8 0 1 1-16 0a8 8 0 1 1 16 0' }];
const chevronPaths = [{ d: 'M6 9l6 6 6-6' }];
const checkPaths = [{ d: 'M5 12l4 4L19 6' }];
const clearPaths = [{ d: 'M6 6l12 12M18 6L6 18' }];

const SearchableControl = forwardRef<HTMLDivElement, SearchableSelectProps>(function SearchableControl(props, forwardedRef) {
  const {
    items, searchPlacement = 'trigger', placeholder = 'Select an option', searchPlaceholder = 'Search options',
    emptyContent = 'No matching options', clearable = true, clearLabel = 'Clear selection', openLabel = 'Show options',
    size = 'md', multiple = false, value, defaultValue, onValueChange: _onValueChange,
    name, form, dir, disabled, readOnly, required, invalid, id, className, children: _children,
    open, defaultOpen, onOpenChange, side = 'bottom', align = 'start', sideOffset = 8, collisionPadding = 8,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
    ...rest
  } = props;
  const indicatorSize = size === 'sm' ? 24 : size === 'lg' ? 32 : 28;
  const actionSize = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon';
  const field = useFieldContext();
  const generatedId = useId();
  const controlId = field?.controlId ?? id ?? generatedId;
  const resolvedDisabled = Boolean(disabled || field?.disabled);
  const resolvedReadOnly = Boolean(readOnly || field?.readOnly);
  const resolvedInvalid = Boolean(invalid || field?.invalid);
  const describedBy = mergeAriaIds(ariaDescribedBy, field?.descriptionId, field?.errorId);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultValueRef = useRef(defaultValue);
  const actionsRef = useRef<Combobox.Root.Actions | null>(null);
  const portalRef = usePortalTriggerRef<HTMLDivElement>(forwardedRef);
  const [resetVersion, setResetVersion] = useState(0);
  const captureRoot = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    portalRef(node);
  }, [portalRef]);
  const lookup = useMemo(() => new Map(items.map(item => [item.value, item])), [items]);
  const values = useMemo(() => items.map(item => item.value), [items]);
  const { contains } = Combobox.useFilter({ sensitivity: 'base' });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const ownerDocument = root.ownerDocument;
    const formElement = form
      ? ownerDocument.getElementById(form) as HTMLFormElement | null
      : root.closest('form');
    if (!formElement) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        actionsRef.current?.close();
        setResetVersion(version => version + 1);
      }, 0);
    };
    formElement.addEventListener('reset', reset);
    return () => {
      clearTimeout(timer);
      formElement.removeEventListener('reset', reset);
    };
  }, [form]);
  const summary = (selected: string | string[] | null) => {
    const selectedValues = Array.isArray(selected) ? selected : selected == null ? [] : [selected];
    return selectedValues.map(item => lookup.get(item)?.label ?? item).join(', ');
  };
  const search = <Combobox.Input
    id={searchPlacement === 'trigger' ? controlId : `${controlId}-search`}
    aria-label={searchPlacement === 'trigger' ? ariaLabel : searchPlaceholder}
    aria-labelledby={searchPlacement === 'trigger' ? ariaLabelledBy : undefined}
    aria-describedby={describedBy}
    aria-invalid={resolvedInvalid || undefined}
    ref={searchRef}
    placeholder={searchPlacement === 'trigger' ? placeholder : searchPlaceholder}
    render={<Input classNames={searchPlacement === 'trigger' ? {
      root: 'inkra-search-select__input',
      control: 'inkra-search-select__input-control',
    } : undefined} size={size} variant={searchPlacement === 'trigger' ? 'ghost' : 'underline'}
      startIcon={<PencilIcon paths={searchPaths} size={22} sourceSize={24} />} />}
  />;
  const clear = clearable ? <InputAction disabled={resolvedReadOnly || resolvedDisabled} seed={`search-select-clear-${controlId}`}>
    <Combobox.Clear
      aria-label={clearLabel}
      className="inkra-search-select__clear"
      disabled={resolvedReadOnly || resolvedDisabled}
      keepMounted
      onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={event => {
        event.stopPropagation();
        setTimeout(() => {
          actionsRef.current?.close();
          (searchPlacement === 'trigger' ? searchRef.current : triggerRef.current)?.focus({ preventScroll: true });
        }, 0);
      }}
      render={(renderProps, state) => <Button {...renderProps}
        aria-hidden={!state.visible || undefined} tabIndex={state.visible ? 0 : -1}
        variant="ghost" size={actionSize} />}
    ><PencilIcon paths={clearPaths} size={24} sourceSize={24} /></Combobox.Clear>
  </InputAction> : null;

  return <DirectionProvider direction={dir}>
    <Combobox.Root<string, boolean>
      key={resetVersion}
      actionsRef={actionsRef}
      items={values} multiple={multiple} value={value} defaultValue={defaultValueRef.current}
      disabled={resolvedDisabled} readOnly={resolvedReadOnly} required={Boolean(required || field?.required)}
      name={name} form={form} autoHighlight
      open={resolvedReadOnly || resolvedDisabled ? false : open}
      defaultOpen={resetVersion === 0 ? defaultOpen : false}
      onOpenChange={(next, details) => { if (resolvedReadOnly || resolvedDisabled) details.cancel(); else onOpenChange?.(next); }}
      itemToStringLabel={item => lookup.get(item)?.label ?? item}
      filter={(item, query) => contains(`${lookup.get(item)?.label ?? item} ${lookup.get(item)?.keywords ?? ''}`, query)}
      onValueChange={next => {
        if (resolvedDisabled || resolvedReadOnly) return;
        if (props.multiple) props.onValueChange?.(Array.isArray(next) ? next : []);
        else props.onValueChange?.(typeof next === 'string' ? next : null);
      }}
    >
      <div {...rest} ref={captureRoot} dir={dir} className={['inkra-search-select', className].filter(Boolean).join(' ')}
        data-disabled={resolvedDisabled || undefined} data-placement={searchPlacement}
        data-invalid={resolvedInvalid || undefined} data-readonly={resolvedReadOnly || undefined} data-size={size}>
        <Combobox.InputGroup render={<PencilSurface
          className="inkra-search-select__anchor inkra-search-select__control" radius={8}
          seed={`search-select-control-${controlId}`} variant={resolvedInvalid ? 'danger' : 'outline'} />}>
          {searchPlacement === 'trigger' ? <>
            {search}
            <InputAction disabled={resolvedReadOnly || resolvedDisabled} seed={`search-select-open-${controlId}`}>
              <Combobox.Trigger aria-label={openLabel} className="inkra-search-select__open"
                disabled={resolvedReadOnly || resolvedDisabled}
                render={<Button variant="ghost" size={actionSize} />}>
                <PencilIcon paths={chevronPaths} size={indicatorSize} sourceSize={24} />
              </Combobox.Trigger>
            </InputAction>
            {clear}
          </> : <><Combobox.Trigger
            id={controlId} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-describedby={describedBy}
            aria-invalid={resolvedInvalid || undefined} aria-readonly={resolvedReadOnly || undefined}
            className="inkra-search-select__trigger" ref={triggerRef}
            render={<Button variant="ghost" fullWidth size={size} align="start" />}
          ><Combobox.Value>{(selected: string | string[] | null) => <PencilText ellipsis>{summary(selected) || placeholder}</PencilText>}</Combobox.Value><PencilIcon paths={chevronPaths} size={indicatorSize} sourceSize={24} /></Combobox.Trigger>{clear}</>}
        </Combobox.InputGroup>
        {multiple && searchPlacement === 'trigger' && <Combobox.Value>{(selected: string[]) => selected.length ? <PencilText className="inkra-search-select__summary">{summary(selected)}</PencilText> : null}</Combobox.Value>}
      </div>
      <Combobox.Portal><PortalThemeBridge>
        <Combobox.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={collisionPadding} className="inkra-select__positioner inkra-search-select__positioner">
          <Combobox.Popup className="inkra-search-select__popup" initialFocus={searchPlacement === 'popup' ? searchRef : false}>
            <PencilSurface variant="paper" radius={8}>
              {searchPlacement === 'popup' && <div className="inkra-search-select__search">{search}</div>}
              <Combobox.Empty className="inkra-search-select__empty">{typeof emptyContent === 'string' ? <PencilText>{emptyContent}</PencilText> : emptyContent}</Combobox.Empty>
              <Combobox.List className="inkra-select__viewport inkra-search-select__list">
                {(item: string) => <Combobox.Item key={item} value={item} disabled={lookup.get(item)?.disabled} className="inkra-select__item">
                  <PencilSurface className="inkra-select__item-surface" variant="selection" seed={`search-option-${item}`}>
                    <PencilText>{lookup.get(item)?.label ?? item}</PencilText>
                    <Combobox.ItemIndicator className="inkra-select__item-indicator"><PencilIcon paths={checkPaths} size={22} sourceSize={24} /></Combobox.ItemIndicator>
                  </PencilSurface>
                </Combobox.Item>}
              </Combobox.List>
            </PencilSurface>
          </Combobox.Popup>
        </Combobox.Positioner>
      </PortalThemeBridge></Combobox.Portal>
    </Combobox.Root>
  </DirectionProvider>;
});

export const SearchableSelect = forwardRef<HTMLDivElement, SearchableSelectProps>(function SearchableSelect(props, ref) {
  return <PortalThemeProvider><SearchableControl {...props} ref={ref} /></PortalThemeProvider>;
});
