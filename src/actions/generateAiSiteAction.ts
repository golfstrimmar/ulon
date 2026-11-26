"use server";

import fs from "fs";
import path from "path";
import type { HtmlNode } from "@/types/HtmlNode";

const PLACEHOLDER_IMG_SRC =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500' fill='%23f1f5f9'><rect width='800' height='500' fill='%23e2e8f0'/><g fill='%2394a3b8'><circle cx='340' cy='200' r='40'/><path d='M220 360h360l-110-150-80 100-50-65-120 115z'/></g><text x='50%25' y='86%25' font-family='sans-serif' font-size='18' font-weight='600' fill='%2394a3b8' text-anchor='middle'>Placeholder Image</text></svg>";

export interface GenerateSiteParams {
  prompt: string;
  themeStyle?: string;
}

export interface GenerateSiteResult {
  success: boolean;
  nodes?: HtmlNode[];
  summary?: string;
  error?: string;
}

interface ComponentPlan {
  component: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  logoText?: string;
  navLinks?: string[];
  cards?: Array<{ title: string; desc: string }>;
  tabs?: Array<{ title: string; content: string }>;
  items?: Array<{ title?: string; desc?: string; question?: string; answer?: string }>;
}

export interface ThemeConfig {
  id: string;
  name: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  bg: string;
  cardBg: string;
  titleColor: string;
  textColor: string;
  borderColor: string;
  isDark: boolean;
}

interface SitePlan {
  theme: ThemeConfig;
  summary: string;
  sections: ComponentPlan[];
}

const THEME_PALETTES: Record<string, ThemeConfig> = {
  emerald: {
    id: "emerald",
    name: "Изумрудный эко",
    accent: "#10b981",
    accentHover: "#059669",
    accentSubtle: "rgba(16, 185, 129, 0.12)",
    bg: "#f0fdf4",
    cardBg: "#ffffff",
    titleColor: "#064e3b",
    textColor: "#374151",
    borderColor: "#bbf7d0",
    isDark: false,
  },
  dark: {
    id: "dark",
    name: "Тёмный премиум",
    accent: "#f59e0b",
    accentHover: "#d97706",
    accentSubtle: "rgba(245, 158, 11, 0.15)",
    bg: "#090d16",
    cardBg: "#131b2e",
    titleColor: "#f8fafc",
    textColor: "#94a3b8",
    borderColor: "#1e293b",
    isDark: true,
  },
  "light-blue": {
    id: "light-blue",
    name: "Светлый деловой",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    accentSubtle: "rgba(37, 99, 235, 0.1)",
    bg: "#f8fafc",
    cardBg: "#ffffff",
    titleColor: "#0f172a",
    textColor: "#475569",
    borderColor: "#e2e8f0",
    isDark: false,
  },
  purple: {
    id: "purple",
    name: "Неоновый фиолетовый",
    accent: "#8b5cf6",
    accentHover: "#7c3aed",
    accentSubtle: "rgba(139, 92, 246, 0.15)",
    bg: "#09090b",
    cardBg: "#141419",
    titleColor: "#fafafa",
    textColor: "#a1a1aa",
    borderColor: "#27272a",
    isDark: true,
  },
  "warm-orange": {
    id: "warm-orange",
    name: "Тёплый крафт",
    accent: "#ea580c",
    accentHover: "#c2410c",
    accentSubtle: "rgba(234, 88, 12, 0.12)",
    bg: "#fffbeb",
    cardBg: "#ffffff",
    titleColor: "#78350f",
    textColor: "#92400e",
    borderColor: "#fed7aa",
    isDark: false,
  },
};

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
];

const COMPONENT_PATHS: Record<string, string> = {
  header: "public/json/sections/header.json",
  hero: "public/json/sections/hero.json",
  cards: "public/json/sections/cards.json",
  "cards-more": "public/json/sections/cards-more.json",
  "tabs-horisontal": "public/json/sections/tabs-horisontal.json",
  tabs: "public/json/sections/tabs.json",
  carousel: "public/json/sliders/carousel.json",
  slider: "public/json/sliders/slider.json",
  accordion: "public/json/sections/accordion.json",
  form: "public/json/sections/contact-form.json",
  footer: "public/json/sections/footer.json",
};

