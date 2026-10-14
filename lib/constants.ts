export type NavLink = { href: string; label: string };
export type Module = {
  href: string;
  icon: string;
  title: string;
  desc: string;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "首页" },
  { href: "/notes", label: "学习档案" },
  { href: "/library", label: "资料库" },
  { href: "/atelier", label: "创作工坊" },
  { href: "/gallery", label: "相册" },
  { href: "/about", label: "关于" },
];

// 八大模块（见《前端页面结构设计稿》）
export const MODULES: Module[] = [
  { href: "/notes", icon: "📖", title: "学习档案", desc: "课程、读书、技术笔记的分类沉淀" },
  { href: "/library", icon: "🗂️", title: "资料库", desc: "收藏的链接、文档与素材索引" },
  { href: "/atelier", icon: "🎨", title: "创作工坊", desc: "绘画与作品的原稿与过程记录" },
  { href: "/gallery", icon: "🖼️", title: "生活相册", desc: "按相册归档的影像记忆" },
  { href: "/moments", icon: "✨", title: "瞬间记录", desc: "一句话、一张图的即时光阴" },
  { href: "/timeline", icon: "🕰️", title: "成长时间轴", desc: "重要节点串联起的个人编年" },
  { href: "/articles", icon: "📝", title: "文章", desc: "长文随笔与深度分享" },
  { href: "/about", icon: "👤", title: "关于我", desc: "自我介绍与联系方式" },
];
