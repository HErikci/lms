/**
 * Sınav modülü örnek verisi: seed.ts ve mevcut veritabanına ekleme betiği aynı içeriği kullanır.
 * İçerik biçimleri src/lib/questions.ts'teki ContentByType ile birebir aynıdır.
 */
export interface SeedQuestion {
  type: string;
  stem: string;
  content: unknown;
  explanation?: string;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  points: number;
}

export const REACT_BANK = {
  name: 'React Temelleri Soru Bankası',
  description: 'Hooks, JSX, props ve listeler konularında farklı tiplerde sorular.',
};

export const REACT_QUESTIONS: SeedQuestion[] = [
  {
    type: 'SINGLE_CHOICE',
    stem: 'React’te bir bileşenin yerel durumunu (state) yönetmek için hangi Hook kullanılır?',
    content: {
      options: [
        { id: 'a', text: 'useState', correct: true },
        { id: 'b', text: 'useEffect', correct: false },
        { id: 'c', text: 'useRef', correct: false },
        { id: 'd', text: 'useMemo', correct: false },
      ],
    },
    explanation: 'useState, bileşene yeniden render tetikleyen bir durum değeri ve güncelleyici fonksiyon sağlar.',
    topic: 'Hooks',
    difficulty: 'EASY',
    points: 2,
  },
  {
    type: 'MULTIPLE_CHOICE',
    stem: 'Aşağıdakilerden hangileri React’in yerleşik Hook’larıdır?',
    content: {
      options: [
        { id: 'a', text: 'useState', correct: true },
        { id: 'b', text: 'useEffect', correct: true },
        { id: 'c', text: 'useFetch', correct: false },
        { id: 'd', text: 'useContext', correct: true },
      ],
    },
    explanation: 'useFetch yerleşik değildir; genellikle özel (custom) Hook olarak yazılır.',
    topic: 'Hooks',
    difficulty: 'MEDIUM',
    points: 3,
  },
  {
    type: 'TRUE_FALSE',
    stem: 'JSX, tarayıcıda dönüştürülmeden doğrudan çalıştırılabilen standart JavaScript sözdizimidir.',
    content: { correctAnswer: false },
    explanation: 'JSX, Babel veya TypeScript gibi araçlarla React.createElement çağrılarına dönüştürülür.',
    topic: 'JSX',
    difficulty: 'EASY',
    points: 1,
  },
  {
    type: 'FILL_BLANK',
    stem: 'Bir listeyi render ederken her öğeye kardeşleri arasında benzersiz bir ___ prop’u verilmelidir.',
    content: { blanks: [{ accepted: ['key'] }], caseSensitive: false },
    explanation: 'key, React’in hangi öğenin değiştiğini, eklendiğini veya silindiğini belirlemesini sağlar.',
    topic: 'Listeler',
    difficulty: 'EASY',
    points: 2,
  },
  {
    type: 'MATCHING',
    stem: 'Hook’ları kullanım amaçlarıyla eşleştirin.',
    content: {
      pairs: [
        { id: 'p1', left: 'useState', right: 'Durum yönetimi' },
        { id: 'p2', left: 'useEffect', right: 'Yan etkiler (veri çekme, abonelik)' },
        { id: 'p3', left: 'useRef', right: 'DOM öğesine referans' },
      ],
    },
    topic: 'Hooks',
    difficulty: 'MEDIUM',
    points: 3,
  },
  {
    type: 'SHORT_ANSWER',
    stem: 'Üst bileşenden alt bileşene aktarılan salt okunur verilere ne ad verilir?',
    content: { accepted: ['props', 'prop'], caseSensitive: false },
    topic: 'Props',
    difficulty: 'EASY',
    points: 2,
  },
  {
    type: 'ESSAY',
    stem: 'Sanal DOM’un (Virtual DOM) uygulama performansına katkısını kendi cümlelerinizle açıklayın.',
    content: { rubric: 'Kavramın doğru tanımı (3 puan)\nUzlaştırma (reconciliation) sürecinin açıklanması (4 puan)\nSomut bir örnek (3 puan)' },
    topic: 'Performans',
    difficulty: 'HARD',
    points: 10,
  },
];

