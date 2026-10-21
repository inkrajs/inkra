export type FieldControlSize = 'sm' | 'md' | 'lg';

export interface FieldControlStateProps {
  invalid?: boolean;
  size?: FieldControlSize;
  seed?: string | number;
}
