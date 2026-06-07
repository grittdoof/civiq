// Squelette de chargement pour /admin/tickets/nouveau.
// Affiché instantanément pendant que le Server Component charge
// agents + commune (sinon le clic sur le FAB paraît figé ~500ms).

export default function Loading() {
  return (
    <main className="tk-wizard" aria-busy="true">
      <header className="tk-wizard-header">
        <div className="tk-wizard-iconbtn" style={{ background: "var(--border-light)" }} />
        <span className="tk-wizard-step" style={{ visibility: "hidden" }}>—</span>
        <div className="tk-wizard-iconbtn" style={{ visibility: "hidden" }} />
      </header>

      <div className="tk-wizard-progress">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="tk-wizard-progress-seg" />
        ))}
      </div>

      <div className="tk-wizard-body">
        <div className="tk-wizard-title-block">
          <div className="tk-skel" style={{ width: 60, height: 11, marginBottom: 8 }} />
          <div className="tk-skel" style={{ width: "80%", height: 26, marginBottom: 8 }} />
          <div className="tk-skel" style={{ width: "60%", height: 14 }} />
        </div>
        <div className="tk-wizard-options">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="tk-skel" style={{ height: 76, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </main>
  );
}
