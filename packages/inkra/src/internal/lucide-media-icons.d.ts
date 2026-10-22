type LucidePathIconData = {
  name: string;
  size: number;
  node: Array<['path', { d: string; key: string }]>;
};

declare module 'lucide-react/dist/esm/icons/download.mjs' {
  export const __iconData: LucidePathIconData;
}

declare module 'lucide-react/dist/esm/icons/rotate-ccw.mjs' {
  export const __iconData: LucidePathIconData;
}
