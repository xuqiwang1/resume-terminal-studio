import AnimatedText from "../../components/AnimatedText";
import RichText from "../../components/RichText";
import DraggableAvatar from "../../components/DraggableAvatar";
import { fieldId, fieldClass, sectionClass, resolveSectionOrder } from "../shared";

function StructuredText({ value }) {
  const lines = String(value || "").split("\n");

  return (
    <>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <span className="exec-line-gap" key={index} />;
        }

        const labeled = trimmed.match(/^(【[^】]+】)(.*)$/);
        if (labeled) {
          return (
            <span className="exec-detail-line" key={index}>
              <strong className="exec-lead-in">{labeled[1]}</strong>
              <RichText value={labeled[2]} fieldId={`structured.${index}`} />
            </span>
          );
        }

        const bulletLabeled = trimmed.match(/^([•\-\*]?\s*[^:：\n]+[:：])(.*)$/);
        if (bulletLabeled && bulletLabeled[1].length < 40) {
          return (
            <span className="exec-detail-line" key={index}>
              <strong className="exec-lead-in">{bulletLabeled[1]}</strong>
              <RichText value={bulletLabeled[2]} fieldId={`structured.${index}`} />
            </span>
          );
        }

        if (/^[^【\n]+｜\d{4}\.\d{2}-\d{4}\.\d{2}$/.test(trimmed)) {
          return (
            <span className="exec-stage-line" key={index}>
              <RichText value={trimmed} fieldId={`structured.${index}`} />
            </span>
          );
        }

        return (
          <span className="exec-detail-line" key={index}>
            <RichText value={trimmed} fieldId={`structured.${index}`} />
          </span>
        );
      })}
    </>
  );
}

