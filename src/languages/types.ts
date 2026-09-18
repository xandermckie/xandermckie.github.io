import type { Exercise } from '../types/exercise';

export type LanguageId = 'python' | 'rust';

export interface Wordmark {
  lead: string;
  accent: string;
}

export interface ResourceItem {
  label: string;
  url: string;
  description: string;
  tag: string;
}

export interface ResourceGroup {
  heading: string;
  items: ResourceItem[];
}

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  examples: string[];
}

export interface InterviewPreview {
  id: string;
  title: string;
  description: string;
  topics: string[];
  estimatedTime: number;
  locked: boolean;
}

export interface LanguageMeta {
  id: LanguageId;
  /** First URL segment; empty string means the site root (Python). */
  slug: string;
  productName: string;
  languageName: string;
  wordmark: Wordmark;
  /** Optional caret fill; defaults to the theme accent. */
  caretColor?: string;
  storagePrefix: string;
  friendCodePrefix: string;
  backupApp: string;
  friendShareApp: string;
  prismLanguage: string;
  homeHeadline: string;
  homeSubhead: string;
  guideLabel: string;
  aboutBlurb: string;
  exerciseAttribution: string;
  trademarkBlurb: string;
  typingAriaLabel: string;
  interviewIdPrefix: string;
  interviewSourceUrl: string;
  interviewSourceLabel: string;
  switcherLabel: string;
  documentDescription: string;
}

export interface LanguageKit extends LanguageMeta {
  exercises: Exercise[];
  guide: GuideSection[];
  interviewPreview: InterviewPreview[];
  resources: ResourceGroup[];
}
