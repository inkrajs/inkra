import { resolveInkraLocale, type InkraLocale } from '../i18n/index.js';

export interface LoadingLabels {
  loading: string;
  error: string;
  complete: string;
  cancel: string;
  retry: string;
  continue: string;
  previousTip: string;
  nextTip: string;
  pauseTips: string;
  resumeTips: string;
  stageProgress: string;
}

const loadingLabels: Record<InkraLocale, LoadingLabels> = {
  en: {
    loading: 'Loading', error: 'Unable to continue', complete: 'Ready', cancel: 'Cancel', retry: 'Retry',
    continue: 'Continue', previousTip: 'Previous tip', nextTip: 'Next tip', pauseTips: 'Pause tips',
    resumeTips: 'Resume tips', stageProgress: 'Step {current} of {total}',
  },
  'zh-CN': {
    loading: '正在加载', error: '暂时无法继续', complete: '准备就绪', cancel: '取消', retry: '重试',
    continue: '继续', previousTip: '上一条提示', nextTip: '下一条提示', pauseTips: '暂停提示',
    resumeTips: '继续提示', stageProgress: '第 {current} 步，共 {total} 步',
  },
  ja: {
    loading: '読み込み中', error: '続行できません', complete: '準備完了', cancel: 'キャンセル', retry: '再試行',
    continue: '続ける', previousTip: '前のヒント', nextTip: '次のヒント', pauseTips: 'ヒントを一時停止',
    resumeTips: 'ヒントを再開', stageProgress: '{total} ステップ中 {current}',
  },
  ko: {
    loading: '불러오는 중', error: '계속할 수 없습니다', complete: '준비 완료', cancel: '취소', retry: '다시 시도',
    continue: '계속', previousTip: '이전 도움말', nextTip: '다음 도움말', pauseTips: '도움말 일시 정지',
    resumeTips: '도움말 계속', stageProgress: '{total}단계 중 {current}단계',
  },
  fr: {
    loading: 'Chargement', error: 'Impossible de continuer', complete: 'Prêt', cancel: 'Annuler', retry: 'Réessayer',
    continue: 'Continuer', previousTip: 'Conseil précédent', nextTip: 'Conseil suivant', pauseTips: 'Suspendre les conseils',
    resumeTips: 'Reprendre les conseils', stageProgress: 'Étape {current} sur {total}',
  },
};

export function resolveLoadingLabels(locale: string, overrides?: Partial<LoadingLabels>): LoadingLabels {
  return { ...loadingLabels[resolveInkraLocale(locale)], ...overrides };
}

export function formatLoadingLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
}
