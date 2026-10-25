import { Button, Field, Input, InputNumber, PencilIcon, Select, Slider, Tabs } from '@inkra/react';
import type { SelectTriggerProps } from '@inkra/react';
import { InkraProvider, inkraLocales, useInkraLocale } from '@inkra/react/i18n';
import type { InkraDictionary, InkraLocale, InkraMessageKey } from '@inkra/react/i18n';
import { ThemeProvider } from '@inkra/react/theme';
import type { InkraThemeTokens } from '@inkra/react/theme';

const themeTokens = { '--inkra-accent': '#4b96aa', '--inkra-icon-stroke-width': '1.5px' } satisfies InkraThemeTokens;
const themeScope = <ThemeProvider theme="auto" tokens={themeTokens}><span>Scoped theme</span></ThemeProvider>;
// @ts-expect-error theme must use a supported mode
const invalidTheme = <ThemeProvider theme="sepia" />;
// @ts-expect-error theme tokens must use the Inkra namespace
const invalidThemeTokens: InkraThemeTokens = { color: 'red' };
import {
  AlertDialog, Command, DataTable, DatePicker, Drawer, Empty, Pagination, Steps,
  Timeline, TimePicker, Toast, ToggleGroup, Tree, Upload,
} from '@inkra/react';

const trigger: SelectTriggerProps = {
  startIcon: <PencilIcon paths={[{ d: 'M4 12h16' }]} size={22} />,
  hideIndicator: true,
  iconOnly: true,
  fullWidth: false,
  textAlign: 'start',
  'aria-label': 'Language',
};

const dictionary = { 'input.clear': 'Custom clear', 'pagination.page': 'Page {page}' } satisfies InkraDictionary;
const messageKey: InkraMessageKey = 'input.clear';
const locale: InkraLocale = 'ja';
// @ts-expect-error Message keys must match the public catalog.
const badDictionary: InkraDictionary = { 'input.typo': 'Missing key' };
// @ts-expect-error Dictionaries contain text, not executable render functions.
const badValue: InkraDictionary = { 'input.clear': () => 'Clear' };
function LocalizedContent() {
  const { t } = useInkraLocale();
  return <Input clearable aria-label={t(messageKey)} />;
}
export function InstalledLocaleExample() {
  return <InkraProvider locale={locale} messages={{ ...inkraLocales.ja, ...dictionary }}>
    <LocalizedContent />
  </InkraProvider>;
}

export function InstalledExample() {
  return <>
    <Button startIcon={trigger.startIcon}>Save</Button>
    <Field label="Name"><Input clearable startIcon={trigger.startIcon} onValueChange={value => value.toUpperCase()} /></Field>
    <InputNumber defaultValue={1} min={0} max={10} />
    <Slider defaultValue={[20]} />
    <Select.Root multiple defaultValue={['en']} items={[{ value: 'en', label: 'English' }]}>
      <Select.Trigger {...trigger}><Select.Value /></Select.Trigger>
    </Select.Root>
    <Tabs.Root defaultValue="one"><Tabs.List><Tabs.Trigger value="one">One</Tabs.Trigger></Tabs.List><Tabs.Content value="one">Content</Tabs.Content></Tabs.Root>
  </>;
}

export function InstalledExpansionExample() {
  return <>
    <Toast.Provider><Button>Notifications</Button></Toast.Provider>
    <AlertDialog.Root><AlertDialog.Trigger asChild><Button>Confirm</Button></AlertDialog.Trigger></AlertDialog.Root>
    <Drawer.Root><Drawer.Trigger asChild><Button>Details</Button></Drawer.Trigger></Drawer.Root>
    <DatePicker name="date" defaultValue={new Date(2026, 9, 22)} locale="en-US" />
    <TimePicker name="time" defaultValue="09:30" min="08:00" max="18:00" />
    <Empty.Root><Empty.Title>No notes</Empty.Title><Empty.Description>Create a note to start.</Empty.Description></Empty.Root>
    <ToggleGroup.Root defaultValue={['bold']} aria-label="Formatting"><ToggleGroup.Item value="bold">Bold</ToggleGroup.Item></ToggleGroup.Root>
    <Command.Root><Command.Input aria-label="Commands" /><Command.List><Command.Item value="save">Save</Command.Item></Command.List></Command.Root>
    <Upload accept="image/*" onUpload={async (_file, { signal, reportProgress }) => { if (!signal.aborted) reportProgress(100); }} />
    <DataTable data={[{ id: 'one', title: 'One' }]} columns={[{ accessorKey: 'title', header: 'Title' }]} getRowId={row => row.id} />
    <Tree.Root aria-label="Notes"><Tree.Item id="one" textValue="One"><Tree.ItemContent><Tree.ItemTitle>One</Tree.ItemTitle></Tree.ItemContent></Tree.Item></Tree.Root>
    <Steps current={0} items={[{ id: 'one', title: 'Draft' }]} />
    <Timeline items={[{ id: 'one', title: 'Created', date: 'October 22', dateTime: '2026-10-22' }]} />
    <Pagination totalPages={5} defaultPage={2} />
    <Pagination totalPages={5} variant="outline" align="end" wrap hideOnSinglePage
      pageSize={20} defaultPageSize={10} pageSizeOptions={[10, 20, 50]} onPageSizeChange={value => { const size: number = value; void size; }}
      labels={{ pageSize: 'Items per page', pageSizeOption: size => `${size} rows` }} />
  </>;
}
