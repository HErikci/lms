import { Badge, Card, Icon, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import styles from './AssignmentsPage.module.css';

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded' | 'late';
  description: string;
}

const assignments: Assignment[] = [
  {
    id: 'assign-1',
    title: 'Veri Yapıları Proje Ödevi 2',
    course: 'CENG 201',
    dueDate: '30 Ekim 23:59',
    status: 'pending',
    description: 'Dengeli Ağaç (AVL Tree) Gerçekleştirimi',
  },
  {
    id: 'assign-2',
    title: 'SQL Pratik Sorular',
    course: 'SWE 212',
    dueDate: '25 Ekim 23:59',
    status: 'submitted',
    description: 'GROUP BY, JOIN, Aggregate Functions',
  },
  {
    id: 'assign-3',
    title: 'Yapay Zekâ Mini Proje',
    course: 'AI 304',
    dueDate: '31 Ekim 17:00',
    status: 'pending',
    description: 'Lineer Regresyon ile Tahminleme Notebook',
  },
  {
    id: 'assign-4',
    title: 'Matematiksel Analiz Problem Seti 5',
    course: 'MATH 301',
    dueDate: '18 Ekim 23:59',
    status: 'graded',
    description: '15 problem · Puan: 92/100',
  },
];

function getStatusInfo(status: Assignment['status']) {
  switch (status) {
    case 'pending':
      return { tone: 'warning' as const, label: 'Teslim Bekleniyor' };
    case 'submitted':
      return { tone: 'cyan' as const, label: 'Teslim Edildi' };
    case 'graded':
      return { tone: 'success' as const, label: 'Puanlandı' };
    case 'late':
      return { tone: 'error' as const, label: 'Gecikmiş' };
  }
}

export function AssignmentsPage() {
  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Ödevler & Notlar
        </Text>
        <Text role="body-md" tone="muted" as="p">
          {assignments.filter((a) => a.status === 'pending').length} teslim beklemede · {assignments.length} toplam
        </Text>
      </div>

      <div className={styles.list}>
        {assignments.map((assign) => {
          const { tone, label } = getStatusInfo(assign.status);
          return (
            <Card key={assign.id} padding="lg" elevation="1">
              <a href="#" className={styles.assignmentItem}>
                <div className={styles.assignmentHeader}>
                  <div>
                    <Text role="label-md" tone="secondary">
                      {assign.course}
                    </Text>
                    <Text role="title-md" as="h3">
                      {assign.title}
                    </Text>
                    <Text role="body-sm" tone="muted">
                      {assign.description}
                    </Text>
                  </div>
                  <Badge tone={tone} variant="soft">
                    {label}
                  </Badge>
                </div>

                <div className={styles.assignmentFooter}>
                  <div className={styles.dueDate}>
                    <Icon name="schedule" size="sm" />
                    <Text role="body-sm" tone="muted">
                      {assign.dueDate}
                    </Text>
                  </div>
                  <Icon name="arrow_forward" size="sm" />
                </div>
              </a>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