export default function ExecutiveTemplate({ resume, ctx }) {
  const {
    activeSectionId, selectedField, onFieldClick,
    workingSection, patchAnimation, onPatchAnimationComplete,
    ruleStyle = "thin", avatar, avatarPos, onAvatarPosChange,
    layoutConfig, fieldStyles = {},
  } = ctx;

  const fc = (sec, idx, field) => fieldClass(selectedField, sec, idx, field);
  const click = (e, fid) => { e.stopPropagation(); onFieldClick?.(fid); };
  const fieldStyle = (fid) => fieldStyles[fid] || {};
  const linkStyleFor = (fid) => {
    const style = fieldStyles[fid] || {};
    return {
      "--r-link-color": style.linkColor || undefined,
      "--r-link-decoration": style.linkUnderline === false ? "none" : undefined
    };
  };
  const withFieldStyle = (fid, base = {}) => ({ ...base, ...fieldStyle(fid) });
  const patchFor = (fid) => patchAnimation?.fieldId === fid ? patchAnimation : null;
  const renderField = (fid, value) => {
    const patch = patchFor(fid);
    if (patch?.active) return <AnimatedText after={patch.after} active onComplete={() => onPatchAnimationComplete?.(fid)} />;
    return <RichText value={value} fieldId={fid} linkStyle={linkStyleFor(fid)} />;
  };
  const renderStructuredField = (fid, value) => {
    const patch = patchFor(fid);
    if (patch?.active) return <AnimatedText after={patch.after} active onComplete={() => onPatchAnimationComplete?.(fid)} />;
    return <StructuredText value={value} />;
  };

  const ruleClass = `exec-rule${ruleStyle !== "thin" ? ` ${ruleStyle}` : ""}`;
  const education = Array.isArray(resume.education) ? resume.education : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const summaryText = resume.summary;
  const hasSummary = typeof summaryText === "string" && summaryText.trim().length > 0;
  const eduLayout = layoutConfig?.education || {};
  const schoolAlign = eduLayout.schoolAlign || "center";
  const majorAlign = eduLayout.majorAlign || "right";
  const skillsLayout = layoutConfig?.skills?.layout || "grid";
  const summaryStyle = layoutConfig?.summaryStyle || "card";
  const headerStyle = layoutConfig?.headerStyle || "center";
  const headStyle = layoutConfig?.sectionHeadStyle || "line";

  const headerClass = `${sectionClass(activeSectionId, workingSection, "header").replace(
    "resume-section",
    "exec-header"
  )}${headerStyle === "left" ? " header-left" : ""}`;

  const renderSectionHead = (title) => (
    <div className={`exec-section-head head-style-${headStyle}`}>
      <h2>{title}</h2>
      {headStyle === "line" && <div className={ruleClass} />}
    </div>
  );

  const sectionsMap = {
    summary: hasSummary ? (
      <section className={sectionClass(activeSectionId, workingSection, "summary")} data-section="summary" key="summary">
        {renderSectionHead("个人总结")}
        {summaryStyle === "plain" ? (
          <div
            className={`exec-body ${fc("summary", null, "text")}`}
            onClick={(e) => click(e, fieldId("summary", null, "text"))}
            style={withFieldStyle(fieldId("summary", null, "text"), { fontSize: "var(--r-fs-body, 11.5px)", whiteSpace: "pre-wrap" })}
          >
            {renderField(fieldId("summary", null, "text"), summaryText)}
          </div>
        ) : (
          <div className="exec-summary-box">
            <div
              className={`exec-body ${fc("summary", null, "text")}`}
              onClick={(e) => click(e, fieldId("summary", null, "text"))}
              style={withFieldStyle(fieldId("summary", null, "text"), { fontSize: "var(--r-fs-body, 11.5px)", whiteSpace: "pre-wrap" })}
            >
              {renderField(fieldId("summary", null, "text"), summaryText)}
            </div>
          </div>
        )}
      </section>
    ) : null,

    skills: skills.length > 0 ? (
      <section className={sectionClass(activeSectionId, workingSection, "skills")} data-section="skills" key="skills">
        {renderSectionHead("专业技能")}
        {skillsLayout === "grid" ? (
          <div className="exec-skills-grid">
            {skills.map((item, index) => (
              <div className="exec-skill-card" key={`${item.category}-${index}`}>
                <strong
                  className={`exec-skill-cat ${fc("skills", index, "category")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "category"))}
                  style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 11.5px)" })}
                >
                  <RichText value={item.category} fieldId={fieldId("skills", index, "category")} linkStyle={linkStyleFor(fieldId("skills", index, "category"))} />
                </strong>
                <div
                  className={`exec-body exec-skill-body ${fc("skills", index, "content")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "content"))}
                  style={withFieldStyle(fieldId("skills", index, "content"), { fontSize: "var(--r-fs-body, 11px)", whiteSpace: "pre-wrap" })}
                >
                  {renderField(fieldId("skills", index, "content"), item.content)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`exec-skills-wrapper${skillsLayout === "inline" ? " layout-inline" : " layout-block"}`}>
            {skills.map((item, index) => (
              <div className="exec-skill-entry" key={`${item.category}-${index}`}>
                <strong
                  className={`exec-skill-cat ${fc("skills", index, "category")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "category"))}
                  style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 11.5px)" })}
                >
                  <RichText value={item.category} fieldId={fieldId("skills", index, "category")} linkStyle={linkStyleFor(fieldId("skills", index, "category"))} />
                </strong>
                <div
                  className={`exec-body exec-skill-body ${fc("skills", index, "content")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "content"))}
                  style={withFieldStyle(fieldId("skills", index, "content"), { fontSize: "var(--r-fs-body, 11.5px)", whiteSpace: "pre-wrap" })}
                >
                  {renderField(fieldId("skills", index, "content"), item.content)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    ) : null,

    experience: (
      <section className={sectionClass(activeSectionId, workingSection, "experience")} data-section="experience" key="experience">
        {renderSectionHead("实习经历")}
        {resume.experience.map((item, index) => {
          const detailsFid = fieldId("experience", index, "details");
          return (
            <div className="exec-entry" key={`${item.company}-${item.date}`}>
              <div className="exec-entry-head exec-experience-head">
                <strong className={`exec-entry-company ${fc("experience", index, "company")}`} onClick={(e) => click(e, fieldId("experience", index, "company"))} style={fieldStyle(fieldId("experience", index, "company"))}>
                  <RichText value={item.company} fieldId={fieldId("experience", index, "company")} linkStyle={linkStyleFor(fieldId("experience", index, "company"))} />
                </strong>
                <span className={`exec-entry-role ${fc("experience", index, "role")}`} onClick={(e) => click(e, fieldId("experience", index, "role"))} style={fieldStyle(fieldId("experience", index, "role"))}>
                  <RichText value={item.role} fieldId={fieldId("experience", index, "role")} linkStyle={linkStyleFor(fieldId("experience", index, "role"))} />
                </span>
                <span className={`exec-date ${fc("experience", index, "date")}`} onClick={(e) => click(e, fieldId("experience", index, "date"))} style={withFieldStyle(fieldId("experience", index, "date"), { fontSize: "var(--r-fs-muted, 11px)" })}>{item.date}</span>
              </div>
              <div className={`exec-body exec-structured-body ${fc("experience", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 11.5px)" })}>
                {renderStructuredField(detailsFid, item.details)}
              </div>
            </div>
          );
        })}
      </section>
    ),

    projects: resume.projects && resume.projects.length > 0 ? (
      <section className={sectionClass(activeSectionId, workingSection, "projects")} data-section="projects" key="projects">
        {renderSectionHead("项目经历")}
        {resume.projects.map((item, index) => {
          const detailsFid = fieldId("projects", index, "details");
          return (
            <div className="exec-entry" key={`${item.name}-${index}`}>
              <div className="exec-entry-head exec-project-head">
                <strong className={`exec-entry-name ${fc("projects", index, "name")}`} onClick={(e) => click(e, fieldId("projects", index, "name"))} style={fieldStyle(fieldId("projects", index, "name"))}>
                  <RichText value={item.name} fieldId={fieldId("projects", index, "name")} linkStyle={linkStyleFor(fieldId("projects", index, "name"))} />
                </strong>
                <span className={`exec-entry-role ${fc("projects", index, "role")}`} onClick={(e) => click(e, fieldId("projects", index, "role"))} style={fieldStyle(fieldId("projects", index, "role"))}>
                  <RichText value={item.role} fieldId={fieldId("projects", index, "role")} linkStyle={linkStyleFor(fieldId("projects", index, "role"))} />
                </span>
              </div>
              <div className={`exec-body exec-structured-body exec-project-body ${fc("projects", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 11.5px)" })}>
                {renderStructuredField(detailsFid, item.details)}
              </div>
            </div>
          );
        })}
      </section>
    ) : null,

    education: education.length > 0 ? (
      <section className={sectionClass(activeSectionId, workingSection, "education")} data-section="education" key="education">
        {renderSectionHead("教育背景")}
        {education.map((item, index) => (
          <div className={`exec-edu-entry edu-school-${schoolAlign} edu-major-${majorAlign}`} key={`${item.school}-${item.date}-${index}`}>
            <span
              className={`exec-edu-date ${fc("education", index, "date")}`}
              onClick={(e) => click(e, fieldId("education", index, "date"))}
              style={withFieldStyle(fieldId("education", index, "date"), { fontSize: "var(--r-fs-body, 11.5px)" })}
            >
              {item.date}
            </span>
            <span className="exec-edu-school">
              <strong
                className={fc("education", index, "school")}
                onClick={(e) => click(e, fieldId("education", index, "school"))}
                style={fieldStyle(fieldId("education", index, "school"))}
              >
                {item.school}
              </strong>
              {item.tag && (
                <em
                  className={`exec-edu-tag ${fc("education", index, "tag")}`}
                  onClick={(e) => click(e, fieldId("education", index, "tag"))}
                  style={fieldStyle(fieldId("education", index, "tag"))}
                >
                  {item.tag}
                </em>
              )}
            </span>
            <span
              className={`exec-edu-major ${fc("education", index, "major")}`}
              onClick={(e) => click(e, fieldId("education", index, "major"))}
              style={withFieldStyle(fieldId("education", index, "major"), { fontSize: "var(--r-fs-body, 11.5px)" })}
            >
              <span
                className={fc("education", index, "degree")}
                onClick={(e) => click(e, fieldId("education", index, "degree"))}
                style={fieldStyle(fieldId("education", index, "degree"))}
              >
                {item.degree}
              </span>
              {item.degree && item.major ? " · " : ""}
              {item.major}
            </span>
          </div>
        ))}
      </section>
    ) : null
  };

  const sectionOrder = resolveSectionOrder(layoutConfig, ["summary", "skills", "experience", "projects", "education"]);

  return (
    <div className="exec-page">
      <header className={headerClass} data-section="header">
        {avatar && (
          <DraggableAvatar
            src={avatar}
            position={avatarPos}
            onPositionChange={onAvatarPosChange}
            size={72}
            className="exec-avatar-topright"
          />
        )}
        <h1
          className={fc("header", null, "name")}
          onClick={(e) => click(e, fieldId("header", null, "name"))}
          style={withFieldStyle(fieldId("header", null, "name"), { fontSize: "var(--r-fs-heading, 23px)" })}
        >
          {resume.name}
        </h1>
        {resume.title && (
          <p
            className={`exec-intent ${fc("header", null, "title")}`}
            onClick={(e) => click(e, fieldId("header", null, "title"))}
            style={withFieldStyle(fieldId("header", null, "title"), { fontSize: "var(--r-fs-body, 12px)" })}
          >
            <RichText value={resume.title} fieldId={fieldId("header", null, "title")} linkStyle={linkStyleFor(fieldId("header", null, "title"))} emphasizeMetrics={false} />
          </p>
        )}
        <p
          className={`exec-contact ${fc("header", null, "contact")}`}
          onClick={(e) => click(e, fieldId("header", null, "contact"))}
          style={withFieldStyle(fieldId("header", null, "contact"), { fontSize: "var(--r-fs-muted, 11px)" })}
        >
          <RichText value={resume.contact} fieldId={fieldId("header", null, "contact")} linkStyle={linkStyleFor(fieldId("header", null, "contact"))} emphasizeMetrics={false} />
        </p>
      </header>

      {sectionOrder.map((sectionId) => sectionsMap[sectionId] || null)}
    </div>
  );
}
