import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button } from '../Button.js';
import { Progress } from '../display/index.js';
import { PencilIcon, type PencilIconPath } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

export type UploadStatus = 'selected' | 'uploading' | 'success' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress?: number;
  error?: string;
}

export type UploadRejectionCode = 'accept' | 'max-size' | 'max-files' | 'custom';

export interface UploadRejection {
  file: File;
  code: UploadRejectionCode;
  message: string;
}

export type UploadChangeReason = 'add' | 'remove' | 'upload-start' | 'upload-progress' | 'upload-success' | 'upload-error' | 'cancel' | 'retry';

export interface UploadChangeDetails {
  reason: UploadChangeReason;
  item?: UploadItem;
}

export interface UploadRequestContext {
  signal: AbortSignal;
  reportProgress: (progress: number) => void;
}

export interface UploadLabels {
  browse: string;
  drop: string;
  selected: string;
  upload: string;
  uploading: string;
  success: string;
  error: string;
  cancelled: string;
  retry: string;
  cancel: string;
  remove: string;
  rejected: string;
  acceptError: string;
  sizeError: (maxSize: number) => string;
  countError: (maxFiles: number) => string;
}

export interface UploadProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  accept?: string;
  autoUpload?: boolean;
  capture?: InputHTMLAttributes<HTMLInputElement>['capture'];
  defaultFiles?: readonly UploadItem[];
  disabled?: boolean;
  files?: readonly UploadItem[];
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'accept' | 'capture' | 'disabled' | 'multiple' | 'name' | 'onChange' | 'type'>;
  labels?: Partial<UploadLabels>;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  onFilesChange?: (files: readonly UploadItem[], details: UploadChangeDetails) => void;
  onReject?: (rejections: readonly UploadRejection[]) => void;
  onUpload?: (file: File, context: UploadRequestContext) => Promise<void> | void;
  validate?: (file: File, acceptedFiles: readonly UploadItem[]) => string | undefined;
}

