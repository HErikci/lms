import { useEffect, useState } from 'react';
import { Avatar, Button, Card, SearchInput, Text, formStyles } from '../../../../components';
import type { ExamAudience, ManagedExam } from '../../../../types';
import { searchKey } from '../../question-banks/questionMeta';
import { saveExamCandidates, updateExam } from '../data/examApi';
import type { CandidateList } from '../data/examApi';
import styles from './ExamCandidatesPanel.module.css';

interface ExamCandidatesPanelProps {
  exam: ManagedExam;
  candidates: CandidateList | null;
  loading: boolean;
  /** Kayıttan sonra ayrıntı ve aday listesi tazelenir. */
  onSaved: () => void;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export function ExamCandidatesPanel({ exam, candidates, loading, onSaved }: ExamCandidatesPanelProps) {
  const students = candidates?.students ?? [];
  const [audience, setAudience] = useState<ExamAudience>(exam.audience);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sunucudaki seçim ve mod geldiğinde (veya kayıttan sonra) yerel durum eşitlenir.
  useEffect(() => {
    setSelected(new Set(candidates?.students.filter((s) => s.selected).map((s) => s.id) ?? []));
  }, [candidates]);
  useEffect(() => {
    setAudience(exam.audience);
  }, [exam.audience]);

  const serverSelected = new Set(students.filter((s) => s.selected).map((s) => s.id));
  const dirty = audience !== exam.audience || (audience === 'SELECTED' && !sameSet(selected, serverSelected));

  // Seçim modunda satır, onay kutusunun etiketidir; salt okunur listede düz kapsayıcıdır.
  const Row = audience === 'SELECTED' ? 'label' : 'div';

  const term = searchKey(search.trim());
  const visible = students.filter((s) => !term || searchKey(`${s.name} ${s.email}`).includes(term));
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of visible) {
        if (allVisibleSelected) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (audience === 'SELECTED') {
        // Önce liste, sonra mod: yayındaki sınav hiçbir an "seçili ama boş" duruma düşmez.
        await saveExamCandidates(exam.id, [...selected]);
        if (exam.audience !== 'SELECTED') await updateExam(exam.id, { audience: 'SELECTED' });
      } else if (exam.audience !== 'COURSE') {
        await updateExam(exam.id, { audience: 'COURSE' });
      }
      setNotice('Öğrenci ayarları kaydedildi.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Öğrenci ayarları kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <fieldset className={formStyles.fieldset}>
        <legend>
          <Text role="label-lg" as="span">
            Sınava kimler girecek?
          </Text>
        </legend>
        <label className={formStyles.choice}>
          <input type="radio" name="audience" checked={audience === 'COURSE'} onChange={() => setAudience('COURSE')} />
          <span className={formStyles.choiceText}>
            <Text role="body-md" as="span" weight="semibold">
              Kursa kayıtlı tüm öğrenciler
            </Text>
            <Text role="body-sm" as="span" tone="muted">
              {exam.course.title} kursuna kayıtlı herkes; sonradan kaydolanlar da dahil.
            </Text>
          </span>
        </label>
        <label className={formStyles.choice}>
          <input type="radio" name="audience" checked={audience === 'SELECTED'} onChange={() => setAudience('SELECTED')} />
          <span className={formStyles.choiceText}>
            <Text role="body-md" as="span" weight="semibold">
              Yalnızca seçilen öğrenciler
            </Text>
            <Text role="body-sm" as="span" tone="muted">
              ör. bütünleme veya mazeret sınavı için. Yalnızca kursa kayıtlı öğrenciler seçilebilir.
            </Text>
          </span>
        </label>
      </fieldset>

      <Card padding="md" elevation="1">
        <div className={styles.listHeader}>
          <Text role="title-md" as="h2">
            {audience === 'COURSE'
              ? `Kayıtlı öğrenciler (${students.length})`
              : `Seçili öğrenciler: ${selected.size} / ${students.length}`}
          </Text>
          {audience === 'SELECTED' && students.length > 0 && (
            <Button variant="ghost" size="sm" onClick={toggleVisible}>
              {allVisibleSelected ? 'Listelenenlerin seçimini kaldır' : 'Listelenenlerin tümünü seç'}
            </Button>
          )}
        </div>

        {students.length > 5 && (
          <SearchInput
            label="Öğrenci ara"
            placeholder="Ad veya e-posta ile ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.search}
          />
        )}

        {loading && students.length === 0 && (
          <Text role="body-md" tone="muted" as="p">
            Yükleniyor…
          </Text>
        )}
        {!loading && students.length === 0 && (
          <Text role="body-md" tone="muted" as="p">
            Bu kursa henüz kayıtlı öğrenci yok.
          </Text>
        )}

        <ul className={styles.list}>
          {visible.map((student) => (
            <li key={student.id}>
              <Row className={[styles.student, audience === 'COURSE' ? styles.readOnly : ''].join(' ')}>
                {audience === 'SELECTED' && (
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={(event) => toggle(student.id, event.target.checked)}
                  />
                )}
                <Avatar name={student.name} src={student.avatarUrl ?? undefined} />
                <span className={styles.identity}>
                  <Text role="label-lg" tone="main">
                    {student.name}
                  </Text>
                  <Text role="body-sm" tone="muted" className={styles.email}>
                    {student.email}
                  </Text>
                </span>
              </Row>
            </li>
          ))}
        </ul>
      </Card>

      <div aria-live="polite">
        {error && (
          <div className={formStyles.error} role="alert">
            <Text role="body-sm" tone="error" as="p">
              {error}
            </Text>
          </div>
        )}
        {notice && !dirty && (
          <div className={formStyles.success}>
            <Text role="body-sm" tone="success" as="p">
              {notice}
            </Text>
          </div>
        )}
      </div>

      <div className={formStyles.actions}>
        <Button
          variant="ghost"
          disabled={!dirty || busy}
          onClick={() => {
            setAudience(exam.audience);
            setSelected(serverSelected);
            setError(null);
          }}
        >
          Değişiklikleri geri al
        </Button>
        <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </div>
  );
}
