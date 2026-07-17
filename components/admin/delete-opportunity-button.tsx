"use client";

import { Trash2 } from "lucide-react";

export function DeleteOpportunityButton() {
  return <button type="submit" onClick={(event) => { if (!window.confirm("Delete this opportunity permanently?")) event.preventDefault(); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="size-3.5" />Delete</button>;
}
