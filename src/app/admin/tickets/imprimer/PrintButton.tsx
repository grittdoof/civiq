"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="civiq-btn civiq-btn-default"
    >
      <Printer size={14} /> Imprimer / PDF
    </button>
  );
}
