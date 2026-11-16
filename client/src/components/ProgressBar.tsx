const STEPS = ['Time Zone', 'Pick a Day', 'Pick a Time', 'Your Details'];

export function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6" role="navigation" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-0.5 w-6 sm:w-10 ${isDone ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? '✓' : step}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
