export default function Hero({ onRunJd, onRunSummary }) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Terminal-connected resume workflow</p>
        <h1>让简历修改过程，像真实工作流一样被看见。</h1>
        <p className="hero-copy">
          这不是黑箱式 AI 润色工具。每一次改写、每一次 patch、每一次 PDF
          导出，都通过你电脑上的终端真实执行，并在界面里完整回放。
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={onRunJd}>
            根据 JD 优化整份简历
          </button>
          <button className="secondary" onClick={onRunSummary}>
            重写个人总结
          </button>
        </div>
      </section>

      <section className="hero-showcase">
        <div className="showcase-panel">
          <div className="showcase-copy">
            <div>
              <p className="eyebrow">Live product preview</p>
              <h2>一个更像工作台，而不是表单页的简历编辑器。</h2>
              <p>
                中间是 A4 简历预览，右侧是动作区。整个界面的重点不是“生成”，而是“让执行过程可见、可信、可回退”。
              </p>
            </div>
            <div className="showcase-chips">
              <span className="chip">真实终端联动</span>
              <span className="chip">Section diff</span>
              <span className="chip">A4 PDF 导出</span>
            </div>
          </div>
          <div className="device-stage">
            <div className="device-card tall">
              <div className="device-card-head">Terminal</div>
              <div className="device-code">
                <div>$ resume-agent tailor --resume ./resume.json</div>
                <div>[1/5] 读取岗位描述</div>
                <div>[2/5] 生成 section patch</div>
                <div className="success-line">✓ preview refreshed</div>
              </div>
            </div>
            <div className="device-card">
              <div className="device-card-head">Resume</div>
              <div className="device-preview">
                <div className="device-preview-title"></div>
                <div className="device-preview-line"></div>
                <div className="device-preview-line short"></div>
                <div className="device-preview-block"></div>
                <div className="device-preview-block small"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
