import type { BadgeTone } from '../../components';
import type { CalendarEventType } from '../../types';

export interface EventTypeMeta {
  label: string;
  icon: string;
  tone: BadgeTone;
  /** FullCalendar satır içi stil olarak uygular; yalnızca token referansı verilir. */
  background: string;
  text: string;
}

export const EVENT_TYPES: Record<CalendarEventType, EventTypeMeta> = {
  lecture: {
    label: 'Ders',
    icon: 'video_call',
    tone: 'secondary',
    background: 'var(--color-secondary)',
    text: 'var(--color-on-secondary)',
  },
  lab: {
    label: 'Laboratuvar',
    icon: 'science',
    tone: 'cyan',
    background: 'var(--color-cyan-accent)',
    text: 'var(--color-on-secondary)',
  },
  exam: {
    label: 'Sınav',
    icon: 'quiz',
    tone: 'error',
    background: 'var(--color-state-error)',
    text: 'var(--color-on-error)',
  },
  deadline: {
    label: 'Son Teslim',
    icon: 'assignment_late',
    tone: 'warning',
    background: 'var(--color-state-warning)',
    text: 'var(--color-text-main)',
  },
  holiday: {
    label: 'Tatil',
    icon: 'celebration',
    tone: 'success',
    background: 'var(--color-state-success)',
    text: 'var(--color-on-secondary)',
  },
  event: {
    label: 'Etkinlik',
    icon: 'event',
    tone: 'info',
    background: 'var(--color-state-info)',
    text: 'var(--color-on-secondary)',
  },
};

export const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES) as CalendarEventType[];
