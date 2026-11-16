interface EmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}

export function EmptyState({ title, message, action, children }: EmptyStateProps) {
  return (
    <div className="text-center py-8 px-4" role="status" aria-live="polite">
      <div className="text-4xl mb-3">📅</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {children}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
