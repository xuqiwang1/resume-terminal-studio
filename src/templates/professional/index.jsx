import AnimatedText from "../../components/AnimatedText";
import RichText from "../../components/RichText";
import DraggableAvatar from "../../components/DraggableAvatar";
import { fieldId, fieldClass, sectionClass, getDraftText } from "../shared";

function StructuredText({ value }) {
  const lines = String(value || "").split("\n");

  return (
    <>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <span className="pro-line-gap" key={index} />;
        }

        const labeled = trimmed.match(/^(【[^】]+】)(.*)$/);
        if (labeled) {
          return (
            <span className="pro-detail-line" key={index}>
              <strong>{labeled[1]}</strong>
              {labeled[2]}
            </span>
          );
        }

        if (/^[^【\n]+｜\d{4}\.\d{2}-\d{4}\.\d{2}$/.test(trimmed)) {
          return (
            <span className="pro-stage-line" key={index}>
              {trimmed}
            </span>
          );
        }

        return (
          <span className="pro-detail-line" key={index}>
            {trimmed}
          </span>
        );
      })}
    </>
  );
}

export default function ProfessionalTemplate({ resume, ctx }) {
  const {
    activeSectionId, draftState, selectedField, onFieldClick,
    workingSection, patchAnimation, onPatchAnimationComplete,
    ruleStyle = "thick", avatar, avatarPos, onAvatarPosChange,
    layoutConfig, fieldStyles = {},
  } = ctx;

  const summaryDraft = getDraftText(draftState, "summary");
  const experienceDraft = getDraftText(draftState, "experience");
  const projectsDraft = getDraftText(draftState, "projects");

  const fc = (sec, idx, field) => fieldClass(selectedField, sec, idx, field);
  const click = (e, fid) => { e.stopPropagation(); onFieldClick?.(fid); };
  const fieldStyle = (fid) => fieldStyles[fid] || {};
  const withFieldStyle = (fid, base = {}) => ({ ...base, ...fieldStyle(fid) });
  const patchFor = (fid) => patchAnimation?.fieldId === fid ? patchAnimation : null;
  const renderField = (fid, value, draftFallback) => {
    const patch = patchFor(fid);
    if (patch?.active) return <AnimatedText after={patch.after} active onComplete={() => onPatchAnimationComplete?.(fid)} />;
    const display = draftFallback ?? value;
    return <RichText value={display} fieldId={fid} />;
  };
  const renderStructuredField = (fid, value, draftFallback) => {
    const patch = patchFor(fid);
    if (patch?.active) return <AnimatedText after={patch.after} active onComplete={() => onPatchAnimationComplete?.(fid)} />;
    return <StructuredText value={draftFallback ?? value} />;
  };

  const ruleClass = `pro-rule${ruleStyle !== "thick" ? ` ${ruleStyle}` : ""}`;
  const education = Array.isArray(resume.education) ? resume.education : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const summaryText = summaryDraft ?? resume.summary;
  const hasSummary = typeof summaryText === "string" && summaryText.trim().length > 0;
  const eduLayout = layoutConfig?.education || {};
  const schoolAlign = eduLayout.schoolAlign || "center";
  const majorAlign = eduLayout.majorAlign || "right";
  const skillsLayout = layoutConfig?.skills?.layout || "inline";

  return (
    <div className="pro-page">
      <header className="pro-header">
        {avatar && (
          <DraggableAvatar
            src={avatar}
            position={avatarPos}
            onPositionChange={onAvatarPosChange}
            className="pro-avatar-topright"
          />
        )}
        <h1
          className={fc("header", null, "name")}
          onClick={(e) => click(e, fieldId("header", null, "name"))}
          style={withFieldStyle(fieldId("header", null, "name"), { fontSize: "var(--r-fs-heading, 22px)" })}
        >
          {resume.name}
        </h1>
        <p
          className={`pro-contact ${fc("header", null, "contact")}`}
          onClick={(e) => click(e, fieldId("header", null, "contact"))}
          style={withFieldStyle(fieldId("header", null, "contact"), { fontSize: "var(--r-fs-muted, 11.5px)" })}
        >
          {resume.contact}
        </p>
        {resume.title && (
          <p
            className={`pro-intent ${fc("header", null, "title")}`}
            onClick={(e) => click(e, fieldId("header", null, "title"))}
            style={withFieldStyle(fieldId("header", null, "title"), { fontSize: "var(--r-fs-body, 12px)" })}
          >
            {resume.title}
          </p>
        )}
      </header>

      {education.length > 0 && (
        <section className={sectionClass(activeSectionId, workingSection, "education")} data-section="education">
          <div className="pro-section-head">
            <h2>教育背景</h2>
            <div className={ruleClass} />
          </div>
          {education.map((item, index) => (
            <div className={`pro-edu-entry edu-school-${schoolAlign} edu-major-${majorAlign}`} key={`${item.school}-${item.date}-${index}`}>
              <span
                className={`pro-edu-date ${fc("education", index, "date")}`}
                onClick={(e) => click(e, fieldId("education", index, "date"))}
                style={withFieldStyle(fieldId("education", index, "date"), { fontSize: "var(--r-fs-muted, 11.5px)" })}
              >
                {item.date}
              </span>
              <span className="pro-edu-school">
                <strong
                  className={fc("education", index, "school")}
                  onClick={(e) => click(e, fieldId("education", index, "school"))}
                  style={fieldStyle(fieldId("education", index, "school"))}
                >
                  {item.school}
                </strong>
                {item.tag && (
                  <em
                    className={`pro-edu-tag ${fc("education", index, "tag")}`}
                    onClick={(e) => click(e, fieldId("education", index, "tag"))}
                    style={fieldStyle(fieldId("education", index, "tag"))}
                  >
                    {item.tag}
                  </em>
                )}
              </span>
              <span
                className={`pro-edu-major ${fc("education", index, "major")}`}
                onClick={(e) => click(e, fieldId("education", index, "major"))}
                style={withFieldStyle(fieldId("education", index, "major"), { fontSize: "var(--r-fs-body, 12px)" })}
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
      )}

      <section className={sectionClass(activeSectionId, workingSection, "experience")} data-section="experience">
        <div className="pro-section-head">
          <h2>实习经历</h2>
          <div className={ruleClass} />
        </div>
        {resume.experience.map((item, index) => {
          const detailsFid = fieldId("experience", index, "details");
          const detailsPatch = patchFor(detailsFid);
          const showDraft = index === 0 && experienceDraft !== null && !detailsPatch?.active;
          return (
            <div className="pro-entry" key={`${item.company}-${item.date}`}>
              <div className="pro-entry-head pro-experience-head">
                <strong className={fc("experience", index, "company")} onClick={(e) => click(e, fieldId("experience", index, "company"))} style={fieldStyle(fieldId("experience", index, "company"))}>
                  {item.company}
                </strong>
                <span className={fc("experience", index, "role")} onClick={(e) => click(e, fieldId("experience", index, "role"))} style={fieldStyle(fieldId("experience", index, "role"))}>
                  {item.role}
                </span>
                <span className={`pro-date ${fc("experience", index, "date")}`} onClick={(e) => click(e, fieldId("experience", index, "date"))} style={withFieldStyle(fieldId("experience", index, "date"), { fontSize: "var(--r-fs-muted, 12px)" })}>{item.date}</span>
              </div>
              <div className={`pro-body pro-structured-body ${fc("experience", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 12px)" })}>
                {renderStructuredField(detailsFid, item.details, showDraft ? experienceDraft : null)}
              </div>
            </div>
          );
        })}
      </section>

      <section className={sectionClass(activeSectionId, workingSection, "projects")} data-section="projects">
        <div className="pro-section-head">
          <h2>项目经历</h2>
          <div className={ruleClass} />
        </div>
        {resume.projects.map((item, index) => {
          const detailsFid = fieldId("projects", index, "details");
          const detailsPatch = patchFor(detailsFid);
          const showDraft = index === 0 && projectsDraft !== null && !detailsPatch?.active;
          return (
            <div className="pro-entry" key={`${item.name}-${item.date}`}>
              <div className="pro-entry-head pro-project-head">
                <strong className={fc("projects", index, "name")} onClick={(e) => click(e, fieldId("projects", index, "name"))} style={fieldStyle(fieldId("projects", index, "name"))}>
                  {item.name}
                </strong>
                <span className={fc("projects", index, "role")} onClick={(e) => click(e, fieldId("projects", index, "role"))} style={fieldStyle(fieldId("projects", index, "role"))}>
                  {item.role}
                </span>
                <span className={`pro-date ${fc("projects", index, "date")}`} onClick={(e) => click(e, fieldId("projects", index, "date"))} style={withFieldStyle(fieldId("projects", index, "date"), { fontSize: "var(--r-fs-muted, 12px)" })}>
                  {item.date}
                </span>
              </div>
              <div className={`pro-body pro-structured-body pro-project-body ${fc("projects", index, "details")}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 12px)" })}>
                {renderStructuredField(detailsFid, item.details, showDraft ? projectsDraft : null)}
              </div>
            </div>
          );
        })}
      </section>

      {skills.length > 0 && (
        <section className={sectionClass(activeSectionId, workingSection, "skills")} data-section="skills">
          <div className="pro-section-head">
            <h2>专业技能</h2>
            <div className={ruleClass} />
          </div>
          {skills.map((item, index) => (
            <div className={`pro-skill-entry${skillsLayout === "inline" ? " skill-inline" : ""}`} key={`${item.category}-${index}`}>
              <strong
                className={`pro-skill-cat ${fc("skills", index, "category")}`}
                onClick={(e) => click(e, fieldId("skills", index, "category"))}
                style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 12px)" })}
              >
                {item.category}
              </strong>
              <div
                className={`pro-body ${fc("skills", index, "content")}`}
                onClick={(e) => click(e, fieldId("skills", index, "content"))}
                style={withFieldStyle(fieldId("skills", index, "content"), { fontSize: "var(--r-fs-body, 12px)", whiteSpace: "pre-wrap" })}
              >
                {renderField(fieldId("skills", index, "content"), item.content)}
              </div>
            </div>
          ))}
        </section>
      )}

      {hasSummary && (
        <section className={sectionClass(activeSectionId, workingSection, "summary")} data-section="summary">
          <div className="pro-section-head">
            <h2>个人总结</h2>
            <div className={ruleClass} />
          </div>
          <div
            className={`pro-body ${fc("summary", null, "text")}`}
            onClick={(e) => click(e, fieldId("summary", null, "text"))}
            style={withFieldStyle(fieldId("summary", null, "text"), { fontSize: "var(--r-fs-body, 12px)", whiteSpace: "pre-wrap" })}
          >
            {renderField(fieldId("summary", null, "text"), summaryText)}
          </div>
        </section>
      )}
    </div>
  );
}