const uploadPaths: readonly PencilIconPath[] = [
  { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
  { d: 'm17 8-5-5-5 5' },
  { d: 'M12 3v12' },
];

const defaultLabels = (t: InkraTranslate): UploadLabels => ({
  browse: t('upload.browse'),
  drop: t('upload.drop'),
  selected: t('common.selected'),
  upload: t('upload.upload'),
  uploading: t('upload.uploading'),
  success: t('upload.success'),
  error: t('upload.failed'),
  cancelled: t('upload.cancelled'),
  retry: t('common.retry'),
  cancel: t('common.cancel'),
  remove: t('common.remove'),
  rejected: t('upload.rejected'),
  acceptError: t('upload.acceptError'),
  sizeError: maxSize => t('upload.sizeError', { size: formatBytes(maxSize) }),
  countError: maxFiles => t(maxFiles === 1 ? 'upload.countErrorOne' : 'upload.countError', { count: maxFiles }),
});

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(',').some(value => {
    const rule = value.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function asErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function statusLabel(status: UploadStatus, labels: UploadLabels): string {
  return labels[status];
}

const UploadRow = memo(function UploadRow({ item, labels, disabled, canUpload, startUpload, cancel, remove }: {
  item: UploadItem;
  labels: UploadLabels;
  disabled: boolean;
  canUpload: boolean;
  startUpload: (id: string, reason?: 'upload-start' | 'retry') => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
}) {
  return <li className="inkra-upload__item" data-status={item.status}>
    <PencilSurface className="inkra-upload__item-surface" variant="paper" radius={8}>
      <div className="inkra-upload__file">
        <PencilText className="inkra-upload__name" ellipsis>{item.file.name}</PencilText>
        <span className="inkra-upload__meta">{formatBytes(item.file.size)} · {statusLabel(item.status, labels)}</span>
        {item.status === 'uploading' && <Progress size="sm" value={item.progress ?? 0} aria-label={`${item.file.name}: ${Math.round(item.progress ?? 0)}%`} />}
        {item.error && <span className="inkra-upload__error">{item.error}</span>}
      </div>
      <div className="inkra-upload__actions">
        {item.status === 'uploading' && <Button disabled={disabled} size="sm" variant="ghost" onClick={() => cancel(item.id)}>{labels.cancel}</Button>}
        {canUpload && item.status === 'selected' && <Button disabled={disabled} size="sm" variant="ghost" onClick={() => startUpload(item.id)}>{labels.upload}</Button>}
        {canUpload && (item.status === 'error' || item.status === 'cancelled') && <Button disabled={disabled} size="sm" variant="ghost" onClick={() => startUpload(item.id, 'retry')}>{labels.retry}</Button>}
        <Button disabled={disabled} size="sm" variant="ghost" onClick={() => remove(item.id)}>{labels.remove}</Button>
      </div>
    </PencilSurface>
  </li>;
});

export const Upload = forwardRef<HTMLDivElement, UploadProps>(function Upload(
  {
    accept,
    autoUpload = true,
    capture,
    className,
    defaultFiles = [],
    disabled = false,
    files,
    inputProps,
    labels: labelOverrides,
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    multiple = true,
    onFilesChange,
    onReject,
    onUpload,
    validate,
    'aria-label': ariaLabel,
    ...props
  },
  ref,
) {
  const { t } = useInkraLocale();
  const instanceId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemCounter = useRef(0);
  const controllers = useRef(new Map<string, { controller: AbortController; token: symbol }>());
  const mounted = useRef(true);
  const disabledRef = useRef(disabled);
  const [internalFiles, setInternalFiles] = useState<readonly UploadItem[]>(defaultFiles);
  const [rejections, setRejections] = useState<readonly UploadRejection[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const controlled = files !== undefined;
  const items = files ?? internalFiles;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  disabledRef.current = disabled;
  const localizedDefaults = useMemo(() => defaultLabels(t), [t]);
  const labelValues = { ...localizedDefaults, ...labelOverrides };
  // Snapshot scalar/function values so same-object label edits remain observable.
  const labels = useMemo(() => labelValues, [
    labelValues.browse, labelValues.drop, labelValues.selected, labelValues.upload,
    labelValues.uploading, labelValues.success, labelValues.error, labelValues.cancelled,
    labelValues.retry, labelValues.cancel, labelValues.remove, labelValues.rejected,
    labelValues.acceptError, labelValues.sizeError, labelValues.countError,
  ]);
  const commitRef = useRef<(next: readonly UploadItem[], details: UploadChangeDetails) => void>(() => {});

  const commit = (next: readonly UploadItem[], details: UploadChangeDetails) => {
    if (!controlled) {
      itemsRef.current = next;
      setInternalFiles(next);
    }
    onFilesChange?.(next, details);
  };
  commitRef.current = commit;

  const updateItem = useCallback((id: string, update: (item: UploadItem) => UploadItem, details: UploadChangeDetails) => {
    const current = itemsRef.current;
    const index = current.findIndex(item => item.id === id);
    if (index < 0) return;
    const next = [...current];
    next[index] = update(current[index]);
    commitRef.current(next, { ...details, item: next[index] });
  }, []);

  const startUpload = useCallback((id: string, reason: 'upload-start' | 'retry' = 'upload-start') => {
    const item = itemsRef.current.find(candidate => candidate.id === id);
    if (!item || !onUpload || disabledRef.current) return;
    controllers.current.get(id)?.controller.abort();
    const controller = new AbortController();
    const token = Symbol(id);
    controllers.current.set(id, { controller, token });
    updateItem(id, current => ({ ...current, status: 'uploading', progress: 0, error: undefined }), { reason });

    const reportProgress = (progress: number) => {
      const active = controllers.current.get(id);
      if (!active || active.token !== token || controller.signal.aborted) return;
      const normalized = Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
      updateItem(id, current => ({ ...current, status: 'uploading', progress: normalized }), { reason: 'upload-progress' });
    };

    Promise.resolve().then(() => {
      if (!mounted.current || controller.signal.aborted) return undefined;
      return onUpload(item.file, { signal: controller.signal, reportProgress });
    }).then(() => {
      const active = controllers.current.get(id);
      if (!active || active.token !== token || controller.signal.aborted) return;
      controllers.current.delete(id);
      updateItem(id, current => ({ ...current, status: 'success', progress: 100, error: undefined }), { reason: 'upload-success' });
    }).catch(error => {
      const active = controllers.current.get(id);
      if (!active || active.token !== token || controller.signal.aborted) return;
      controllers.current.delete(id);
      updateItem(id, current => ({ ...current, status: 'error', progress: undefined, error: asErrorMessage(error, labels.error) }), { reason: 'upload-error' });
    });
  }, [onUpload, labels.error, updateItem]);

  const addFiles = (incoming: readonly File[]) => {
    if (disabled || incoming.length === 0) return;
    const accepted: UploadItem[] = [];
    const rejected: UploadRejection[] = [];
    const limit = multiple ? Math.max(0, maxFiles) : Math.min(1, Math.max(0, maxFiles));
    let available = Math.max(0, limit - itemsRef.current.length);

    for (const file of incoming) {
      if (!matchesAccept(file, accept)) {
        rejected.push({ file, code: 'accept', message: labels.acceptError });
        continue;
      }
      if (file.size > maxSize) {
        rejected.push({ file, code: 'max-size', message: labels.sizeError(maxSize) });
        continue;
      }
      if (available <= 0) {
        rejected.push({ file, code: 'max-files', message: labels.countError(limit) });
        continue;
      }
      const provisional: UploadItem = {
        id: `${instanceId.replace(/:/g, '')}-${itemCounter.current++}`,
        file,
        status: 'selected',
      };
      const customError = validate?.(file, [...itemsRef.current, ...accepted]);
      if (customError) {
        rejected.push({ file, code: 'custom', message: customError });
        continue;
      }
      accepted.push(provisional);
      available -= 1;
    }

    setRejections(rejected);
    if (rejected.length) onReject?.(rejected);
    if (!accepted.length) return;
    commitRef.current([...itemsRef.current, ...accepted], { reason: 'add', item: accepted[accepted.length - 1] });
    if (onUpload && autoUpload) accepted.forEach(item => {
      queueMicrotask(() => {
        if (!mounted.current || disabledRef.current) return;
        if (itemsRef.current.some(candidate => candidate.id === item.id)) startUpload(item.id);
      });
    });
  };

  const remove = useCallback((id: string) => {
    if (disabledRef.current) return;
    controllers.current.get(id)?.controller.abort();
    controllers.current.delete(id);
    const item = itemsRef.current.find(candidate => candidate.id === id);
    commitRef.current(itemsRef.current.filter(candidate => candidate.id !== id), { reason: 'remove', item });
  }, []);

  const cancel = useCallback((id: string) => {
    if (disabledRef.current) return;
    controllers.current.get(id)?.controller.abort();
    controllers.current.delete(id);
    updateItem(id, item => ({ ...item, status: 'cancelled', progress: undefined, error: undefined }), { reason: 'cancel' });
  }, [updateItem]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllers.current.forEach(active => active.controller.abort());
      controllers.current.clear();
    };
  }, []);

  useEffect(() => {
    const activeIds = new Set(items.map(item => item.id));
    controllers.current.forEach((active, id) => {
      if (!activeIds.has(id)) {
        active.controller.abort();
        controllers.current.delete(id);
      }
    });
  }, [items]);

  useEffect(() => {
    if (disabled) setDragActive(false);
  }, [disabled]);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPicker();
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  return <div {...props} aria-label={ariaLabel} ref={ref} className={['inkra-upload', className].filter(Boolean).join(' ')} data-disabled={disabled || undefined}>
    <input
      {...inputProps}
      aria-hidden="true"
      ref={inputRef}
      className={['inkra-upload__input', inputProps?.className].filter(Boolean).join(' ')}
      type="file"
      accept={accept}
      capture={capture}
      multiple={multiple}
      disabled={disabled}
      tabIndex={-1}
      onChange={event => {
        addFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = '';
      }}
    />
    <PencilSurface
      as="div"
      className="inkra-upload__dropzone"
      data-drag-active={dragActive || undefined}
      variant={dragActive ? 'selection' : 'outline'}
      role="button"
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={event => { event.preventDefault(); if (!disabled) setDragActive(true); }}
      onDragOver={event => { event.preventDefault(); if (!disabled) event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }}
      onDrop={handleDrop}
    >
      <PencilSurface<'span'>
        aria-hidden="true"
        as="span"
        className="inkra-upload__focus-ring"
        seed={`${instanceId}-focus`}
        variant="outline"
      />
      <PencilIcon className="inkra-upload__icon" paths={uploadPaths} size={32} sourceSize={24} />
      <span className="inkra-upload__prompt"><PencilText>{labels.browse}</PencilText><span>{labels.drop}</span></span>
      {accept && <span className="inkra-upload__hint">{accept}</span>}
    </PencilSurface>

    {rejections.length > 0 && <div className="inkra-upload__rejections" role="alert">
      <strong>{labels.rejected}</strong>
      <ul>{rejections.map((rejection, index) => <li key={`${rejection.file.name}-${index}`}>{rejection.file.name}: {rejection.message}</li>)}</ul>
    </div>}

    {items.length > 0 && <ul className="inkra-upload__list" aria-live="polite">
      {items.map(item => <UploadRow key={item.id} item={item} labels={labels} disabled={disabled}
        canUpload={Boolean(onUpload)} startUpload={startUpload} cancel={cancel} remove={remove} />)}
    </ul>}
  </div>;
});
