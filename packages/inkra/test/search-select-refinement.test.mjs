import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const searchable = readFileSync(new URL('../src/select/SearchableSelect.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/select/styles.css', import.meta.url), 'utf8');

test('Searchable Select renders both placements inside one shared pencil frame', () => {
  assert.match(searchable, /Combobox\.InputGroup[\s\S]*?render=\{<PencilSurface[\s\S]*?className="inkra-search-select__anchor inkra-search-select__control"/);
  assert.match(searchable, /variant=\{resolvedInvalid \? 'danger' : 'outline'\}/);
  assert.match(searchable, /searchPlacement === 'trigger' \? 'ghost' : 'underline'/);
  assert.match(searchable, /render=\{<Button variant="ghost" fullWidth size=\{size\} align="start" \/>\}/);
  assert.doesNotMatch(searchable, /inkra-search-select__trigger"[\s\S]{0,160}variant="outline"/);
});

test('Open and clear stay independent native buttons in shared action regions', () => {
  assert.match(searchable, /<InputAction[\s\S]*?search-select-open-/);
  assert.match(searchable, /<InputAction[\s\S]*?search-select-clear-/);
  assert.match(searchable, /<Combobox\.Trigger[\s\S]*?render=\{<Button variant="ghost" size=\{actionSize\}/);
  assert.match(searchable, /className="inkra-search-select__open"[\s\S]*?disabled=\{resolvedReadOnly \|\| resolvedDisabled\}/);
  assert.match(searchable, /<Combobox\.Clear[\s\S]*?render=\{\(renderProps, state\) => <Button \{\.\.\.renderProps\}/);
  assert.match(searchable, /Combobox\.Trigger[\s\S]*?render=\{<Button/);
  assert.match(searchable, /Combobox\.Clear[\s\S]*?render=\{\(renderProps, state\) => <Button/);
});

test('Clear keeps a stable slot, cannot open the popup, and restores useful focus', () => {
  assert.match(searchable, /<Combobox\.Clear[\s\S]*?keepMounted/);
  assert.match(searchable, /aria-hidden=\{!state\.visible \|\| undefined\} tabIndex=\{state\.visible \? 0 : -1\}/);
  assert.match(searchable, /onMouseDown=\{event => \{[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)/);
  assert.match(searchable, /onClick=\{event => \{[\s\S]*?stopPropagation\(\)[\s\S]*?searchPlacement === 'trigger' \? searchRef\.current : triggerRef\.current/);
  assert.match(searchable, /const actionsRef = useRef<Combobox\.Root\.Actions \| null>\(null\)/);
  assert.match(searchable, /actionsRef\.current\?\.close\(\)/);
  assert.match(searchable, /<Combobox\.Root<string, boolean>[\s\S]*?actionsRef=\{actionsRef\}/);
  assert.match(styles, /\.inkra-search-select__clear:not\(\[data-visible\]\) \{ visibility: hidden; \}/);
  assert.match(styles, /:has\(\.inkra-search-select__clear:not\(\[data-visible\]\)\)[\s\S]*?action-divider[\s\S]*?display: none/);
});

test('Searchable shared frame keeps stable sizes, long-copy flex and disabled state', () => {
  assert.match(styles, /--inkra-search-select-control-height: var\(--inkra-control-md\)/);
  assert.match(styles, /data-size="sm"[\s\S]*?--inkra-search-select-control-height: var\(--inkra-control-sm\)/);
  assert.match(styles, /data-size="lg"[\s\S]*?--inkra-search-select-control-height: var\(--inkra-control-lg\)/);
  assert.match(styles, /--inkra-field-control-height: var\(--inkra-search-select-control-height\)/);
  assert.match(styles, /\.inkra-search-select__anchor\s*\{[\s\S]*?block-size: var\(--inkra-search-select-control-height\)/);
  assert.match(styles, /\.inkra-search-select__trigger \.inkra-pencil-text \{ flex: 1 1 auto; min-width: 0; text-align: start; \}/);
  assert.match(searchable, /data-disabled=\{resolvedDisabled \|\| undefined\}/);
  assert.match(searchable, /data-readonly=\{resolvedReadOnly \|\| undefined\}/);
});

test('Searchable reset restores defaults without change callbacks and respects form ownership', () => {
  assert.match(searchable, /const \[resetVersion, setResetVersion\] = useState\(0\)/);
  assert.match(searchable, /const defaultValueRef = useRef\(defaultValue\)/);
  assert.match(searchable, /const formElement = form[\s\S]*?ownerDocument\.getElementById\(form\)[\s\S]*?: root\.closest\('form'\)/);
  assert.match(searchable, /formElement\.addEventListener\('reset', reset\)/);
  assert.match(searchable, /if \(event\.defaultPrevented\) return;[\s\S]*?actionsRef\.current\?\.close\(\);[\s\S]*?setResetVersion\(version => version \+ 1\)/);
  assert.match(searchable, /<Combobox\.Root<string, boolean>[\s\S]*?key=\{resetVersion\}/);
  assert.match(searchable, /defaultValue=\{defaultValueRef\.current\}/);
  assert.match(searchable, /defaultOpen=\{resetVersion === 0 \? defaultOpen : false\}/);
  const resetBlock = searchable.match(/useEffect\(\(\) => \{[\s\S]*?formElement\.removeEventListener\('reset', reset\);[\s\S]*?\}, \[form\]\);/)?.[0] ?? '';
  assert.doesNotMatch(resetBlock, /onValueChange|props\.onValueChange/);
});
