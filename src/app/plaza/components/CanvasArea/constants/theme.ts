export const DEPTH_BG = [
  "rgba(18, 18, 24, 0.96)",
  "rgba(26, 26, 34, 0.96)",
  "rgba(34, 34, 44, 0.96)",
  "rgba(42, 42, 54, 0.96)",
  "rgba(50, 50, 64, 0.96)",
];

export const DEPTH_BORDER = [
  "rgba(63, 63, 70, 0.8)",
  "rgba(82, 82, 91, 0.85)",
  "rgba(113, 113, 122, 0.9)",
  "rgba(161, 161, 170, 0.9)",
  "rgba(212, 212, 216, 0.9)",
];
export const DB_KEY = "plaza_tree";
export const TEXT_DEFAULT = [
  { key: "Lorem 5", value: "Lorem" },
  { key: "Lorem 10", value: "Lorem ipsum" },
  { key: "Lorem 15", value: "Lorem ipsum dolor" },
  {
    key: "Lorem 20",
    value:
      "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iusto consequatur minus quam, nisi perferendis, vel quaerat commodi deleniti molestias laboriosam saepe, eius quisquam dignissimos laborum vero repellat dolorem. Autem, ab!",
  },
];

export const COMMON_TAGS = [
  "div",
  "p",
  "span",
  "button",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "article",
  "ul",
  "ol",
  "li",
  "input",
  "form",
  "label",
  "img",
];

export const LIVE_STYLE_ID = "__plaza_live_quick_style__";

interface StylePreset {
  name: string;
  css: string;
}

export const STYLE_PRESETS: { category: string; items: StylePreset[] }[] = [
  {
    category: "Layout",
    items: [
      {
        name: "inline-block",
        css: "display: inline-block;",
      },
      {
        name: "block",
        css: "display: block;",
      },
      { name: "Flex row", css: "display: flex;\nflex-direction: row;" },
      {
        name: "Flex row reverse",
        css: "display: flex;\nflex-direction: row-reverse;",
      },
      { name: "Flex col", css: "display: flex;\nflex-direction: column;" },
      {
        name: "justify center",
        css: "justify-content: center;",
      },
      {
        name: "justify between",
        css: "justify-content: space-between;",
      },
      {
        name: "items center",
        css: "align-items: center;",
      },
      {
        name: "items end",
        css: "align-items: flex-end;",
      },
      {
        name: "Grid 2 Cols",
        css: "display: grid;\ngrid-template-columns: repeat(2, 1fr);",
      },
    ],
  },
  {
    category: "Visuals",
    items: [
      {
        name: "Soft Shadow",
        css: "box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.25);",
      },
      {
        name: "Glow Blue",
        css: "box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);",
      },
      {
        name: "Glassmorphism",
        css: "background: rgba(255, 255, 255, 0.05);\nbackdrop-filter: blur(10px);\nborder: 1px solid rgba(255, 255, 255, 0.1);",
      },
    ],
  },
  {
    category: "Effects",
    items: [
      {
        name: "Hover Scale",
        css: "transition: transform 0.2s ease;\n&:hover {\n  transform: scale(1.04);\n}",
      },
      {
        name: "Gradient BG",
        css: "background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);\ncolor: #ffffff;",
      },
      {
        name: "Truncate text",
        css: "overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;",
      },
    ],
  },
];