export const GENERAL_BANK = {
  name: 'Genel Yazılım Bilgisi',
  description: 'Tüm kursların sınavlarında kullanılabilen ortak sorular.',
};

export const GENERAL_QUESTIONS: SeedQuestion[] = [
  {
    type: 'TRUE_FALSE',
    stem: 'HTTP 404 durum kodu, istenen kaynağın sunucuda bulunamadığını belirtir.',
    content: { correctAnswer: true },
    topic: 'Web',
    difficulty: 'EASY',
    points: 1,
  },
  {
    type: 'SINGLE_CHOICE',
    stem: 'Git’te yeni bir dal oluşturup o dala geçen komut hangisidir?',
    content: {
      options: [
        { id: 'a', text: 'git checkout -b yeni-dal', correct: true },
        { id: 'b', text: 'git branch -d yeni-dal', correct: false },
        { id: 'c', text: 'git merge yeni-dal', correct: false },
        { id: 'd', text: 'git init yeni-dal', correct: false },
      ],
    },
    topic: 'Git',
    difficulty: 'MEDIUM',
    points: 2,
  },
];

interface SeedExamOptions {
  /** React kursu: banka, sınavlar ve öğrenciler bu kursa bağlanır. */
  courseId: string;
  /** Kurs bankasını ve sınavları oluşturan eğitmen. */
  instructorId: string;
  /** Genel bankayı oluşturan yönetici. */
  adminId: string;
}

/** Soru bankalarını, soruları ve iki örnek sınavı (biri yayında, biri taslak) oluşturur. */
export async function seedExamData(prisma: import('@prisma/client').PrismaClient, opts: SeedExamOptions) {
  const createBank = async (bank: { name: string; description: string }, courseId: string | null, authorId: string, questions: SeedQuestion[]) => {
    const created = await prisma.questionBank.create({ data: { ...bank, courseId, createdById: authorId } });
    const ids: string[] = [];
    for (const question of questions) {
      const row = await prisma.question.create({
        data: { ...question, content: JSON.stringify(question.content), bankId: created.id, createdById: authorId },
      });
      ids.push(row.id);
    }
    return ids;
  };

  const reactIds = await createBank(REACT_BANK, opts.courseId, opts.instructorId, REACT_QUESTIONS);
  const generalIds = await createBank(GENERAL_BANK, null, opts.adminId, GENERAL_QUESTIONS);
  const pointsOf = (ids: string[], source: SeedQuestion[]) => ids.map((id, index) => ({ id, points: source[index].points }));

  const day = 24 * 60 * 60 * 1000;
  const at = (offsetDays: number, hour: number) => {
    const date = new Date(Date.now() + offsetDays * day);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const createExam = async (data: Record<string, unknown>, questions: { id: string; points: number }[]) => {
    const exam = await prisma.exam.create({
      data: { ...(data as { title: string }), courseId: opts.courseId, createdById: opts.instructorId },
    });
    await prisma.examQuestion.createMany({
      data: questions.map((question, index) => ({
        examId: exam.id,
        questionId: question.id,
        position: index + 1,
        points: question.points,
      })),
    });
  };

  // Objektif sorulardan oluşan, şu an açık kısa sınav.
  await createExam(
    {
      title: 'React Temelleri Kısa Sınavı',
      description: 'Hooks, JSX, listeler ve props konularını kapsar.',
      type: 'QUIZ',
      status: 'PUBLISHED',
      startsAt: at(-1, 9),
      endsAt: at(7, 23),
      durationMinutes: 30,
      maxAttempts: 2,
      passingScore: 60,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
    pointsOf(reactIds.slice(0, 6), REACT_QUESTIONS.slice(0, 6)),
  );
  // Açık uçlu soru ve genel banka sorularını da içeren, henüz yayınlanmamış ara sınav.
  await createExam(
    {
      title: 'React Ara Sınavı',
      description: 'Dönem ortası değerlendirmesi. Açık uçlu soru eğitmen tarafından puanlanır.',
      type: 'MIDTERM',
      status: 'DRAFT',
      startsAt: at(14, 10),
      endsAt: at(14, 12),
      durationMinutes: 90,
      passingScore: 50,
    },
    [...pointsOf(reactIds, REACT_QUESTIONS), ...pointsOf(generalIds, GENERAL_QUESTIONS)],
  );
}
