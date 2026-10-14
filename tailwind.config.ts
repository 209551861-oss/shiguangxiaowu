import type { Config } from "tailwindcss";

// 配色取自 yayoi.cc 实测浅色森系（见《实施方案》10.1）
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFEFA", // 卡片纸白
        mist: "#F8F7F2", // 页面暖米白底
        ink: "#334139", // 正文深林绿
        forest: "#394B3C", // 强调深林绿
        leaf: "#718B61", // 叶绿
        olive: "#93A866", // 橄榄绿
        lime: "#AFBD70", // 青柠
        pollen: "#C9E97F", // 花粉黄绿（主点缀）
        bloom: "#C7CDE0", // 薰衣草紫（次点缀）
        line: "#D8DED6", // 描边
        muted: "#768078", // 次要文字
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Songti SC"', "serif"],
        sans: ['"Noto Sans SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
      boxShadow: {
        soft: "0 16px 38px rgba(57,75,60,.07)",
        card: "0 24px 70px rgba(57,75,60,.12)",
        press: "0 8px 20px rgba(24,61,45,.14)",
      },
      backdropBlur: {
        glass: "10px",
      },
      keyframes: {
        breathe: {
          "0%,100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(201,233,127,.5)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 0 16px rgba(201,233,127,0)" },
        },
        rise: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "15%": { opacity: "0.85" },
          "85%": { opacity: "0.6" },
          "100%": { transform: "translateY(-105vh) translateX(40px)", opacity: "0" },
        },
      },
      animation: {
        breathe: "breathe 2.6s ease-in-out infinite",
        rise: "rise linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
