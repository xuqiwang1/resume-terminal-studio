import AnimatedText from "../../components/AnimatedText";
import RichText from "../../components/RichText";
import DraggableAvatar from "../../components/DraggableAvatar";
import { fieldId, fieldClass, sectionClass, resolveSectionOrder, linkStyleForField, mergeFieldStyle, resolveEducationDegree, hasEntryContent } from "../shared";

function isSubheadingLine(trimmed) {
  return (
    trimmed.length > 0 &&
    trimmed.length <= 28 &&
    !/[。；！？，、：:【】]/.test(trimmed)
  );
}

function StructuredText({ value }) {
  const lines = String(value || "").split("\n");

  return (
    <>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <span className="ponnd-line-gap" key={index} />;
        }

        const labeled = trimmed.match(/^(【[^】]+】)(.*)$/);
        if (labeled) {
          return (
            <span className="ponnd-detail-line" key={index}>
              <strong className="ponnd-lead-in">{labeled[1]}</strong>
              <RichText value={labeled[2]} fieldId={`structured.${index}`} />
            </span>
          );
        }

        const bulletLabeled = trimmed.match(/^([•\-\*]?\s*[^:：\n]+[:：])(.*)$/);
        if (bulletLabeled && bulletLabeled[1].length < 40) {
          return (
            <span className="ponnd-detail-line" key={index}>
              <strong className="ponnd-lead-in">{bulletLabeled[1]}</strong>
              <RichText value={bulletLabeled[2]} fieldId={`structured.${index}`} />
            </span>
          );
        }

        if (/^[^【\n]+｜\d{4}\.\d{2}-\d{4}\.\d{2}$/.test(trimmed) || isSubheadingLine(trimmed)) {
          return (
            <span className="ponnd-stage-line" key={index}>
              <RichText value={trimmed} fieldId={`structured.${index}`} />
            </span>
          );
        }

        return (
          <span className="ponnd-detail-line" key={index}>
            <RichText value={trimmed} fieldId={`structured.${index}`} />
          </span>
        );
      })}
    </>
  );
}

