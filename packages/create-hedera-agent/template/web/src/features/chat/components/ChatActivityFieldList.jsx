import * as React from "react";

export function ChatActivityFieldList({
  title,
  fields,
}) {
  if (fields.length === 0) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
        {title}
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        {fields.map((field) => (
          <React.Fragment key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="break-words whitespace-pre-wrap font-mono">
              {field.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