const SYSTEM_PROMPT = `You are a web architect. Return ONLY valid JSON for landing page blueprint.
Available sections: header, hero, cards-more, tabs-horisontal, carousel, accordion, form, footer.
JSON schema:
{
  "summary": "Brief 1-line summary",
  "sections": [
    { "component": "header", "logoText": "Brand", "navLinks": ["Services", "Prices", "Reviews", "Contacts"], "buttonText": "Action" },
    { "component": "hero", "title": "Headline", "subtitle": "Subheadline", "buttonText": "Button" },
    { "component": "cards-more", "title": "Our Services", "cards": [{"title": "Item 1", "desc": "Desc 1"}, {"title": "Item 2", "desc": "Desc 2"}, {"title": "Item 3", "desc": "Desc 3"}, {"title": "Item 4", "desc": "Desc 4"}, {"title": "Item 5", "desc": "Desc 5"}, {"title": "Item 6", "desc": "Desc 6"}] },
    { "component": "tabs-horisontal", "title": "Tariffs / Categories", "tabs": [{"title": "Tab 1", "content": "Details 1"}, {"title": "Tab 2", "content": "Details 2"}, {"title": "Tab 3", "content": "Details 3"}] },
    { "component": "carousel", "title": "Testimonials", "items": [{"title": "Client 1", "desc": "Review 1"}, {"title": "Client 2", "desc": "Review 2"}, {"title": "Client 3", "desc": "Review 3"}] },
    { "component": "accordion", "title": "FAQ", "items": [{"question": "Q1?", "answer": "A1."}, {"question": "Q2?", "answer": "A2."}, {"question": "Q3?", "answer": "A3."}] },
    { "component": "form", "title": "Get Started", "subtitle": "Leave your contacts", "buttonText": "Submit" },
    { "component": "footer", "title": "Brand", "subtitle": "All rights reserved 2026" }
  ]
}`;

function resolveTheme(themeId?: string, promptText: string = ""): ThemeConfig {
  if (themeId && themeId !== "auto" && THEME_PALETTES[themeId]) {
    return THEME_PALETTES[themeId];
  }

  const p = promptText.toLowerCase();
  if (p.includes("барбер") || p.includes("темн") || p.includes("dark") || p.includes("брутал")) {
    return THEME_PALETTES.dark;
  }
  if (p.includes("фитнес") || p.includes("эко") || p.includes("зелен") || p.includes("здоров")) {
    return THEME_PALETTES.emerald;
  }
  if (p.includes("кофе") || p.includes("еда") || p.includes("пекарн") || p.includes("крафт")) {
    return THEME_PALETTES["warm-orange"];
  }
  if (p.includes("кибер") || p.includes("гейм") || p.includes("неон")) {
    return THEME_PALETTES.purple;
  }
  return THEME_PALETTES["light-blue"];
}

