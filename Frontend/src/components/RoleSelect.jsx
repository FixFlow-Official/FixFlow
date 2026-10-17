import { useEffect, useRef, useState } from "react";

const roles = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrator" },
];

export default function RoleSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedRole = roles.find((role) => role.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = roles.findIndex((role) => role.value === value);
    optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
  }, [isOpen, value]);

  function chooseRole(role) {
    onChange(role.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    let nextIndex = index;

    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % roles.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + roles.length) % roles.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = roles.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
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
          className="absolute left-0 right-0 z-10 mt-2 flex flex-col gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-lg"
        >
          {roles.map((role, index) => (
            <button
              key={role.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === role.value}
              onClick={() => chooseRole(role)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={`w-full rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                value === role.value
                  ? "bg-brand-soft text-brand-dark"
                  : "text-ink hover:bg-slate-100"
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