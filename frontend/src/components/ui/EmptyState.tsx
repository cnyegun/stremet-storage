type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-app-border bg-white px-4 py-8 text-center">
      <p className="text-sm font-medium text-app-textMuted">{title}</p>
      {description ? <p className="mt-1 text-xs text-app-textMuted">{description}</p> : null}
    </div>
  );
}
