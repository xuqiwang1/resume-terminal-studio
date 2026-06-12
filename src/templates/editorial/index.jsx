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
        if (!trimmed) return <span className="editorial-line-gap" key={index} />;
        const labeled = trimmed.match(/^(【[^】]+】)(.*)$/);
        if (labeled) {
          return (
            <span className="editorial-detail-line" key={index}>
              <strong>{labeled[1]}</strong>
              <RichText value={labeled[2]} fieldId={`editorial-structured.${index}`} />
            </span>
          );
        }
        return (
          <span className="editorial-detail-line" key={index}>
            <RichText value={trimmed} fieldId={`editorial-structured.${index}`} />
          </span>
        );
      })}
    </>
  );
}

export default function EditorialTemplate({ resume, ctx }) {
  const {
    activeSectionId, draftState, selectedField, onFieldClick,
    workingSection, patchAnimation, onPatchAnimationComplete,
    avatar, avatarPos, onAvatarPosChange, layoutConfig, fieldStyles = {}
  } = ctx;

  const summaryDraft = getDraftText(draftState, "summary");
  const experienceDraft = getDraftText(draftState, "experience");
  const projectsDraft = getDraftText(draftState, "projects");

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
  const patchFor = (fid) =>
    patchAnimation?.fieldId === fid ? patchAnimation : null;

  const renderAnimated = (fid, fallback) => {
    const patch = patchFor(fid);
    if (patch?.active) {
      return <AnimatedText after={patch.after} active onComplete={() => onPatchAnimationComplete?.(fid)} />;
    }
    return fallback;
  };
  const headerClass = sectionClass(activeSectionId, workingSection, "header").replace(
    "resume-section",
    "resume-header"
  );
  const skillsLayout = layoutConfig?.skills?.layout || "block";

  return (
    <>
      <div className={headerClass}>
        {avatar && (
          <DraggableAvatar
            src={avatar}
            position={avatarPos}
            onPositionChange={onAvatarPosChange}
            size={64}
            className="editorial-avatar-topright"
          />
        )}
        <h2 className={fc("header", null, "name")} onClick={(e) => click(e, fieldId("header", null, "name"))} style={withFieldStyle(fieldId("header", null, "name"), { fontSize: "var(--r-fs-heading, 22px)" })}>
          {resume.name}
        </h2>
        <p className={fc("header", null, "title")} onClick={(e) => click(e, fieldId("header", null, "title"))} style={withFieldStyle(fieldId("header", null, "title"), { fontSize: "var(--r-fs-body, 12px)" })}>
          <RichText value={resume.title} fieldId={fieldId("header", null, "title")} linkStyle={linkStyleFor(fieldId("header", null, "title"))} />
        </p>
        <p className={fc("header", null, "contact")} onClick={(e) => click(e, fieldId("header", null, "contact"))} style={withFieldStyle(fieldId("header", null, "contact"), { fontSize: "var(--r-fs-muted, 11px)" })}>
          <RichText value={resume.contact} fieldId={fieldId("header", null, "contact")} linkStyle={linkStyleFor(fieldId("header", null, "contact"))} />
        </p>
      </div>

      {Array.isArray(resume.education) && resume.education.length > 0 && (
        <section className={sectionClass(activeSectionId, workingSection, "education")} data-section="education">
          <h3>教育背景</h3>
          {resume.education.map((item, index) => (
            <div className="resume-card" key={`${item.school}-${item.date}-${index}`}>
              <strong
                className={fc("education", index, "school")}
                onClick={(e) => click(e, fieldId("education", index, "school"))}
                style={fieldStyle(fieldId("education", index, "school"))}
              >
                {item.school}
              </strong>
              {item.tag ? (
                <em
                  className={fc("education", index, "tag")}
                  onClick={(e) => click(e, fieldId("education", index, "tag"))}
                  style={fieldStyle(fieldId("education", index, "tag"))}
                >
                  {item.tag}
                </em>
              ) : null}
              <span
                className={fc("education", index, "date")}
                onClick={(e) => click(e, fieldId("education", index, "date"))}
                style={fieldStyle(fieldId("education", index, "date"))}
              >
                {item.date}
              </span>
              <p
                className={fc("education", index, "major")}
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
              </p>
            </div>
          ))}
        </section>
      )}

      {Array.isArray(resume.skills) && resume.skills.length > 0 && (
        <section className={sectionClass(activeSectionId, workingSection, "skills")} data-section="skills">
          <h3>专业技能</h3>
          {resume.skills.map((item, index) => (
            <div className={`resume-card editorial-skill-card${skillsLayout === "inline" ? " skill-inline" : ""}`} key={`${item.category}-${index}`}>
              <strong
                className={fc("skills", index, "category")}
                onClick={(e) => click(e, fieldId("skills", index, "category"))}
                style={withFieldStyle(fieldId("skills", index, "category"), { fontSize: "var(--r-fs-body, 12px)" })}
              >
                <RichText value={item.category} fieldId={fieldId("skills", index, "category")} linkStyle={linkStyleFor(fieldId("skills", index, "category"))} />
              </strong>
              <p
                className={fc("skills", index, "content")}
                onClick={(e) => click(e, fieldId("skills", index, "content"))}
                style={withFieldStyle(fieldId("skills", index, "content"), { whiteSpace: "pre-wrap", fontSize: "var(--r-fs-body, 12px)" })}
              >
                {patchFor(fieldId("skills", index, "content"))?.active
                  ? renderAnimated(fieldId("skills", index, "content"), item.content)
                  : <RichText value={item.content} fieldId={fieldId("skills", index, "content")} linkStyle={linkStyleFor(fieldId("skills", index, "content"))} />}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className={sectionClass(activeSectionId, workingSection, "experience")} data-section="experience">
        <h3>实习经历</h3>
        {resume.experience.map((item, index) => {
          const detailsFid = fieldId("experience", index, "details");
          const detailsPatch = patchFor(detailsFid);
          const showDraft = index === 0 && experienceDraft !== null && !detailsPatch?.active;
          return (
            <div className="resume-card" key={`${item.company}-${item.date}`}>
              <strong className={fc("experience", index, "role")} onClick={(e) => click(e, fieldId("experience", index, "role"))} style={fieldStyle(fieldId("experience", index, "role"))}>
                <RichText value={item.role} fieldId={fieldId("experience", index, "role")} linkStyle={linkStyleFor(fieldId("experience", index, "role"))} />{item.role && item.company ? " · " : ""}<RichText value={item.company} fieldId={fieldId("experience", index, "company")} linkStyle={linkStyleFor(fieldId("experience", index, "company"))} />
              </strong>
              <span className={fc("experience", index, "date")} onClick={(e) => click(e, fieldId("experience", index, "date"))} style={fieldStyle(fieldId("experience", index, "date"))}>{item.date}</span>
              <div className={`${fc("experience", index, "details")} editorial-structured-body ${showDraft ? "drafting-text" : ""}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 12px)" })}>
                {detailsPatch?.active
                  ? renderAnimated(detailsFid, showDraft ? experienceDraft : item.details)
                  : <StructuredText value={showDraft ? experienceDraft : item.details} />}
              </div>
            </div>
          );
        })}
      </section>

      <section className={sectionClass(activeSectionId, workingSection, "projects")} data-section="projects">
        <h3>项目经历</h3>
        {resume.projects.map((item, index) => {
          const detailsFid = fieldId("projects", index, "details");
          const detailsPatch = patchFor(detailsFid);
          const showDraft = index === 0 && projectsDraft !== null && !detailsPatch?.active;
          return (
            <div className="resume-card" key={`${item.name}-${item.date}`}>
              <strong className={fc("projects", index, "name")} onClick={(e) => click(e, fieldId("projects", index, "name"))} style={fieldStyle(fieldId("projects", index, "name"))}>
                <RichText value={item.name} fieldId={fieldId("projects", index, "name")} linkStyle={linkStyleFor(fieldId("projects", index, "name"))} />
              </strong>
              <span className={fc("projects", index, "role")} onClick={(e) => click(e, fieldId("projects", index, "role"))} style={fieldStyle(fieldId("projects", index, "role"))}>
                <RichText value={item.role} fieldId={fieldId("projects", index, "role")} linkStyle={linkStyleFor(fieldId("projects", index, "role"))} />{item.role && item.date ? " · " : ""}{item.date}
              </span>
              <div className={`${fc("projects", index, "details")} editorial-structured-body ${showDraft ? "drafting-text" : ""}`} onClick={(e) => click(e, detailsFid)} style={withFieldStyle(detailsFid, { fontSize: "var(--r-fs-body, 12px)" })}>
                {detailsPatch?.active
                  ? renderAnimated(detailsFid, showDraft ? projectsDraft : item.details)
                  : <StructuredText value={showDraft ? projectsDraft : item.details} />}
              </div>
            </div>
          );
        })}
      </section>

      {typeof (summaryDraft ?? resume.summary) === "string" && (summaryDraft ?? resume.summary).trim() && (
        <section className={sectionClass(activeSectionId, workingSection, "summary")} data-section="summary">
          <h3>个人总结</h3>
          <div className={`resume-card ${summaryDraft !== null ? "drafting" : ""}`}>
            <p className={fc("summary", null, "text")} onClick={(e) => click(e, fieldId("summary", null, "text"))} style={{ whiteSpace: "pre-wrap", ...fieldStyle(fieldId("summary", null, "text")) }}>
              {patchFor(fieldId("summary", null, "text"))?.active
                ? renderAnimated(fieldId("summary", null, "text"), summaryDraft ?? resume.summary)
                : <RichText value={summaryDraft ?? resume.summary} fieldId={fieldId("summary", null, "text")} linkStyle={linkStyleFor(fieldId("summary", null, "text"))} />}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
