import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Icon, IconButton, Panel, Text } from '../../../components';
import { PageContainer } from '../../../layout/PageContainer';
import { CONTENT_TYPE_LABELS } from '../../courses/contentType';
import { useCourseContent } from './data/useCourseContent';
import { useCourseInstructors } from './data/useCourseInstructors';
import type {
  ContentLesson,
  ContentModule,
  LessonInput,
  ModuleInput,
} from './data/useCourseContent';
import { ModuleForm } from './components/ModuleForm';
import { LessonForm } from './components/LessonForm';
import styles from './CourseContentPage.module.css';

type ModuleEditState = 'none' | 'create' | string;
type LessonEditState = { moduleId: string; mode: 'create' | string } | null;

export function CourseContentPage() {
  const { id } = useParams<{ id: string }>();
  const {
    modules,
    loading,
    error,
    createModule,
    updateModule,
    deleteModule,
    createLesson,
    updateLesson,
    deleteLesson,
  } = useCourseContent(id);

  const {
    instructors,
    available,
    loading: instructorsLoading,
    error: instructorsError,
    addInstructor,
    removeInstructor,
    reorderInstructors,
  } = useCourseInstructors(id);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [instructorBusy, setInstructorBusy] = useState(false);
  const [instructorActionError, setInstructorActionError] = useState<string | null>(null);

  const runInstructorAction = async (action: () => Promise<void>, fallback: string) => {
    setInstructorBusy(true);
    setInstructorActionError(null);
    try {
      await action();
    } catch (err) {
      setInstructorActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setInstructorBusy(false);
    }
  };

  const handleAddInstructor = () => {
    if (!selectedInstructor) return;
    return runInstructorAction(async () => {
      await addInstructor(selectedInstructor);
      setSelectedInstructor('');
    }, 'Eğitmen eklenemedi.');
  };

  const handleMoveInstructor = (index: number, delta: -1 | 1) => {
    const ids = instructors.map((instructor) => instructor.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return runInstructorAction(() => reorderInstructors(ids), 'Sıralama güncellenemedi.');
  };

  const [moduleEdit, setModuleEdit] = useState<ModuleEditState>('none');
  const [lessonEdit, setLessonEdit] = useState<LessonEditState>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateModule = async (input: ModuleInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await createModule(input);
      setModuleEdit('none');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Modül oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateModule = async (moduleId: string, input: ModuleInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await updateModule(moduleId, input);
      setModuleEdit('none');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Modül güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (module: ContentModule) => {
    const confirmed = window.confirm(
      `"${module.title}" modülünü silmek istediğinize emin misiniz? Modüldeki tüm dersler de silinecek.`,
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      await deleteModule(module.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Modül silinemedi.');
    }
  };

  const handleCreateLesson = async (moduleId: string, input: LessonInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await createLesson(moduleId, input);
      setLessonEdit(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ders oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLesson = async (moduleId: string, lessonId: string, input: LessonInput) => {
    setSaving(true);
    setActionError(null);
    try {
      await updateLesson(moduleId, lessonId, input);
      setLessonEdit(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ders güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (moduleId: string, lesson: ContentLesson) => {
    const confirmed = window.confirm(`"${lesson.title}" dersini silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    setActionError(null);
    try {
      await deleteLesson(moduleId, lesson.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ders silinemedi.');
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <Link to="/yonetim/kurslar" className={styles.backLink}>
          <Text role="label-md" as="span" tone="secondary">
            ← Kurs Yönetimine Dön
          </Text>
        </Link>
        <Text role="headline-lg" as="h1">
          İçerik Yönetimi
        </Text>
        {!loading && !error && (
          <Text role="body-md" tone="muted" as="p">
            {modules.length} modül
          </Text>
        )}
      </div>

      {actionError && (
        <Text role="body-md" tone="error" as="p">
          {actionError}
        </Text>
      )}

      <div className={styles.instructorPanel}>
      <Panel title="Eğitmenler" icon="school">
        {instructorsLoading && <Text role="body-md">Yükleniyor…</Text>}
        {!instructorsLoading && instructorsError && (
          <Text role="body-md" tone="error" as="p">
            {instructorsError}
          </Text>
        )}
        {instructorActionError && (
          <Text role="body-md" tone="error" as="p">
            {instructorActionError}
          </Text>
        )}
        {!instructorsLoading && !instructorsError && instructors.length === 0 && (
          <Text role="body-md" tone="muted" as="p">
            Henüz eğitmen atanmamış.
          </Text>
        )}
        {instructors.length > 0 && (
          <ol className={styles.instructorList}>
            {instructors.map((instructor, index) => (
              <li key={instructor.id} className={styles.instructorRow}>
                <Text role="label-md" tone="muted" as="span" className={styles.instructorPosition}>
                  {index + 1}
                </Text>
                <Avatar name={instructor.name} src={instructor.avatarUrl ?? undefined} />
                <Text role="body-md" as="span" className={styles.instructorName}>
                  {instructor.name}
                </Text>
                <div className={styles.actions}>
                  <IconButton
                    icon="arrow_upward"
                    label={`${instructor.name} eğitmenini yukarı taşı`}
                    disabled={index === 0 || instructorBusy}
                    onClick={() => handleMoveInstructor(index, -1)}
                  />
                  <IconButton
                    icon="arrow_downward"
                    label={`${instructor.name} eğitmenini aşağı taşı`}
                    disabled={index === instructors.length - 1 || instructorBusy}
                    onClick={() => handleMoveInstructor(index, 1)}
                  />
                  <IconButton
                    icon="delete"
                    label={`${instructor.name} eğitmenini kaldır`}
                    disabled={instructorBusy}
                    onClick={() =>
                      runInstructorAction(
                        () => removeInstructor(instructor.id),
                        'Eğitmen kaldırılamadı.',
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className={styles.instructorAdd}>
          <label className={styles.instructorSelectLabel}>
            <Text role="label-md" as="span" tone="muted">
              Eğitmen seç
            </Text>
            <select
              className={styles.select}
              value={selectedInstructor}
              onChange={(event) => setSelectedInstructor(event.target.value)}
              disabled={instructorBusy}
            >
              <option value="">Eğitmen seçin…</option>
              {available.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.email})
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            iconStart="add"
            onClick={handleAddInstructor}
            disabled={!selectedInstructor || instructorBusy}
          >
            Ekle
          </Button>
        </div>
      </Panel>
      </div>

      {loading && <Text role="body-md">Yükleniyor…</Text>}
      {!loading && error && (
        <Text role="body-md" tone="error">
          {error}
        </Text>
      )}

      {!loading && !error && (
        <>
          <div className={styles.addModule}>
            <Button
              variant="primary"
              iconStart="add"
              onClick={() => setModuleEdit(moduleEdit === 'create' ? 'none' : 'create')}
            >
              Yeni Modül
            </Button>
          </div>

          {moduleEdit === 'create' && (
            <Card padding="lg" elevation="1" className={styles.formCard}>
              <Text role="title-md" as="h2" tone="main">
                Yeni Modül Oluştur
              </Text>
              <ModuleForm
                saving={saving}
                onCancel={() => setModuleEdit('none')}
                onSubmit={handleCreateModule}
              />
            </Card>
          )}

          {modules.length === 0 && (
            <Text role="body-md">Bu kurs için henüz modül eklenmemiş.</Text>
          )}

          <div className={styles.list}>
            {modules.map((module) => (
              <Panel key={module.id} title={module.title} icon="menu_book">
                <div className={styles.moduleActions}>
                  <Text role="body-sm" tone="muted">
                    Sıra: {module.order}
                  </Text>
                  <div className={styles.actions}>
                    <IconButton
                      icon="edit"
                      label="Modülü Düzenle"
                      onClick={() => setModuleEdit(moduleEdit === module.id ? 'none' : module.id)}
                    />
                    <IconButton
                      icon="delete"
                      label="Modülü Sil"
                      onClick={() => handleDeleteModule(module)}
                    />
                  </div>
                </div>

                {moduleEdit === module.id && (
                  <div className={styles.editPanel}>
                    <ModuleForm
                      module={module}
                      saving={saving}
                      onCancel={() => setModuleEdit('none')}
                      onSubmit={(input) => handleUpdateModule(module.id, input)}
                    />
                  </div>
                )}

                <div className={styles.lessonList}>
                  {module.lessons.map((lesson) => (
                    <Card key={lesson.id} padding="md" elevation="1">
                      <div className={styles.row}>
                        <div className={styles.info}>
                          <div className={styles.titleLine}>
                            <Text role="title-md" as="h3" tone="main">
                              {lesson.title}
                            </Text>
                            <Badge tone="neutral" variant="soft">
                              {CONTENT_TYPE_LABELS[lesson.contentType]}
                            </Badge>
                            <Badge tone={lesson.status === 'PUBLISHED' ? 'success' : 'neutral'} variant="soft">
                              {lesson.status === 'PUBLISHED' ? 'Yayınlandı' : 'Taslak'}
                            </Badge>
                          </div>
                          {lesson.description && (
                            <Text role="body-sm" tone="muted">
                              {lesson.description}
                            </Text>
                          )}
                          <Text role="body-sm" tone="muted">
                            Sıra: {lesson.order}
                          </Text>
                        </div>
                        <div className={styles.actions}>
                          {lesson.contentType === 'QUIZ' && id && (
                            <Link
                              to={`/yonetim/kurslar/${id}/dersler/${lesson.id}/notlar`}
                              className={styles.gradeLink}
                              aria-label={`Notlar: ${lesson.title}`}
                            >
                              <Icon name="grading" size="sm" />
                              <Text role="label-md" as="span" tone="secondary">
                                Notlar
                              </Text>
                            </Link>
                          )}
                          <IconButton
                            icon="edit"
                            label="Dersi Düzenle"
                            onClick={() =>
                              setLessonEdit(
                                lessonEdit?.moduleId === module.id && lessonEdit.mode === lesson.id
                                  ? null
                                  : { moduleId: module.id, mode: lesson.id },
                              )
                            }
                          />
                          <IconButton
                            icon="delete"
                            label="Dersi Sil"
                            onClick={() => handleDeleteLesson(module.id, lesson)}
                          />
                        </div>
                      </div>

                      {lessonEdit?.moduleId === module.id && lessonEdit.mode === lesson.id && (
                        <div className={styles.editPanel}>
                          <LessonForm
                            lesson={lesson}
                            saving={saving}
                            onCancel={() => setLessonEdit(null)}
                            onSubmit={(input) => handleUpdateLesson(module.id, lesson.id, input)}
                          />
                        </div>
                      )}
                    </Card>
                  ))}

                  {module.lessons.length === 0 && lessonEdit?.moduleId !== module.id && (
                    <Text role="body-sm" tone="muted">
                      Bu modülde henüz ders yok.
                    </Text>
                  )}

                  {lessonEdit?.moduleId === module.id && lessonEdit.mode === 'create' ? (
                    <Card padding="md" elevation="1" className={styles.formCard}>
                      <Text role="title-md" as="h3" tone="main">
                        Yeni Ders Oluştur
                      </Text>
                      <LessonForm
                        saving={saving}
                        onCancel={() => setLessonEdit(null)}
                        onSubmit={(input) => handleCreateLesson(module.id, input)}
                      />
                    </Card>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconStart="add"
                      onClick={() => setLessonEdit({ moduleId: module.id, mode: 'create' })}
                    >
                      Yeni Ders
                    </Button>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
