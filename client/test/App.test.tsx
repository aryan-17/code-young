import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('renders booking page at /', () => {
    renderApp('/');
    expect(screen.getByText(/book a trial class/i)).toBeInTheDocument();
  });

  it('renders mentor page at /mentor', () => {
    renderApp('/mentor');
    expect(screen.getByText(/mentor view/i)).toBeInTheDocument();
  });
});
