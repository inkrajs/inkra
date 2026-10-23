import { Combobox } from '@base-ui/react/combobox';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { forwardRef, useCallback, useId, useMemo, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button.js';
import { Input } from '../form/Input.js';
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
  const field = useFieldContext();
  const generatedId = useId();
  const controlId = field?.controlId ?? id ?? generatedId;
  const resolvedDisabled = Boolean(disabled || field?.disabled);
  const resolvedReadOnly = Boolean(readOnly || field?.readOnly);
  const resolvedInvalid = Boolean(invalid || field?.invalid);
  const describedBy = mergeAriaIds(ariaDescribedBy, field?.descriptionId, field?.errorId);
  const searchRef = useRef<HTMLInputElement>(null);
  const portalRef = usePortalTriggerRef<HTMLDivElement>(forwardedRef);
  const lookup = useMemo(() => new Map(items.map(item => [item.value, item])), [items]);
  const values = useMemo(() => items.map(item => item.value), [items]);
  const { contains } = Combobox.useFilter({ sensitivity: 'base' });
  const itemToStringLabel = useCallback((item: string) => lookup.get(item)?.label ?? item, [lookup]);
  const filter = useCallback((item: string, query: string) => {
    const option = lookup.get(item);
    return contains(`${option?.label ?? item} ${option?.keywords ?? ''}`, query);
  }, [contains, lookup]);
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
    render={<Input size={size} variant={searchPlacement === 'trigger' ? 'outline' : 'underline'} startIcon={<PencilIcon paths={searchPaths} size={22} sourceSize={24} />} />}
  />;

  return <DirectionProvider direction={dir}>
    <Combobox.Root<string, boolean>
      items={values} multiple={multiple} value={value} defaultValue={defaultValue}
      disabled={resolvedDisabled} readOnly={resolvedReadOnly} required={Boolean(required || field?.required)}
      name={name} form={form} autoHighlight
      open={resolvedReadOnly || resolvedDisabled ? false : open} defaultOpen={defaultOpen}
      onOpenChange={(next, details) => { if (resolvedReadOnly || resolvedDisabled) details.cancel(); else onOpenChange?.(next); }}
      itemToStringLabel={itemToStringLabel}
      filter={filter}
      onValueChange={next => {
        if (resolvedDisabled || resolvedReadOnly) return;
        if (props.multiple) props.onValueChange?.(Array.isArray(next) ? next : []);
        else props.onValueChange?.(typeof next === 'string' ? next : null);
      }}
    >
      <div {...rest} ref={portalRef} dir={dir} className={['inkra-search-select', className].filter(Boolean).join(' ')} data-placement={searchPlacement} data-invalid={resolvedInvalid || undefined}>
        <Combobox.InputGroup className="inkra-search-select__anchor">
          {searchPlacement === 'trigger' ? search : <Combobox.Trigger
            id={controlId} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-describedby={describedBy}
            aria-invalid={resolvedInvalid || undefined} aria-readonly={resolvedReadOnly || undefined}
            className="inkra-search-select__trigger"
            render={<Button variant="outline" fullWidth size={size} align="start" />}
          ><Combobox.Value>{(selected: string | string[] | null) => <PencilText ellipsis>{summary(selected) || placeholder}</PencilText>}</Combobox.Value><PencilIcon paths={chevronPaths} size={indicatorSize} sourceSize={24} /></Combobox.Trigger>}
          {searchPlacement === 'trigger' && <Combobox.Trigger aria-label={openLabel} render={<Button variant="ghost" size="icon" />}><PencilIcon paths={chevronPaths} size={indicatorSize} sourceSize={24} /></Combobox.Trigger>}
          {clearable && <Combobox.Clear aria-label={clearLabel} disabled={resolvedReadOnly || resolvedDisabled} render={<Button variant="ghost" size="icon" />}><PencilIcon paths={clearPaths} size={24} sourceSize={24} /></Combobox.Clear>}
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
