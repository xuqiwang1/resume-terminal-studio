const flowSteps = [
  {
    label: "01",
    title: "Read real materials",
    text: "把实习证明、项目笔记和表格抽成干净 markdown，agent 读的是事实，不是空泛提示词。"
  },
  {
    label: "02",
    title: "Agent proposes",
    text: "Codex、Claude Code 或 agy 通过 MCP 提交成品文案，只进入待确认槽，不直接覆盖简历。"
  },
  {
    label: "03",
    title: "You approve",
    text: "工作台展示 diff、预览刷新和历史快照，用户接受后才真正写入。"
  }
];

const featureCards = [
  ["Local-first workspace", "真实简历、素材、历史版本默认留在本机工作区。"],
  ["MCP-ready bridge", "终端 agent 用标准工具读取简历、提交 patch、确认或拒绝。"],
  ["Human-reviewed diff", "AI 修改先进入待确认状态，避免黑箱覆盖。"],
  ["Versioned rebuilds", "完全重塑简历前自动归档旧版本，可从历史恢复。"]
];

export default function LandingPage({ onEnterStudio }) {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="产品介绍导航">
        <a className="landing-mark" href="#top" aria-label="Resume Studio 首页">
          <span className="landing-mark-icon">RS</span>
          <span>Resume Studio</span>
        </a>
        <div className="landing-nav-actions">
          <a href="#workflow">Workflow</a>
          <a href="#trust">Trust</a>
          <button onClick={onEnterStudio}>打开工作台</button>
        </div>
      </nav>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy reveal-up">
          <p className="landing-eyebrow">Local resume studio for agent workflows</p>
          <h1>
            简历可以交给 AI 协作，
            <span>但不能交出控制权。</span>
          </h1>
          <p className="landing-lede">
            Resume Studio 把本机素材、终端 agent、MCP bridge、可审核 diff、历史存档和 A4
            预览连成一个闭环。它不是自动替你乱改简历的黑箱，而是一个让 AI 参与、由你确认的本地工作台。
          </p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onEnterStudio}>
              打开工作台 <span>↗</span>
            </button>
            <a className="landing-secondary" href="#workflow">查看流程</a>
          </div>
        </div>

        <div className="landing-product-card reveal-up" style={{ "--delay": "120ms" }}>
          <div className="landing-window">
            <div className="landing-window-bar">
              <span />
              <span />
              <span />
              <strong>MCP Ready</strong>
            </div>
            <div className="landing-workbench-preview">
              <div className="landing-terminal">
                <p>$ agy</p>
                <p>call get_resume</p>
                <p>read materials/.extracted</p>
                <p>propose_edit(projects[0])</p>
              </div>
              <div className="landing-paper">
                <span>AI 产品经理</span>
                <h3>项目经历</h3>
                <p>本地 bridge 串联 React 预览、MCP 工具与终端执行过程。</p>
                <p>pending patch 机制确保 AI 只能提交待确认改动。</p>
                <div className="landing-diff">
                  <b>待确认改动</b>
                  <small>before → after</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-strip reveal-up" aria-label="核心指标">
        <div>
          <b>100%</b>
          <span>local workspace</span>
        </div>
        <div>
          <b>MCP</b>
          <span>agent-compatible</span>
        </div>
        <div>
          <b>Diff</b>
          <span>human-reviewed writes</span>
        </div>
        <div>
          <b>History</b>
          <span>safe resume rebuilds</span>
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="landing-section-copy reveal-up">
          <p className="landing-eyebrow">Continuous loop</p>
          <h2>从素材到投递版 PDF，中间每一步都可见。</h2>
          <p>
            竞品常把“AI 生成简历”做成一次性按钮。Resume Studio 更关注协作过程：
            agent 可以读上下文、写文案、提交 patch，但用户始终拥有最后写入权。
          </p>
        </div>
        <div className="landing-flow-grid">
          {flowSteps.map((step, index) => (
            <article className="landing-flow-card reveal-up" style={{ "--delay": `${index * 90}ms` }} key={step.label}>
              <span>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-trust" id="trust">
        <div className="landing-section-copy reveal-up">
          <p className="landing-eyebrow">Trust architecture</p>
          <h2>为“大胆重写”设计安全边界。</h2>
        </div>
        <div className="landing-feature-grid">
          {featureCards.map(([title, text], index) => (
            <article className="landing-feature-card reveal-up" style={{ "--delay": `${index * 70}ms` }} key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta reveal-up">
        <p className="landing-eyebrow">Built for local agents</p>
        <h2>打开工作台，把下一版简历写进可审核的流程里。</h2>
        <button className="landing-primary" onClick={onEnterStudio}>
          进入 Resume Studio <span>↗</span>
        </button>
      </section>
    </main>
  );
}
