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
    category: "Text Align & Transform",
    items: [
      { name: "0 auto", css: "margin: 0 auto;" },
      { name: "Align Center", css: "text-align: center;" },
      { name: "Align Left", css: "text-align: left;" },
      { name: "Align Right", css: "text-align: right;" },
      { name: "UPPERCASE", css: "text-transform: uppercase;" },
      { name: "lowercase", css: "text-transform: lowercase;" },
      { name: "Normal Case", css: "text-transform: none;" },
      { name: "nowrap", css: "white-space: nowrap;" },
      { name: "wrap", css: "white-space: normal;" },
      { name: "Underline", css: "text-decoration: underline;" },
      { name: "Line-through", css: "text-decoration: line-through;" },
      { name: "No Decoration", css: "text-decoration: none;" },
      {
        name: "Truncate text",
        css: "overflow: hidden;\ntext-overflow: ellipsis;\nwhite-space: nowrap;",
      },

      { name: "Overflow Hidden", css: "overflow: hidden;" },
      { name: "Overflow Auto", css: "overflow: auto;" },
      { name: "Overflow Visible", css: "overflow: visible;" },
      { name: "Overflow Scroll", css: "overflow: scroll;" },
      // { name: "Opacity 1", css: "opacity: 1;" },
      // { name: "Opacity 0", css: "opacity: 0;" },
      { name: "Visible", css: "visibility: visible;" },
      { name: "Hidden", css: "visibility: hidden;" },
    ],
  },
  // {
  //   category: "Visuals",
  //   items: [
  //     {
  //       name: "Soft Shadow",
  //       css: "box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.25);",
  //     },
  //     {
  //       name: "Glow Blue",
  //       css: "box-shadow: 0 0 15px rgba(56, 189, 248, 0.5);",
  //     },
  //     {
  //       name: "Glassmorphism",
  //       css: "background: rgba(255, 255, 255, 0.05);\nbackdrop-filter: blur(10px);\nborder: 1px solid rgba(255, 255, 255, 0.1);",
  //     },
  //   ],
  // },
];
