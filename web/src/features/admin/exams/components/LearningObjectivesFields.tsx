import { useId } from 'react';
import { Text, formStyles } from '../../../../components';

export function parseLearningObjectives(value: string): string[] | string {
  const objectives = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (objectives.length > 20) return 'En fazla 20 öğrenme hedefi ekleyebilirsiniz.';
  if (objectives.some((objective) => objective.length > 300)) {
    return 'Her öğrenme hedefi en fazla 300 karakter olmalıdır.';
  }
  return objectives;
}

interface LearningObjectivesFieldsProps {
  objectives: string;
  requiresCourseCompletion: boolean;
  onObjectivesChange: (value: string) => void;
  onCompletionChange: (value: boolean) => void;
}

export function LearningObjectivesFields({
  objectives,
  requiresCourseCompletion,
  onObjectivesChange,
  onCompletionChange,
}: LearningObjectivesFieldsProps) {
  const hintId = useId();
  return (
    <fieldset className={formStyles.fieldset}>
      <legend>
        <Text role="label-lg" as="span">Eğitim sonu sınavı ve öğrenme hedefleri</Text>
      </legend>
      <label className={formStyles.checkbox}>
        <input
          type="checkbox"
          checked={requiresCourseCompletion}
          onChange={(event) => onCompletionChange(event.target.checked)}
        />
        <Text role="body-md" as="span">Sınava başlamak için kursun tüm dersleri tamamlanmış olsun</Text>
      </label>
      <Text role="body-sm" as="p" tone="muted">
        Bu seçenek açıkken öğrenci, eğitimi tamamladıktan sonra sınava girebilir.
        Zamanlama ve deneme hakkı ayarları da geçerlidir.
      </Text>
      <label className={formStyles.field}>
        <Text role="label-md" as="span" tone="muted">Öğrenme hedefleri (objektifler)</Text>
        <textarea
          className={formStyles.textarea}
          rows={4}
          value={objectives}
          maxLength={6019}
          aria-describedby={hintId}
          placeholder={'Öğrenci değişken ve sabit arasındaki farkı açıklar.\nÖğrenci basit bir koşul ifadesinin sonucunu belirler.'}
          onChange={(event) => onObjectivesChange(event.target.value)}
        />
      </label>
      <p id={hintId}>
        <Text role="body-sm" tone="muted">
          Her satıra bir hedef yazın; en fazla 20 hedef, her biri en fazla 300 karakter.
          Hedefler sınavın ölçeceği kazanımları tanımlar. Eğitim sonu sınavında en az bir hedef belirleyin.
          Soruları bu hedeflere göre Soru Bankası'nda hazırlayın ve sınavın Sorular sekmesinden seçin.
        </Text>
      </p>
    </fieldset>
  );
}
