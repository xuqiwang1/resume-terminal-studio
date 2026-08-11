export const initialResume = {
  name: "林知远",
  title: "AI 产品经理实习生 / 可尽快到岗 / 可实习 3-6 个月",
  contact: "邮箱：demo@resumestudio.local | 电话：138-0000-0000 | 城市：上海",
  avatar: null,
  avatarPos: { x: 0, y: 0 },
  fieldStyles: {},
  layoutConfig: {
    education: { schoolAlign: "center", majorAlign: "right" },
    skills: { layout: "block" }
  },
  summary: "",
  education: [
    {
      school: "某重点大学",
      tag: "985",
      major: "信息管理",
      degree: "硕士",
      date: "2025.09 - 2028.06"
    },
    {
      school: "某综合大学",
      tag: "211",
      major: "工商管理",
      degree: "学士",
      date: "2021.09 - 2025.06"
    }
  ],
  skills: [
    {
      category: "产品与办公工具",
      content:
        "熟练使用 X-mind 进行业务流程梳理与思维导图绘制；熟悉 Figma 原型绘制工具；熟练使用 PPT / Word 输出汇报与方案文档。"
    },
    {
      category: "数据分析",
      content:
        "熟练使用 Excel（VLOOKUP、透视表）处理业务数据；熟悉 SQL 基础查询，能完成数据清洗与简单分析。"
    }
  ],
  experience: [
    {
      company: "某 AI 办公软件公司",
      role: "AI 产品实习生，表格智能化方向",
      date: "2024.12 - 2025.05",
      details:
        "参与表格 AI 功能的需求梳理、样例构建和上线验收，围绕用户输入、结果采纳和异常 case 建立评估记录，帮助团队定位模型效果与产品体验问题。"
    },
    {
      company: "校园创新项目",
      role: "产品与研究负责人",
      date: "2024.09 - 2025.06",
      details:
        "负责访谈材料整理、用户路径梳理和原型验证，输出结构化需求文档，推动团队从模糊想法收敛到可测试方案。"
    }
  ],
  projects: [
    {
      name: "AI 简历编辑器",
      role: "产品负责人",
      date: "进行中",
      details:
        "探索“真实终端联动 + 执行过程透明”的简历编辑体验，让 AI 修改过程可见、可控、可回退。"
    }
  ]
};

export const sectionMeta = [
  { id: "education", title: "教育背景", desc: "结构化院校 / 学历 / 专业字段" },
  { id: "skills", title: "专业技能", desc: "按分类组织的技能描述" },
  { id: "experience", title: "工作经历", desc: "支持定向优化 bullet 表达" },
  { id: "projects", title: "项目经历", desc: "支持按岗位 JD 重新排序与压缩" },
  { id: "summary", title: "个人总结", desc: "可选，终端可直接重写这一段" }
];

export const initialActivity = [
  {
    label: "Ready",
    state: "Idle",
    text: "界面已连接本地 bridge。AI agent 可通过 resume CLI 提交待确认改动。"
  }
];
