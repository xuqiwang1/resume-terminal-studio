export default function SectionList({ sections, activeSectionId, onSelect }) {
  return (
    <aside className="panel left-panel">
      <div className="panel-head">
        <span className="panel-kicker">Resume Structure</span>
        <h3>Sections</h3>
      </div>
      <div className="section-list">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`section-item ${section.id === activeSectionId ? "active" : ""}`}
            onClick={() => onSelect(section.id)}
          >
            <h3>{section.title}</h3>
            <p>{section.desc}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}