function buildSmartFallbackPlan(prompt: string, theme: ThemeConfig): SitePlan {
  const p = prompt.toLowerCase();

  if (p.includes("барбер") || p.includes("стрижк") || p.includes("бород")) {
    return {
      theme,
      summary: "Премиальный лендинг барбершопа и мужского груминга",
      sections: [
        {
          component: "header",
          logoText: "BARBER CRAFT",
          navLinks: ["Услуги", "Цены", "Мастера", "Отзывы", "Контакты"],
          buttonText: "Онлайн-запись",
        },
        {
          component: "hero",
          title: "Классические стрижки и королевское бритье",
          subtitle: "Премиальный мужской клуб в центре города. Высочайшее мастерство, авторские напитки и безупречная атмосфера.",
          buttonText: "Записаться к мастеру",
        },
        {
          component: "cards-more",
          title: "Наши услуги и процедуры",
          cards: [
            { title: "Мужская стрижка", desc: "Мытье головы, индивидуальный подбор формы, укладка премиальной косметикой." },
            { title: "Моделирование бороды", desc: "Придание четких контуров, распаривание с маслами и уход за кожей." },
            { title: "Королевское бритье", desc: "Традиционное бритье опасной бритвой с горячими компрессами." },
            { title: "Стрижка + Борода", desc: "Комплексный уход за образом для максимальной уверенности." },
            { title: "Камуфляж седины", desc: "Естественное деликатное тонирование без эффекта окрашивания." },
            { title: "Папа + Сын", desc: "Фирменные стрижки для двоих в дружеской атмосфере клуба." },
          ],
        },
        {
          component: "tabs-horisontal",
          title: "Тарифные пакеты",
          tabs: [
            { title: "Барбер", content: "Опытный мастер салона. Стрижка любой сложности, укладка и базовый уход." },
            { title: "Топ-барбер", content: "Мастер высокой квалификации. Персональный подбор стиля и премиальный уход." },
            { title: "Шеф-барбер", content: "Основатель школы барберинга. Исключительный сервис и VIP-напитки." },
          ],
        },
        {
          component: "carousel",
          title: "Отзывы наших гостей",
          items: [
            { title: "Александр Соколов", desc: "Лучший сервис в городе! Отличный фейд, борода оформлена безупречно." },
            { title: "Дмитрий Новиков", desc: "Приятная атмосфера, классная музыка и профессионалы своего дела. Рекомендую!" },
            { title: "Михаил Васильев", desc: "Ходим с сыном уже два года только сюда. Всегда идеальный результат." },
          ],
        },
        {
          component: "accordion",
          title: "Часто задаваемые вопросы",
          items: [
            { question: "Нужно ли записываться заранее?", answer: "Мы рекомендуем предварительную запись через сайт, чтобы выбрать удобное время и любимого мастера." },
            { question: "Какую мужскую косметику вы используете?", answer: "Мы работаем только с премиальными брендами из Великобритании и США (Suavecito, Reuzel, Proraso)." },
            { question: "Есть ли парковка рядом с салоном?", answer: "Да, для наших клиентов предусмотрена бесплатная закрытая парковка во дворе." },
          ],
        },
        {
          component: "form",
          title: "Запишитесь на стрижку онлайн",
          subtitle: "Оставьте телефон — администратор свяжется с вами в течение 5 минут для подтверждения времени.",
          buttonText: "Подтвердить запись",
        },
        {
          component: "footer",
          title: "BARBER CRAFT",
          subtitle: "© 2026 Все права защищены. Мужские стрижки со знаком качества.",
        },
      ],
    };
  }

  if (p.includes("фитнес") || p.includes("спорт") || p.includes("зал") || p.includes("тренер")) {
    return {
      theme,
      summary: "Современный лендинг премиум фитнес-клуба",
      sections: [
        {
          component: "header",
          logoText: "FITNESS PRO",
          navLinks: ["Направления", "Абонементы", "Тренеры", "Расписание", "Контакты"],
          buttonText: "Пробный визит",
        },
        {
          component: "hero",
          title: "Твое идеальное тело начинается здесь",
          subtitle: "Более 2500 м² инновационного тренировочного пространства, бассейн с морской водой и персональные программы тренировок.",
          buttonText: "Начать тренировки",
        },
        {
          component: "cards-more",
          title: "Направления клуба",
          cards: [
            { title: "Тренажерный зал", desc: "Премиальная линейка тренажеров Hammer Strength и Life Fitness." },
            { title: "Кардио-зона", desc: "Беговые дорожки и эллипсы с панорамным видом на город." },
            { title: "Кроссфит и Функционал", desc: "Оборудованная зона для высокоинтенсивных тренировок." },
            { title: "Йога и Пилатес", desc: "Гармония тела и разума в просторном зале со специальным светом." },
            { title: "Бассейн и СПА", desc: "25-метровый бассейн, хаммам, финская сауна и гидромассаж." },
            { title: "Бойцовский клуб", desc: "Ринг, татами и тренировки по боксу с чемпионами спорта." },
          ],
        },
        {
          component: "tabs-horisontal",
          title: "Клубные карты",
          tabs: [
            { title: "Дневная", content: "Доступ в клуб с 07:00 до 17:00 в будни. Тренажерный зал, сауна, групповые занятия." },
            { title: "Безлимит 24/7", content: "Круглосуточный доступ без ограничений во все зоны клуба и бассейн." },
            { title: "VIP Platinum", content: "Индивидуальный шкафчик, персональный тренер, халат, полотенца и массаж." },
          ],
        },
        {
          component: "carousel",
          title: "Истории успеха клиентов",
          items: [
            { title: "Елена Смирнова", desc: "Сбросила 12 кг за 4 месяца благодаря персональному плану тренера!" },
            { title: "Игорь Кузнецов", desc: "Отличный зал, никогда нет очередей к тренажерам, чистый бассейн." },
            { title: "Анна Мельникова", desc: "Йога по утрам заряжает на весь рабочий день. Обожаю эту атмосферу!" },
          ],
        },
        {
          component: "accordion",
          title: "Ответы на частые вопросы",
          items: [
            { question: "Что входит в бесплатное пробное занятие?", answer: "Анализ состава тела на аппарате InBody, вводный инструктаж с тренером и доступ ко всем зонам." },
            { question: "Можно ли заморозить клубную карту на время отпуска?", answer: "Да, в каждую годовую карту включена бесплатная заморозка от 30 до 60 дней." },
            { question: "С какого возраста можно посещать клуб?", answer: "Самостоятельное посещение с 16 лет. Для детей от 4 лет доступны секции в детском клубе." },
          ],
        },
        {
          component: "form",
          title: "Запишитесь на бесплатный гостевой визит",
          subtitle: "Попробуйте все возможности клуба до покупки абонемента.",
          buttonText: "Получить гостевой визит",
        },
        {
          component: "footer",
          title: "FITNESS PRO",
          subtitle: "© 2026 Все права защищены. Твой путь к силе и здоровью.",
        },
      ],
    };
  }

  const mainTitle = prompt.length > 5 && prompt.length < 80 ? prompt : "Инновационные решения для вашего бизнеса";
  return {
    theme,
    summary: `Готовый лендинг: "${mainTitle}"`,
    sections: [
      {
        component: "header",
        logoText: "COMPANY",
        navLinks: ["Преимущества", "Услуги", "Тарифы", "Отзывы", "Контакты"],
        buttonText: "Связаться",
      },
      {
        component: "hero",
        title: mainTitle,
        subtitle: "Комплексный подход, проверенные решения и гарантированный результат для каждого клиента.",
        buttonText: "Узнать подробнее",
      },
      {
        component: "cards-more",
        title: "Ключевые направления и услуги",
        cards: [
          { title: "Индивидуальный подход", desc: "Разрабатываем решения строго под специфику и цели вашей задачи." },
          { title: "Экспертная команда", desc: "Специалисты с многолетним опытом и подтвержденными кейсами." },
          { title: "Прозрачные условия", desc: "Фиксированные сроки, понятная смета и отсутствие скрытых комиссий." },
          { title: "Современные технологии", desc: "Используем передовые инструменты для максимальной надежности." },
          { title: "Контроль качества", desc: "Многоуровневое тестирование на всех этапах реализации проекта." },
          { title: "Поддержка 24/7", desc: "Всегда остаемся на связи и оперативно решаем любые возникающие вопросы." },
        ],
      },
      {
        component: "tabs-horisontal",
        title: "Варианты сотрудничества",
        tabs: [
          { title: "Базовый", content: "Быстрый старт для решения первоочередных задач с минимальными затратами." },
          { title: "Оптимальный", content: "Сбалансированный пакет услуг, подходящий для большинства растущих проектов." },
          { title: "Премиум", content: "Индивидуальное сопровождение 'под ключ' с выделенным персональным менеджером." },
        ],
      },
      {
        component: "carousel",
        title: "Что говорят наши клиенты",
        items: [
          { title: "Артем Белов", desc: "Сотрудничество превзошло все ожидания. Сделали точно в срок и качественно!" },
          { title: "Ольга Морозова", desc: "Очень отзывчивая команда, учли все пожелания до мельчайших деталей." },
          { title: "Сергей Григорьев", desc: "Надежный партнер, с которым приятно и выгодно иметь дело. Рекомендую!" },
        ],
      },
      {
        component: "accordion",
        title: "Частые вопросы",
        items: [
          { question: "Как быстро вы приступаете к работе?", answer: "После согласования деталей мы начинаем реализацию в течение 24 часов." },
          { question: "Какие гарантии вы предоставляете?", answer: "Все обязательства, сроки и гарантийные условия фиксируются в официальном договоре." },
          { question: "Как происходит оплата?", answer: "Поэтапная оплата по безналичному расчету или онлайн с предоставлением закрывающих документов." },
        ],
      },
      {
        component: "form",
        title: "Оставьте заявку на бесплатную консультацию",
        subtitle: "Ответим на все вопросы и подготовим расчет стоимости в течение дня.",
        buttonText: "Отправить заявку",
      },
      {
        component: "footer",
        title: "COMPANY",
        subtitle: "© 2026 Все права защищены. Профессиональные решения.",
      },
    ],
  };
}

