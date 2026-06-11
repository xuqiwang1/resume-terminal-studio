import AnimatedText from "../../components/AnimatedText";
import RichText from "../../components/RichText";
import { fieldId, fieldClass, sectionClass, getDraftText } from "../shared";

export default function EditorialTemplate({ resume, ctx }) {
  const {
    activeSectionId, draftState, selectedField, onFieldClick,
    workingSection, patchAnimation, onPatchAnimationComplete,
    fieldStyles = {}
  } = ctx;

  const summaryDraft = getDraftText(draftState, "summary");
  const experienceDraft = getDraftText(draftState, "experience");
  const projectsDraft = getDraftText(draftState, "projects");

  const fc = (sec, idx, field) => fieldClass(selectedField, sec, idx, field);
  const click = (e, fid) => { e.stopPropagation(); onFieldClick?.(fid); };
  const fieldStyle = (fid) => fieldStyles[fid] || {};
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

  return (
    <>
      <div className={headerClass}>
        <h2 className={fc("header", null, "name")} onClick={(e) => click(e, fieldId("header", null, "name"))} style={fieldStyle(fieldId("header", null, "name"))}>
          {resume.name}
        </h2>
        <p className={fc("header", null, "title")} onClick={(e) => click(e, fieldId("header", null, "title"))} style={fieldStyle(fieldId("header", null, "title"))}>
          {resume.title}
        </p>
        <p className={fc("header", null, "contact")} onClick={(e) => click(e, fieldId("header", null, "contact"))} style={fieldStyle(fieldId("header", null, "contact"))}>
          <RichText value={resume.contact} fieldId={fieldId("header", null, "contact")} />
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
                {item.school}{item.tag ? `（${item.tag}）` : ""}
              </strong>
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
                style={fieldStyle(fieldId("education", index, "major"))}
              >
                {[item.degree, item.major].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </section>
      )}

      {Array.isArray(resume.skills) && resume.skills.length > 0 && (
        <section className={sectionClass(activeSectionId, workingSection, "skills")} data-section="skills">
          <h3>专业技能</h3>
          {resume.skills.map((item, index) => (
            <div className="resume-card" key={`${item.category}-${index}`}>
              <strong
                className={fc("skills", index, "category")}
                onClick={(e) => click(e, fieldId("skills", index, "category"))}
                style={fieldStyle(fieldId("skills", index, "category"))}
              >
                {item.category}
              </strong>
              <p
                className={fc("skills", index, "content")}
                onClick={(e) => click(e, fieldId("skills", index, "content"))}
                style={{ whiteSpace: "pre-wrap", ...fieldStyle(fieldId("skills", index, "content")) }}
              >
                {patchFor(fieldId("skills", index, "content"))?.active
                  ? renderAnimated(fieldId("skills", index, "content"), item.content)
                  : <RichText value={item.content} fieldId={fieldId("skills", index, "content")} />}
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
                {item.role} · {item.company}
              </strong>
              <span className={fc("experience", index, "date")} onClick={(e) => click(e, fieldId("experience", index, "date"))} style={fieldStyle(fieldId("experience", index, "date"))}>{item.date}</span>
              <p className={`${fc("experience", index, "details")} ${showDraft ? "drafting-text" : ""}`} onClick={(e) => click(e, detailsFid)} style={fieldStyle(detailsFid)}>
                {detailsPatch?.active
                  ? renderAnimated(detailsFid, showDraft ? experienceDraft : item.details)
                  : <RichText value={showDraft ? experienceDraft : item.details} fieldId={detailsFid} />}
              </p>
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
                {item.name}
              </strong>
              <span className={fc("projects", index, "role")} onClick={(e) => click(e, fieldId("projects", index, "role"))} style={fieldStyle(fieldId("projects", index, "role"))}>
                {item.role} · {item.date}
              </span>
              <p className={`${fc("projects", index, "details")} ${showDraft ? "drafting-text" : ""}`} onClick={(e) => click(e, detailsFid)} style={fieldStyle(detailsFid)}>
                {detailsPatch?.active
                  ? renderAnimated(detailsFid, showDraft ? projectsDraft : item.details)
                  : <RichText value={showDraft ? projectsDraft : item.details} fieldId={detailsFid} />}
              </p>
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
                : <RichText value={summaryDraft ?? resume.summary} fieldId={fieldId("summary", null, "text")} />}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