export default function PonndTemplate({ resume, ctx }) {
  const {
    activeSectionId, selectedField, onFieldClick,
    workingSection, patchAnimation, onPatchAnimationComplete,
    ruleStyle = "thin", avatar, avatarPos, onAvatarPosChange,
    layoutConfig, fieldStyles = {},
  } = ctx;

  const fc = (sec, idx, field) => fieldClass(selectedField, sec, idx, field);
  const click = (e, fid) => { e.stopPropagation(); onFieldClick?.(fid); };
  const fieldStyle = (fid) => mergeFieldStyle(fieldStyles, fid);
  const linkStyleFor = (fid) => linkStyleForField(fieldStyles, fid);
  const withFieldStyle = (fid, base = {}) => mergeFieldStyle(fieldStyles, fid, base);
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

  const ruleClass = `ponnd-rule${ruleStyle !== "thin" ? ` ${ruleStyle}` : ""}`;
  const education = Array.isArray(resume.education) ? resume.education : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const summaryText = resume.summary;
  const hasSummary = typeof summaryText === "string" && summaryText.trim().length > 0;
  const eduLayout = layoutConfig?.education || {};
  const eduMode = eduLayout.mode || (education.length >= 2 ? "grid" : "stack");
  const schoolAlign = eduLayout.schoolAlign || "left";
  const majorAlign = eduLayout.majorAlign || "right";
  const skillsLayout = layoutConfig?.skills?.layout || "inline";
  const headerStyle = layoutConfig?.headerStyle || "left";
  const summaryStyle = layoutConfig?.summaryStyle || "plain";
  const headStyle = layoutConfig?.sectionHeadStyle || "line";
  const headerClass = `${sectionClass(activeSectionId, workingSection, "header").replace(
    "resume-section",
    "ponnd-header"
  )}${headerStyle === "center" ? " header-center" : " header-left"}${avatar ? " has-avatar" : ""}`;

  const renderSectionHead = (title) => (
    <div className={`ponnd-section-head head-style-${headStyle}`}>
      <h2>{title}</h2>
      {headStyle === "line" && <div className={ruleClass} />}
    </div>
  );

  const sectionsMap = {
    summary: hasSummary ? (
      <section className={sectionClass(activeSectionId, workingSection, "summary")} data-section="summary" key="summary">
        {renderSectionHead("个人总结")}
        <div
          className={`ponnd-body ${summaryStyle === "card" ? "ponnd-summary-box " : ""}${fc("summary", null, "text")}`}
          onClick={(e) => click(e, fieldId("summary", null, "text"))}
          style={withFieldStyle(fieldId("summary", null, "text"), { fontSize: "var(--r-fs-body, 11.5px)", whiteSpace: "pre-wrap" })}
        >
          {renderField(fieldId("summary", null, "text"), summaryText)}
        </div>
      </section>
    ) : null,

    education: education.length > 0 ? (
      <section className={sectionClass(activeSectionId, workingSection, "education")} data-section="education" key="education">
        {renderSectionHead("教育背景")}
        <div className={`ponnd-edu-list ${eduMode === "grid" && education.length >= 2 ? "edu-mode-grid" : "edu-mode-stack"}`}>
          {education.map((item, index) => {
            const degreeText = resolveEducationDegree(item, index, education.length);
            const isPrimaryDegree = index === 0 && /硕|博|Master|PhD/i.test(degreeText);
            return (
            <div className={`ponnd-edu-entry edu-school-${schoolAlign} edu-major-${majorAlign}`} key={`${item.school}-${item.date}-${index}`}>
              {degreeText && (
                <span
                  className={`edu-degree-badge ${isPrimaryDegree ? "is-primary" : "is-secondary"} ${fc("education", index, "degree")}`}
                  onClick={(e) => click(e, fieldId("education", index, "degree"))}
                  style={fieldStyle(fieldId("education", index, "degree"))}
                >
                  {degreeText}
                </span>
              )}
              <span className="ponnd-edu-school">
                <strong
                  className={fc("education", index, "school")}
                  onClick={(e) => click(e, fieldId("education", index, "school"))}
                  style={fieldStyle(fieldId("education", index, "school"))}
                >
                  {item.school}
                </strong>
                {item.tag && (
                  <em
                    className={`ponnd-edu-tag ${fc("education", index, "tag")}`}
                    onClick={(e) => click(e, fieldId("education", index, "tag"))}
                    style={fieldStyle(fieldId("education", index, "tag"))}
                  >
                    {item.tag}
                  </em>
                )}
              </span>
              <span
                className={`ponnd-edu-major ${fc("education", index, "major")}`}
                onClick={(e) => click(e, fieldId("education", index, "major"))}
                style={withFieldStyle(fieldId("education", index, "major"), { fontSize: "var(--r-fs-body, 11.5px)" })}
              >
                {item.major}
              </span>
              <span
                className={`ponnd-edu-date ${fc("education", index, "date")}`}
                onClick={(e) => click(e, fieldId("education", index, "date"))}
                style={withFieldStyle(fieldId("education", index, "date"), { fontSize: "var(--r-fs-muted, 11px)" })}
              >
                {item.date}
              </span>
            </div>
            );
          })}
        </div>
      </section>
    ) : null,

    experience: (
      <section className={sectionClass(activeSectionId, workingSection, "experience")} data-section="experience" key="experience">
        {renderSectionHead("实习经历")}
        {resume.experience.map((item, index) => {
          const detailsFid = fieldId("experience", index, "details");
          return (
            <div className="ponnd-entry" key={`${item.company}-${item.date}`}>
              <div className="ponnd-entry-head ponnd-experience-head">
                <strong className={`ponnd-entry-company ${fc("experience", index, "company")}`} onClick={(e) => click(e, fieldId("experience", index, "company"))} style={fieldStyle(fieldId("experience", index, "company"))}>
                  <RichText value={item.company} fieldId={fieldId("experience", index, "company")} linkStyle={linkStyleFor(fieldId("experience", index, "company"))} />
                </strong>
                <span className={`ponnd-entry-role ${fc("experience", index, "role")}`} onClick={(e) => click(e, fieldId("experience", index, "role"))} style={fieldStyle(fieldId("experience", index, "role"))}>
                  <RichText value={item.role} fieldId={fieldId("experience", index, "role")} linkStyle={linkStyleFor(fieldId("experience", index, "role"))} />
                </span>
                <span className={`ponnd-date ${fc("experience", index, "date")}`} onClick={(e) => click(e, fieldId("experience", index, "date"))} style={withFieldStyle(fieldId("experience", index, "date"), { fontSize: "var(--r-fs-muted, 11px)" })}>{item.date}</span>
              </div>
              <div className={`ponnd-body ponnd-structured-body ${fc("experience", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 11.5px)" })}>
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
          if (!hasEntryContent(item)) return null;
          const detailsFid = fieldId("projects", index, "details");
          return (
            <div className="ponnd-entry" key={`${item.name}-${index}`}>
              <div className="ponnd-entry-head ponnd-project-head">
                <strong className={`ponnd-entry-name ${fc("projects", index, "name")}`} onClick={(e) => click(e, fieldId("projects", index, "name"))} style={fieldStyle(fieldId("projects", index, "name"))}>
                  <RichText value={item.name} fieldId={fieldId("projects", index, "name")} linkStyle={linkStyleFor(fieldId("projects", index, "name"))} />
                </strong>
                <span className={`ponnd-entry-role ${fc("projects", index, "role")}`} onClick={(e) => click(e, fieldId("projects", index, "role"))} style={fieldStyle(fieldId("projects", index, "role"))}>
                  <RichText value={item.role} fieldId={fieldId("projects", index, "role")} linkStyle={linkStyleFor(fieldId("projects", index, "role"))} />
                </span>
              </div>
              <div className={`ponnd-body ponnd-structured-body ponnd-project-body ${fc("projects", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 11.5px)" })}>
                {renderStructuredField(detailsFid, item.details)}
              </div>
            </div>
          );
        })}
      </section>
    ) : null,

    skills: skills.length > 0 ? (
      <section className={sectionClass(activeSectionId, workingSection, "skills")} data-section="skills" key="skills">
        {renderSectionHead("专业技能")}
        {skillsLayout === "grid" ? (
          <div className="ponnd-skills-grid">
            {skills.map((item, index) => (
              <div className="ponnd-skill-card" key={`${item.category}-${index}`}>
                <strong
                  className={`ponnd-skill-cat ${fc("skills", index, "category")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "category"))}
                  style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 11.5px)" })}
                >
                  <RichText value={item.category} fieldId={fieldId("skills", index, "category")} linkStyle={linkStyleFor(fieldId("skills", index, "category"))} />
                </strong>
                <div
                  className={`ponnd-body ponnd-skill-body ${fc("skills", index, "content")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "content"))}
                  style={withFieldStyle(fieldId("skills", index, "content"), { fontSize: "var(--r-fs-body, 11px)", whiteSpace: "pre-wrap" })}
                >
                  {renderField(fieldId("skills", index, "content"), item.content)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`ponnd-skills-wrapper${skillsLayout === "inline" ? " layout-inline" : " layout-block"}`}>
            {skills.map((item, index) => (
              <div className="ponnd-skill-entry" key={`${item.category}-${index}`}>
                <strong
                  className={`ponnd-skill-cat ${fc("skills", index, "category")}`}
                  onClick={(e) => click(e, fieldId("skills", index, "category"))}
                  style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 11.5px)" })}
                >
                  <RichText value={item.category} fieldId={fieldId("skills", index, "category")} linkStyle={linkStyleFor(fieldId("skills", index, "category"))} />
                </strong>
                <div
                  className={`ponnd-body ponnd-skill-body ${fc("skills", index, "content")}`}
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
    ) : null
  };

  const sectionOrder = resolveSectionOrder(layoutConfig, ["education", "experience", "projects", "skills", "summary"]);

  return (
    <div className="ponnd-page">
      <header className={headerClass} data-section="header">
        {avatar && (
          <DraggableAvatar
            src={avatar}
            position={avatarPos}
            onPositionChange={onAvatarPosChange}
            size={68}
            className="ponnd-avatar-topright"
          />
        )}
        <h1
          className={fc("header", null, "name")}
          onClick={(e) => click(e, fieldId("header", null, "name"))}
          style={withFieldStyle(fieldId("header", null, "name"), { fontSize: "var(--r-fs-heading, 24px)" })}
        >
          {resume.name}
        </h1>
        <div className="ponnd-header-meta">
          {resume.title && (
            <p
              className={`ponnd-intent ${fc("header", null, "title")}`}
              onClick={(e) => click(e, fieldId("header", null, "title"))}
              style={withFieldStyle(fieldId("header", null, "title"), { fontSize: "var(--r-fs-body, 11.5px)" })}
            >
              <RichText value={resume.title} fieldId={fieldId("header", null, "title")} linkStyle={linkStyleFor(fieldId("header", null, "title"))} emphasizeMetrics={false} />
            </p>
          )}
          <p
            className={`ponnd-contact ${fc("header", null, "contact")}`}
            onClick={(e) => click(e, fieldId("header", null, "contact"))}
            style={withFieldStyle(fieldId("header", null, "contact"), { fontSize: "var(--r-fs-muted, 11px)" })}
          >
            <RichText value={resume.contact} fieldId={fieldId("header", null, "contact")} linkStyle={linkStyleFor(fieldId("header", null, "contact"))} emphasizeMetrics={false} />
          </p>
        </div>
      </header>

      {sectionOrder.map((sectionId) => sectionsMap[sectionId] || null)}
    </div>
  );
}