function applyThemeDeep(
  node: HtmlNode,
  theme: ThemeConfig,
  componentType: string,
  isInsideHeroOrFooter: boolean = false
): void {
  const isHeroOrFooter = componentType === "hero" || componentType === "footer" || isInsideHeroOrFooter;

  if (node.style) {
    let s = node.style;

    // 1. Scoped CSS variables (Order matters: btn-hover, btn-bg before bg!)
    s = s.replace(/--([a-z0-9-]+-)?btn-hover:\s*[^;]+/g, (m, p) => `--${p || ""}btn-hover: ${theme.accentHover}`);
    s = s.replace(/--([a-z0-9-]+-)?btn-bg:\s*[^;]+/g, (m, p) => `--${p || ""}btn-bg: ${theme.accent}`);
    s = s.replace(/--([a-z0-9-]+-)?field-accent:\s*[^;]+/g, (m, p) => `--${p || ""}field-accent: ${theme.accent}`);
    s = s.replace(/--([a-z0-9-]+-)?field-border:\s*[^;]+/g, (m, p) => `--${p || ""}field-border: ${theme.borderColor}`);
    s = s.replace(/--([a-z0-9-]+-)?field-text:\s*[^;]+/g, (m, p) => `--${p || ""}field-text: ${theme.titleColor}`);
    s = s.replace(/--([a-z0-9-]+-)?check-active:\s*[^;]+/g, (m, p) => `--${p || ""}check-active: ${theme.accent}`);
    s = s.replace(/--([a-z0-9-]+-)?check-border:\s*[^;]+/g, (m, p) => `--${p || ""}check-border: ${theme.borderColor}`);
    s = s.replace(/--([a-z0-9-]+-)?check-text:\s*[^;]+/g, (m, p) => `--${p || ""}check-text: ${theme.titleColor}`);
    s = s.replace(/--([a-z0-9-]+-)?accent:\s*[^;]+/g, (m, p) => `--${p || ""}accent: ${theme.accent}`);
    s = s.replace(/--([a-z0-9-]+-)?active:\s*[^;]+/g, (m, p) => `--${p || ""}active: ${theme.accent}`);
    s = s.replace(/--([a-z0-9-]+-)?(title|header-color|title-color):\s*[^;]+/g, (m, p, type) => {
      return `--${p || ""}${type}: ${isHeroOrFooter ? "#ffffff" : theme.titleColor}`;
    });
    s = s.replace(/--([a-z0-9-]+-)?(text|muted):\s*[^;]+/g, (m, p, type) => {
      return `--${p || ""}${type}: ${isHeroOrFooter ? "rgba(255,255,255,0.7)" : theme.textColor}`;
    });
    s = s.replace(/--([a-z0-9-]+-)?border:\s*[^;]+/g, (m, p) => {
      return `--${p || ""}border: ${isHeroOrFooter && !theme.isDark ? "rgba(255,255,255,0.15)" : theme.borderColor}`;
    });
    s = s.replace(/--([a-z0-9-]+-)?card-bg:\s*[^;]+/g, (m, p) => `--${p || ""}card-bg: ${theme.cardBg}`);
    s = s.replace(/--([a-z0-9-]+-)?(?<!btn-)bg:\s*[^;]+/g, (m, p) => {
      const isCard = p && (p.includes("card") || p.includes("tab") || p.includes("accordion") || p.includes("contact-card"));
      if (isHeroOrFooter) return `--${p || ""}bg: ${theme.isDark ? theme.bg : theme.titleColor}`;
      return `--${p || ""}bg: ${isCard ? theme.cardBg : theme.bg}`;
    });

    // 2. Hardcoded colors in inline rules
    s = s.replace(/#2563eb/gi, theme.accent);
    s = s.replace(/#1d4ed8/gi, theme.accentHover);
    s = s.replace(/#0f172a/gi, isHeroOrFooter ? "#ffffff" : theme.titleColor);
    s = s.replace(/#e2e8f0/gi, isHeroOrFooter && !theme.isDark ? "rgba(255,255,255,0.15)" : theme.borderColor);
    s = s.replace(/#64748b/gi, isHeroOrFooter ? "rgba(255,255,255,0.7)" : theme.textColor);
    s = s.replace(/#94a3b8/gi, isHeroOrFooter ? "rgba(255,255,255,0.7)" : theme.textColor);

    // 3. Backgrounds for dark/light themes
    if (theme.isDark) {
      if (node.tag === "section" || (node.class && node.class.includes("container") && !node.class.includes("card"))) {
        s = s.replace(/background(-color)?:\s*(#ffffff|#fff|var\(--color-white[^)]*\))/gi, `background$1: ${theme.bg}`);
      } else {
        s = s.replace(/background(-color)?:\s*(#ffffff|#fff|var\(--color-white[^)]*\))/gi, `background$1: ${theme.cardBg}`);
      }
    } else {
      if (node.tag === "section") {
        s = s.replace(/background-color:\s*var\(--cards-more-bg\)/gi, `background-color: ${theme.bg}`);
        s = s.replace(/background-color:\s*var\(--contact-bg\)/gi, `background-color: ${theme.bg}`);
      }
    }

    node.style = s;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      applyThemeDeep(child, theme, componentType, isHeroOrFooter);
    }
  }
}

function replaceImagesWithPlaceholder(node: HtmlNode): void {
  if (node.tag === "img") {
    if (!node.attributes) node.attributes = {};
    node.attributes.src = PLACEHOLDER_IMG_SRC;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      replaceImagesWithPlaceholder(child);
    }
  }
}

function findNodesByTag(node: HtmlNode, tag: string): HtmlNode[] {
  const result: HtmlNode[] = [];
  if (node.tag === tag) result.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...findNodesByTag(child, tag));
    }
  }
  return result;
}

function findNodesByClass(node: HtmlNode, className: string): HtmlNode[] {
  const result: HtmlNode[] = [];
  if (node.class && node.class.includes(className)) result.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...findNodesByClass(child, className));
    }
  }
  return result;
}

function customizeHeader(tree: HtmlNode, plan: ComponentPlan): void {
  if (plan.logoText) {
    const logos = findNodesByClass(tree, "logo");
    if (logos.length > 0) logos[0].text = plan.logoText;
  }
  if (plan.navLinks && plan.navLinks.length > 0) {
    const navAnchors = findNodesByTag(tree, "a");
    plan.navLinks.forEach((linkText, i) => {
      if (navAnchors[i]) navAnchors[i].text = linkText;
    });
  }
  if (plan.buttonText) {
    const btns = findNodesByTag(tree, "button");
    if (btns.length > 0) btns[btns.length - 1].text = plan.buttonText;
  }
}

function customizeHero(tree: HtmlNode, plan: ComponentPlan): void {
  const h1s = findNodesByTag(tree, "h1");
  if (h1s.length > 0 && plan.title) h1s[0].text = plan.title;

  const ps = findNodesByTag(tree, "p");
  if (ps.length > 0 && plan.subtitle) ps[0].text = plan.subtitle;

  const btns = findNodesByTag(tree, "button");
  if (btns.length > 0 && plan.buttonText) btns[0].text = plan.buttonText;
}

function customizeCardsMore(tree: HtmlNode, plan: ComponentPlan): void {
  const h2s = findNodesByTag(tree, "h2");
  if (h2s.length > 0 && plan.title) h2s[0].text = plan.title;

  if (plan.cards && plan.cards.length > 0) {
    const cardNodes = findNodesByClass(tree, "card");
    plan.cards.forEach((cardData, idx) => {
      if (cardNodes[idx]) {
        const h3s = findNodesByTag(cardNodes[idx], "h3");
        if (h3s.length > 0 && cardData.title) h3s[0].text = cardData.title;
        const ps = findNodesByTag(cardNodes[idx], "p");
        if (ps.length > 0 && cardData.desc) ps[0].text = cardData.desc;
      }
    });
  }
}

function customizeTabsHorizontal(tree: HtmlNode, plan: ComponentPlan): void {
  const h2s = findNodesByTag(tree, "h2");
  if (h2s.length > 0 && plan.title) h2s[0].text = plan.title;

  if (plan.tabs && plan.tabs.length > 0) {
    const btnNodes = findNodesByClass(tree, "tab-btn");
    const paneNodes = findNodesByClass(tree, "tab-pane");
    plan.tabs.forEach((tab, idx) => {
      if (btnNodes[idx] && tab.title) btnNodes[idx].text = tab.title;
      if (paneNodes[idx] && tab.content) {
        const ps = findNodesByTag(paneNodes[idx], "p");
        if (ps.length > 0) ps[0].text = tab.content;
        else paneNodes[idx].text = tab.content;
      }
    });
  }
}

function customizeAccordion(tree: HtmlNode, plan: ComponentPlan): void {
  const h2s = findNodesByTag(tree, "h2");
  if (h2s.length > 0 && plan.title) h2s[0].text = plan.title;

  const items = plan.items || (plan.cards as any);
  if (items && items.length > 0) {
    const headers = findNodesByClass(tree, "accordion-header");
    const contents = findNodesByClass(tree, "accordion-content");
    items.forEach((item: any, idx: number) => {
      const q = item.question || item.title;
      const a = item.answer || item.desc;
      if (headers[idx] && q) {
        const btn = findNodesByTag(headers[idx], "button");
        if (btn.length > 0) btn[0].text = q;
        else headers[idx].text = q;
      }
      if (contents[idx] && a) {
        const p = findNodesByTag(contents[idx], "p");
        if (p.length > 0) p[0].text = a;
        else contents[idx].text = a;
      }
    });
  }
}

function customizeCarousel(tree: HtmlNode, plan: ComponentPlan): void {
  const h2s = findNodesByTag(tree, "h2");
  if (h2s.length > 0 && plan.title) h2s[0].text = plan.title;

  const items = plan.items || plan.cards;
  if (items && items.length > 0) {
    const slides = findNodesByClass(tree, "carousel-slide");
    items.forEach((item, idx) => {
      if (slides[idx]) {
        const h3s = findNodesByTag(slides[idx], "h3");
        if (h3s.length > 0 && item.title) h3s[0].text = item.title;
        const ps = findNodesByTag(slides[idx], "p");
        if (ps.length > 0 && item.desc) ps[0].text = item.desc;
      }
    });
  }
}

function customizeForm(tree: HtmlNode, plan: ComponentPlan): void {
  const h2s = findNodesByTag(tree, "h2");
  if (h2s.length > 0 && plan.title) h2s[0].text = plan.title;

  const ps = findNodesByTag(tree, "p");
  if (ps.length > 0 && plan.subtitle) ps[0].text = plan.subtitle;

  const btns = findNodesByTag(tree, "button");
  if (btns.length > 0 && plan.buttonText) btns[0].text = plan.buttonText;
}

function customizeFooter(tree: HtmlNode, plan: ComponentPlan): void {
  if (plan.title || plan.logoText) {
    const brand = findNodesByClass(tree, "footer__brand");
    if (brand.length > 0) brand[0].text = plan.title || plan.logoText || "";
  }
  if (plan.subtitle) {
    const ps = findNodesByTag(tree, "p");
    if (ps.length > 0) ps[0].text = plan.subtitle;
  }
}

export async function generateAiSiteAction({
  prompt,
  themeStyle,
}: GenerateSiteParams): Promise<GenerateSiteResult> {
  const resolvedTheme = resolveTheme(themeStyle, prompt);
  const apiKey = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, "").trim();

  let plan: SitePlan | null = null;

  if (apiKey) {
    const userInstruction = `USER REQUEST:\n${prompt}\nTHEME: ${resolvedTheme.name} (accent: ${resolvedTheme.accent}, dark: ${resolvedTheme.isDark})`;
    const body = {
      contents: [{ role: "user", parts: [{ text: userInstruction }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    };

    for (const model of CANDIDATE_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const resJson = await response.json();
        const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const parsed = JSON.parse(rawText) as { summary?: string; sections?: ComponentPlan[] };
        if (parsed && parsed.sections && Array.isArray(parsed.sections)) {
          plan = {
            theme: resolvedTheme,
            summary: parsed.summary || "Сайт собран нейросетью",
            sections: parsed.sections,
          };
          break;
        }
      } catch {
        // Fall through to next model or fallback
      }
    }
  }

  if (!plan || !plan.sections) {
    plan = buildSmartFallbackPlan(prompt, resolvedTheme);
  }

  const projectRoot = process.cwd();
  const assembledNodes: HtmlNode[] = [];
  const scriptMap = new Map<string, HtmlNode>();

  for (const secPlan of plan.sections) {
    const relPath = COMPONENT_PATHS[secPlan.component];
    if (!relPath) continue;

    const fullPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as HtmlNode[];
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const compTree = JSON.parse(JSON.stringify(raw[0])) as HtmlNode;

      replaceImagesWithPlaceholder(compTree);

      // Глубокая и точная стилизация всех узлов компонента под выбранную тему
      applyThemeDeep(compTree, plan.theme, secPlan.component);

      switch (secPlan.component) {
        case "header":
          customizeHeader(compTree, secPlan);
          break;
        case "hero":
          customizeHero(compTree, secPlan);
          break;
        case "cards-more":
        case "cards":
          customizeCardsMore(compTree, secPlan);
          break;
        case "tabs-horisontal":
        case "tabs":
          customizeTabsHorizontal(compTree, secPlan);
          break;
        case "accordion":
          customizeAccordion(compTree, secPlan);
          break;
        case "carousel":
        case "slider":
          customizeCarousel(compTree, secPlan);
          break;
        case "form":
          customizeForm(compTree, secPlan);
          break;
        case "footer":
          customizeFooter(compTree, secPlan);
          break;
      }

      assembledNodes.push(compTree);

      if (raw.length > 1 && raw[1].tag === "script" && raw[1].text) {
        const scriptId = secPlan.component;
        if (!scriptMap.has(scriptId)) {
          scriptMap.set(scriptId, raw[1]);
        }
      }
    } catch (e) {
      console.error(`Error loading preset ${secPlan.component}:`, e);
    }
  }

  for (const scriptNode of scriptMap.values()) {
    assembledNodes.push(scriptNode);
  }

  return {
    success: true,
    nodes: assembledNodes,
    summary: plan.summary || "Сайт успешно собран из модулей",
  };
}
