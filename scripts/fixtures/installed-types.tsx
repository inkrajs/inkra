import { Button, Field, Input, InputNumber, PencilIcon, Select, Slider, Tabs } from 'inkra';
import type { SelectTriggerProps } from 'inkra';

const trigger: SelectTriggerProps = {
  startIcon: <PencilIcon paths={[{ d: 'M4 12h16' }]} size={22} />,
  hideIndicator: true,
  iconOnly: true,
  fullWidth: false,
  textAlign: 'start',
  'aria-label': 'Language',
};

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
