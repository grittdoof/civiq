"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="civiq-btn civiq-btn-outline civiq-btn-sm"
    >
      <Printer size={14} /> {label}
    </button>
  );
}
