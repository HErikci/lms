import { Icon, Text } from '../../../../components';
import type { TypedQuestionContent } from '../../../../types';
import { BLANK_PATTERN } from '../questionMeta';
import styles from './QuestionPreview.module.css';

type PreviewQuestion = TypedQuestionContent & { stem: string; explanation: string | null };

interface QuestionPreviewProps {
  question: PreviewQuestion;
  /** Doğru cevapları ve açıklamayı vurgula. */
  showAnswers?: boolean;
}

function Stem({ question, showAnswers }: { question: PreviewQuestion; showAnswers: boolean }) {
  if (question.type !== 'FILL_BLANK') {
    return (
      <Text role="body-lg" as="p" tone="main" className={styles.stem}>
        {question.stem}
      </Text>
    );
  }
  const parts = question.stem.split(BLANK_PATTERN);
  return (
    <Text role="body-lg" as="p" tone="main" className={styles.stem}>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && (
            <span className={styles.blank}>
              <span className={styles.srOnly}>{index + 1}. boşluk: </span>
              {showAnswers ? question.content.blanks[index]?.accepted.join(' / ') : '…'}
            </span>
          )}
        </span>
      ))}
    </Text>
  );
}

function Body({ question, showAnswers }: { question: PreviewQuestion; showAnswers: boolean }) {
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE': {
      const single = question.type === 'SINGLE_CHOICE';
      return (
        <ul className={styles.options}>
          {question.content.options.map((option) => {
            const correct = showAnswers && option.correct;
            const icon = single
              ? correct
                ? 'radio_button_checked'
                : 'radio_button_unchecked'
              : correct
                ? 'check_box'
                : 'check_box_outline_blank';
            return (
              <li key={option.id} className={correct ? styles.correct : undefined}>
                <Icon name={icon} size="sm" filled={correct} />
                <Text role="body-md" as="span">
                  {option.text}
                </Text>
                {correct && <span className={styles.srOnly}> (doğru cevap)</span>}
              </li>
            );
          })}
        </ul>
      );
    }
    case 'TRUE_FALSE':
      return (
        <div className={styles.trueFalse}>
          {[true, false].map((value) => {
            const correct = showAnswers && question.content.correctAnswer === value;
            return (
              <span key={String(value)} className={[styles.pill, correct ? styles.correct : ''].join(' ')}>
                {correct && <Icon name="check" size="sm" />}
                {value ? 'Doğru' : 'Yanlış'}
                {correct && <span className={styles.srOnly}> (doğru cevap)</span>}
              </span>
            );
          })}
        </div>
      );
    case 'FILL_BLANK':
      return question.content.caseSensitive && showAnswers ? (
        <Text role="body-sm" tone="muted" as="p">
          Büyük/küçük harf duyarlı.
        </Text>
      ) : null;
    case 'MATCHING':
      return (
        <ul className={styles.pairs}>
          {question.content.pairs.map((pair) => (
            <li key={pair.id}>
              <Text role="body-md" as="span" weight="semibold">
                {pair.left}
              </Text>
              <Icon name="arrow_forward" size="sm" />
              <Text role="body-md" as="span">
                {showAnswers ? pair.right : '?'}
              </Text>
            </li>
          ))}
        </ul>
      );
    case 'SHORT_ANSWER':
      return showAnswers ? (
        <div className={styles.answers}>
          <Text role="label-md" tone="muted" as="span">
            Kabul edilen cevaplar{question.content.caseSensitive ? ' (büyük/küçük harf duyarlı)' : ''}:
          </Text>
          <span className={styles.chips}>
            {question.content.accepted.map((answer) => (
              <span key={answer} className={styles.chip}>
                {answer}
              </span>
            ))}
          </span>
        </div>
      ) : null;
    case 'ESSAY':
      return showAnswers ? (
        <div className={styles.rubric}>
          <Text role="label-md" tone="muted" as="span">
            Değerlendirme rubriği
          </Text>
          <Text role="body-md" as="p" tone={question.content.rubric ? 'default' : 'muted'}>
            {question.content.rubric ?? 'Rubrik tanımlanmadı.'}
          </Text>
        </div>
      ) : null;
  }
}

export function QuestionPreview({ question, showAnswers = true }: QuestionPreviewProps) {
  return (
    <div className={styles.preview}>
      <Stem question={question} showAnswers={showAnswers} />
      <Body question={question} showAnswers={showAnswers} />
      {showAnswers && question.explanation && (
        <p className={styles.explanation}>
          <Icon name="lightbulb" size="sm" />
          <Text role="body-sm" as="span">
            {question.explanation}
          </Text>
        </p>
      )}
    </div>
  );
}
