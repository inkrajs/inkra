import { Button, Field, Input, InputNumber, PencilIcon, Select, Slider, Tabs } from '@inkra/react';
import type { SelectTriggerProps } from '@inkra/react';
import { Textarea } from '@inkra/react/form';
import { Guide } from '@inkra/react/guide';
import { Loading, type LoadingProps } from '@inkra/react/loading';
import { InfiniteScroll, type InfiniteScrollLoadContext } from '@inkra/react/infinite-scroll';
import { Masonry } from '@inkra/react/masonry';
import { NumberTicker } from '@inkra/react/number-ticker';

const loaderProps = { mode: 'fullscreen', preset: 'scene-bottom', slots: { 'bottom-start': <button>Character</button> }, tips: ['Tip'], progress: null } satisfies LoadingProps;
// @ts-expect-error Slot names must be one of the six public positions.
const invalidLoader: LoadingProps = { slots: { somewhere: 'Wrong' } };
// @ts-expect-error Motion has two supported presentation modes.
const invalidTicker = <NumberTicker value={12} animation="spin" />;
export function InstalledAsyncExamples() {
  return <>
    <Guide.Root showSkip onSkip={() => {}} onFinish={() => {}}>
      <Guide.Trigger>Start</Guide.Trigger><Guide.Step target="#welcome" title="Welcome">First step</Guide.Step>
    </Guide.Root>
    <Loading {...loaderProps} onCancel={() => {}} />
    <InfiniteScroll directions={['top', 'bottom']} automatic={{ top: false }} gesture onLoad={async (context: InfiniteScrollLoadContext) => { context.signal.throwIfAborted(); }}>
      <Masonry items={[{ id: 'a', title: 'A' }]} getItemKey={item => item.id} renderItem={({ item }) => <article>{item.title}</article>} />
    </InfiniteScroll>
    <NumberTicker value="120000.25" animation="roll" rollDirection="down" />
  </>;
}
import type { TextareaAutoSizeOptions } from '@inkra/react';

const textareaSizing = { minRows: 1, maxRows: 6 } satisfies TextareaAutoSizeOptions;
// @ts-expect-error Row limits must be numbers.
const invalidTextareaSizing = <Textarea autoSize={{ maxRows: 'six' }} />;
// @ts-expect-error autoSize must be a boolean or a row-options object.
const invalidTextareaAutoSize = <Textarea autoSize="true" />;
import { InkraProvider, inkraLocales, useInkraLocale } from '@inkra/react/i18n';
import type { InkraDictionary, InkraLocale, InkraMessageKey } from '@inkra/react/i18n';
import { ThemeProvider } from '@inkra/react/theme';
import type { InkraThemeTokens } from '@inkra/react/theme';
import { useState } from 'react';
import { Grid } from '@inkra/react/layout';
import type { GridBoardLayout } from '@inkra/react/layout';
import { InventoryGrid, rotateInventoryCells } from '@inkra/react/inventory-grid';
import type { InventoryContainer, InventoryItem } from '@inkra/react/inventory-grid';

interface Equipment extends InventoryItem { kind: 'tool' | 'supply' }
const initialInventory: readonly InventoryContainer<Equipment>[] = [{
  id: 'bag', columns: 4, rows: 4, items: [{
    id: 'tool', kind: 'tool', position: { x: 0, y: 0 },
    cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  }],
}];
// @ts-expect-error Rotation is restricted to quarter turns.
rotateInventoryCells([{ x: 0, y: 0 }], 45);
export function InstalledGridExample() {
  const [containers, setContainers] = useState(initialInventory);
  const [layout, setLayout] = useState<GridBoardLayout>([{ i: 'one', x: 0, y: 0, w: 4, h: 3 }]);
  return <>
    <InventoryGrid containers={containers} onChange={(next, details) => {
      const kind: 'tool' | 'supply' = next[0].items[0].kind;
      const type: 'move' | 'transfer' | 'rotate' = details.type;
      setContainers(next);
    }} renderItem={item => <span>{item.kind}</span>} canPlace={({ item }) => item.kind === 'tool'} />
    <Grid.Board layout={layout} onLayoutChange={setLayout}>{item => <span>{item.i}</span>}</Grid.Board>
    <Grid.Resizable columns={[{ id: 'a' }, { id: 'b' }]} rows={[{ id: 'row' }]}>
      {({ row, column }) => <span>{row}:{column}</span>}
    </Grid.Resizable>
  </>;
}

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
    <Textarea rows={1} aria-label="One row" />
    <Textarea autoSize rows={2} aria-label="Growing note" />
    <Textarea autoSize={textareaSizing} aria-label="Capped note" resize="vertical" maxLength={240} />
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
