"use client";

import { exportInvoicePdf } from "@/lib/export-invoice-pdf";
import { supabase } from "@/lib/supabase";
import { useMemo, useRef, useState } from "react";

type InvoiceForm = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  serviceDescription: string;
  amount: string;
  notes: string;
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function dueDateISO(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function parseAmountValue(raw: string): number {
  const cleaned = raw.replace(/,/g, "");
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const dotIndex = cleaned.indexOf(".");
  const intPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? undefined : cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);

  const formattedInt = intPart
    ? new Intl.NumberFormat("en-US").format(Number(intPart))
    : "";

  if (decPart !== undefined) {
    return `${formattedInt || "0"}.${decPart}`;
  }
  return formattedInt;
}

function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const initialForm: InvoiceForm = {
  invoiceNumber: `XF-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}001`,
  issueDate: todayISO(),
  dueDate: dueDateISO(),
  clientName: "",
  clientEmail: "",
  serviceDescription: "",
  amount: "",
  notes: "",
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500"
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
    />
  );
}

export default function Home() {
  const [form, setForm] = useState<InvoiceForm>(initialForm);
  const [generated, setGenerated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const invoiceCardRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => parseAmountValue(form.amount), [form.amount]);

  function updateField<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setGenerated(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAmountChange(raw: string) {
    setGenerated(false);
    setForm((prev) => ({ ...prev, amount: formatAmountInput(raw) }));
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerated(true);
    saveInvoice();
    requestAnimationFrame(() => {
      document.getElementById("invoice-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  async function saveInvoice() {
  const { error } = await supabase
    .from("invoices")
    .insert([
      {
        invoice_number: form.invoiceNumber,
        client_name: form.clientName,
        client_email: form.clientEmail,
        service_description: form.serviceDescription,
        amount: total,
        notes: form.notes,
        status: "Generated",
      },
    ]);

  if (error) {
    console.error(error);
  }
}
  async function handleDownloadPdf() {
    const element = invoiceCardRef.current;
    if (!element || isExporting) return;

    setIsExporting(true);
    const hadHighlight = generated;

    element.classList.remove("ring-2", "ring-orange-100", "border-orange-200");
    element.style.borderColor = "#e7e5e4";

    try {
      const safeName = (form.invoiceNumber || "invoice").replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );
      await exportInvoicePdf(element, `${safeName}.pdf`);
      const currentNumber = Number(
        form.invoiceNumber.split("-").pop()
      );
      
      const nextNumber = String(currentNumber + 1).padStart(5, "0");
      
      setForm((prev) => ({
        ...prev,
        invoiceNumber: `XF-${new Date().getFullYear()}-${nextNumber}`,
      }));
    } catch (error) {
      console.error("PDF export failed:", error);
      window.alert("Unable to export PDF. Please try again.");
    } finally {
      element.style.borderColor = "";
      if (hadHighlight) {
        element.classList.add("ring-2", "ring-orange-100", "border-orange-200");
      }
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f5f4f0] font-sans text-stone-800">
      {/* Header */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white shadow-sm">
              XF
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-stone-900">
              X-FORGE DIGITAL MARKETING LLC
              </p>
              <p className="text-xs text-stone-500">Invoice Generator</p>
            </div>
          </div>
          <span className="hidden rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600 sm:inline-block">
            Draft
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Create Invoice
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Fill in the details below. Your invoice preview updates in real time.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Form */}
          <section className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-sm font-semibold text-stone-900">
              Invoice Details
            </h2>

            <form onSubmit={handleGenerate} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="invoiceNumber">Invoice Number</FieldLabel>
                  <TextInput
                    id="invoiceNumber"
                    value={form.invoiceNumber}
                    onChange={(v) => updateField("invoiceNumber", v)}
                    placeholder="XF-2026-06001"
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="issueDate">Issue Date</FieldLabel>
                  <TextInput
                    id="issueDate"
                    type="date"
                    value={form.issueDate}
                    onChange={(v) => updateField("issueDate", v)}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="dueDate">Due Date</FieldLabel>
                  <TextInput
                    id="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(v) => updateField("dueDate", v)}
                    required
                  />
                </div>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Client
                </h3>
                <div className="space-y-5">
                  <div>
                    <FieldLabel htmlFor="clientName">Client Name</FieldLabel>
                    <TextInput
                      id="clientName"
                      value={form.clientName}
                      onChange={(v) => updateField("clientName", v)}
                      placeholder="Acme Corporation"
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="clientEmail">Client Email</FieldLabel>
                    <TextInput
                      id="clientEmail"
                      type="email"
                      value={form.clientEmail}
                      onChange={(v) => updateField("clientEmail", v)}
                      placeholder="billing@acme.com"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Service
                </h3>
                <div className="space-y-5">
                  <div>
                    <FieldLabel htmlFor="serviceDescription">
                      Service Description
                    </FieldLabel>
                    <textarea
                      id="serviceDescription"
                      value={form.serviceDescription}
                      onChange={(e) =>
                        updateField("serviceDescription", e.target.value)
                      }
                      placeholder="Monthly digital marketing retainer — SEO, paid ads, and content strategy"
                      required
                      rows={3}
                      className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="amount">Amount</FieldLabel>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                        $
                      </span>
                      <input
                        id="amount"
                        type="text"
                        inputMode="decimal"
                        value={form.amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        onBlur={(e) => {
                          const raw = e.target.value;
                          if (!raw) return;
                          const value = parseAmountValue(raw);
                          setForm((prev) => ({
                            ...prev,
                            amount:
                              value === 0
                                ? ""
                                : new Intl.NumberFormat("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(value),
                          }));
                        }}
                        placeholder="2,500.00"
                        required
                        className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-7 pr-3.5 text-sm tabular-nums text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Payment due within 30 days. Thank you for your business!"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3.5">
                <span className="text-sm font-medium text-stone-600">Total</span>
                <span className="text-xl font-semibold tabular-nums text-stone-900">
                  {form.amount ? formatCurrency(total) : "—"}
                </span>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 active:scale-[0.99]"
              >
                Generate Invoice
              </button>
            </form>
          </section>

          {/* Preview */}
          <section id="invoice-preview" className="lg:sticky lg:top-8 lg:self-start">
            <div
              ref={invoiceCardRef}
              className={`overflow-hidden rounded-2xl border bg-white shadow-md transition-all duration-500 ${
                generated
                  ? "border-orange-200 ring-2 ring-orange-100"
                  : "border-stone-200/80"
              }`}
            >
              {/* Preview header band */}
              <div className="flex items-start justify-between bg-stone-900 px-8 py-7 text-white">
                <div>
                <img
  src="/logo.png"
  alt="X-FORGE DIGITAL MARKETING LLC"
  className="mb-2 h-28 w-auto"
/>
                  <p className="text-sm font-medium tracking-tight">
                  X-Forge Marketing LLC
                  </p>
                  <div className="mt-0.5 text-xs text-stone-400">
  <p>5002 Herton Road
  Jacksonville, FL 32257</p>
  <p>xforgemarketing@gmail.com</p>
</div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-light tracking-tight">INVOICE</p>
                  <p className="mt-1 font-mono text-xs text-orange-400">
                    {form.invoiceNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="px-8 py-7">
                {/* Dates & client */}
                <div className="mb-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Bill To
                    </p>
                    <p
                      className={`font-medium ${form.clientName ? "text-stone-900" : "text-stone-400 italic"}`}
                    >
                      {form.clientName || "Client Name"}
                    </p>
                    <p
                      className={`mt-0.5 text-sm ${form.clientEmail ? "text-stone-500" : "text-stone-400 italic"}`}
                    >
                      {form.clientEmail || "client@email.com"}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="mb-3">
                      <p className="text-xs text-stone-400">Issue Date</p>
                      <p className="text-sm font-medium text-stone-700">
                        {formatDisplayDate(form.issueDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-400">Due Date</p>
                      <p className="text-sm font-medium text-stone-700">
                        {formatDisplayDate(form.dueDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Line items table */}
                <div className="mb-6 overflow-hidden rounded-xl border border-stone-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-stone-50">
                        <td className="px-4 py-4 text-stone-700">
                          {form.serviceDescription ? (
                            form.serviceDescription
                          ) : (
                            <span className="text-stone-400 italic">
                              Service description
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums font-medium text-stone-900">
                          {form.amount ? formatCurrency(total) : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total row */}
                <div className="flex items-center justify-end gap-8 border-t border-stone-100 pt-5">
                  <span className="text-sm font-medium text-stone-500">
                    Total Due
                  </span>
                  <span className="text-2xl font-semibold tabular-nums text-stone-900">
                    {form.amount ? formatCurrency(total) : "—"}
                  </span>
                </div>

                {/* Notes */}
                {form.notes && (
                  <div className="mt-6 rounded-lg bg-stone-50 px-4 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Notes
                    </p>
                    <p className="text-sm leading-relaxed text-stone-600">
                      {form.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {generated && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                Invoice generated successfully
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3"
                />
              </svg>
              {isExporting ? "Generating PDF…" : "Download PDF"}
            </button>

            <p className="mt-3 text-center text-xs text-stone-400">
              Preview updates as you type
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
