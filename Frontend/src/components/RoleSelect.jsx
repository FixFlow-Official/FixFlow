import { useState } from "react";

const roles = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrator" },
];

export default function RoleSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedRole = roles.find((role) => role.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-white px-3.5 text-left text-base shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
      >
        <span>{selectedRole?.label ?? "Choose account type"}</span>
        <span aria-hidden="true" className="text-muted">
          ⌄
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Account type"
          className="absolute left-0 flex flex-col gap-1.5 right-0 z-10 mt-2 rounded-2xl border border-line bg-white p-1.5 shadow-lg"
        >
          {roles.map((role) => (
            <button
              key={role.value}
              type="button"
              role="option"
              aria-selected={value === role.value}
              onClick={() => {
                onChange(role.value);
                setIsOpen(false);
              }}
              className={`w-full rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                value === role.value
                  ? "bg-brand-soft text-brand-dark"
                  : "text-ink hover:bg-brand-soft hover:text-brand-dark"
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
