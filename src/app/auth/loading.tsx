import { Spinner } from "@/components/ui/Skeleton";

// Loader pour /auth/* — transitions login → register → reset etc.
// Court overlay sur fond dégradé pour rester cohérent visuellement.

export default function AuthLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a2744 0%, #243a5e 50%, #3b6fa0 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "#fff",
        fontFamily: "'Source Sans 3', -apple-system, sans-serif",
        animation: "civiq-page-loader-in 0.18s ease-out",
      }}
    >
      <Spinner size={32} stroke={2.5} />
      <span style={{ fontSize: 14, opacity: 0.85 }}>Chargement…</span>
    </div>
  );
}
